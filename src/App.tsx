import { useCallback, useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { TableConfig, payout, tableById } from "./economy/tables";
import { wallet } from "./economy/wallet";
import { Dictionary } from "./game/dictionary";
import { GAME_HANDS, GameState, colorWinsOf, newGame, totals } from "./game/engine";
import { LangCode, setGameLang } from "./game/lang";
import { CLOUD, currentUser, firestore } from "./online/cloud";
import { loadDictionary } from "./online/dicts";
import { botNames, setUiLang, t } from "./i18n";
import { SavedGame, Settings, TABLE_TURN_SECONDS, loadGame, loadSettings, saveGame, saveSettings } from "./storage";
import { Game } from "./ui/Game";
import { Hub, Practice } from "./ui/Menu";
import { RotateHint, Splash } from "./ui/Splash";
import { enterFullscreenLandscape } from "./display";
import { startMusic, stopMusic } from "./music";
import { flushFeedback } from "./feedbackBox";
import { recordProgress, recordQuit } from "./stats";
import { OnlineTable, type OnlineEntry } from "./ui/OnlineTable";
import { Rules } from "./ui/Rules";
import { TableLobby } from "./ui/Lobby";
import { Spectator } from "./ui/Spectator";
import { startHeartbeat } from "./online/social";
import { Shop } from "./ui/Shop";
import { Tables } from "./ui/Tables";

type Screen = "hub" | "practice" | "tables" | "shop" | "rules" | "game" | "online" | "lobby" | "watch";

const paidGames = new Set<number>();

/**
 * Çipli masa bittiyse ödülü BİR KEZ öder. Önce "ödendi" işareti kaydedilir,
 * sonra çip eklenir; aynı oyun için tekrar çağrılırsa (React'in çift
 * çağrısı, sayfa yenileme vb.) ikinci kez ödeme yapılmaz.
 */
function settle(saved: SavedGame): SavedGame {
  const table = tableById(saved.tableId);
  if (!table || saved.settled || saved.state.phase !== "gameOver") return saved;
  const stored = loadGame();
  if (paidGames.has(saved.state.seed) || (stored?.settled && stored.state.seed === saved.state.seed)) {
    return { ...saved, settled: true, payout: stored?.payout ?? saved.payout };
  }
  const colorWins = colorWinsOf(saved.state, 0);
  const amount = payout(table, totals(saved.state), 0, colorWins);
  const next = { ...saved, settled: true, payout: amount };
  paidGames.add(saved.state.seed);
  saveGame(next);
  if (amount > 0) wallet.add(amount, "masa-odul", table.id);
  return next;
}


export function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  setUiLang(settings.uiLang);

  const [screen, setScreen] = useState<Screen>("hub");
  /** Mağazadan geri dönülecek ekran (oyundan açılınca oyuna döner). */
  const [shopBack, setShopBack] = useState<Screen>("hub");
  /** İzlenen arkadaş masası. */
  const [watchId, setWatchId] = useState<string | null>(null);
  /** Bekleme masasındaki (oyun başlamadan önce) masa. */
  const [lobbyTable, setLobbyTable] = useState<TableConfig | null>(null);
  // Açılış ekranı (dokunmadan tam ekran/müzik başlatılamaz)
  const [started, setStarted] = useState(false);
  const [saved, setSaved] = useState<SavedGame | null>(() => {
    const g = loadGame();
    return g ? settle(g) : null;
  });
  const [dict, setDict] = useState<Dictionary | null>(null);
  const [loadError, setLoadError] = useState(false);
  /** Çevrimiçi modda oturulan masa (menüden dönülebilir). */
  const [online, setOnline] = useState<OnlineEntry | null>(null);

  // Davet linki: ...#join=KOD
  useEffect(() => {
    if (!CLOUD) return;
    const m = location.hash.match(/join=([A-Za-z0-9]{6})/);
    if (!m) return;
    history.replaceState(null, "", location.pathname + location.search);
    setOnline({ kind: "join", code: m[1].toUpperCase() });
    setScreen("online");
  }, []);

  // Sunucu modu: oturum aç, cüzdanı başlat, yarım kalan masa varsa hatırla
  // Sunucu kurulduysa cihazda bekleyen şikâyet/öneri mesajlarını ilet
  useEffect(() => {
    void flushFeedback();
  }, []);

  useEffect(() => {
    if (!CLOUD) return;
    wallet.start?.(settings.name);
    currentUser()
      .then(async (u) => {
        const active = (await getDoc(doc(firestore(), "users", u.uid))).data()?.activeTable as string | undefined;
        if (!active) return;
        const tb = (await getDoc(doc(firestore(), "tables", active))).data();
        const cfg = tb && (tb.status === "waiting" || tb.status === "playing") ? tableById(tb.type) : undefined;
        if (cfg) setOnline((prev) => prev ?? { kind: "public", table: cfg });
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Oyun dili: süren bir oyun varsa onun dili, yoksa ayardaki kelime dili.
  const activeLang: LangCode = saved?.state.lang ?? settings.gameLang;
  setGameLang(activeLang);

  useEffect(() => {
    let alive = true;
    setLoadError(false);
    loadDictionary(activeLang)
      .then((d) => alive && setDict(d))
      .catch(() => alive && setLoadError(true));
    return () => {
      alive = false;
    };
  }, [activeLang]);

  const changeSettings = (s: Settings) => {
    setSettings(s);
    saveSettings(s);
  };

  const update = useCallback((s: GameState) => {
    setSaved((prev) => {
      if (!prev) return prev;
      const next = settle({ ...prev, state: s });
      recordProgress(next.state, next.payout);
      saveGame(next);
      return next;
    });
  }, []);

  const startGame = (s: Settings, table?: TableConfig) => {
    setGameLang(s.gameLang);
    const names = [s.name || t("defaultName"), ...botNames()];
    // Oyun tek el: taşlarını ilk bitiren olunca oyun biter
    const hands = table?.hands ?? GAME_HANDS;
    const g = newGame(names, [false, true, true, true], hands, Date.now() % 1_000_000);
    const next: SavedGame = {
      version: 2,
      state: g,
      settings: { ...s, level: table?.level ?? s.level, turnSeconds: table ? TABLE_TURN_SECONDS : s.turnSeconds },
      tableId: table?.id,
    };
    setSaved(next);
    saveGame(next);
    setScreen("game");
  };

  const sitAt = (tb: TableConfig) => {
    if (CLOUD) {
      // Giriş ücretini ve masayı sunucu yönetir
      setOnline({ kind: "public", table: tb });
      setScreen("online");
      return;
    }
    if (wallet.snapshot.balance < tb.entry) {
      setShopBack("hub");
      setScreen("shop");
      return;
    }
    // Önce bekleme masası: boş koltuklara davet, süre dolunca bilgisayar oyuncuları
    setLobbyTable(tb);
    setScreen("lobby");
  };

  /** Bekleme masasından oyuna: giriş ücreti şimdi alınır. */
  const startFromLobby = () => {
    const tb = lobbyTable;
    if (!tb || screen !== "lobby") return;
    setLobbyTable(null);
    if (!wallet.spend(tb.entry, "masa-giris", tb.id)) {
      setShopBack("hub");
      setScreen("shop");
      return;
    }
    startGame(settings, tb);
  };

  const finishGame = () => {
    // Oyun bitmeden çıkıldıysa "teslim olma" sayılır
    if (saved) recordQuit(saved.state);
    setSaved(null);
    saveGame(null);
    setScreen("hub");
  };

  const activeTable = tableById(saved?.tableId);
  const inProgress = !!saved && saved.state.phase !== "gameOver";

  // Müzik: menülerde çalar, oyunda susar
  const inGame = screen === "game" || screen === "online";
  // Çevrimiçi durumu (arkadaş listesindeki yeşil nokta)
  useEffect(() => {
    if (started) startHeartbeat(settings.name);
  }, [started, settings.name]);

  useEffect(() => {
    if (!started) return;
    if (settings.music && !inGame) startMusic();
    else stopMusic();
  }, [started, settings.music, inGame]);

  if (!started)
    return (
      <Splash
        onStart={() => {
          void enterFullscreenLandscape();
          if (settings.music) startMusic();
          setStarted(true);
        }}
      />
    );

  const page = renderScreen();
  return (
    <>
      {page}
      <RotateHint />
    </>
  );

  function renderScreen() {
  switch (screen) {
    case "online":
      if (online)
        return (
          <OnlineTable
            entry={online}
            settings={settings}
            onExit={() => setScreen("hub")}
            onDone={() => {
              setOnline(null);
              setScreen("hub");
            }}
          />
        );
      break;
    case "rules":
      return <Rules onBack={() => setScreen("hub")} />;
    case "watch":
      if (!watchId) return null;
      return (
        <Spectator tableId={watchId} name={settings.name || t("defaultName")}
          onLeave={() => { setWatchId(null); setScreen("hub"); }}
          onSeated={(cfg) => { setWatchId(null); setOnline({ kind: "public", table: cfg }); setScreen("online"); }} />
      );
    case "lobby":
      if (!lobbyTable) return null;
      return (
        <TableLobby table={lobbyTable} name={settings.name || t("defaultName")}
          onStart={startFromLobby} onLeave={() => { setLobbyTable(null); setScreen("hub"); }} />
      );
    case "shop":
      return <Shop onBack={() => setScreen(shopBack)} />;
    case "tables":
      return (
        <Tables
          onPick={sitAt}
          onCreatePrivate={(tb) => {
            setOnline({ kind: "create", table: tb });
            setScreen("online");
          }}
          onJoinCode={(code) => {
            setOnline({ kind: "join", code });
            setScreen("online");
          }}
          onShop={() => { setShopBack("hub"); setScreen("shop"); }}
          onBack={() => setScreen("hub")}
        />
      );
    case "practice":
      return (
        <Practice
          settings={settings}
          onBack={() => setScreen("hub")}
          onStart={(s) => {
            changeSettings(s);
            startGame(s);
          }}
        />
      );
    case "game":
      if (saved) {
        if (loadError) return <div className="page"><p>{t("dictError")}</p></div>;
        if (!dict || dict.lang !== saved.state.lang) return <div className="page"><p className="muted">{t("loadingDict")}</p></div>;
        return (
          <Game
            dict={dict}
            state={saved.state}
            level={saved.settings.level}
            speed={settings.speed}
            turnSeconds={saved.tableId ? TABLE_TURN_SECONDS : settings.turnSeconds}
            sound={settings.sound}
            vibration={settings.vibration}
            chatEnabled={settings.chat}
            onChange={update}
            onExit={() => setScreen("hub")}
            onNewGame={finishGame}
            onLeave={finishGame}
            onShop={() => { setShopBack("game"); setScreen("shop"); }}
            tableName={activeTable ? t("tableTitle", { name: t(`table_${activeTable.id}` as "table_vip") }) : undefined}
            payout={saved.payout}
          />
        );
      }
  }
  return (
    <Hub
      onWatch={CLOUD ? (id) => { setWatchId(id); setScreen("watch"); } : undefined}
      settings={settings}
      onSettings={changeSettings}
      canResume={!!saved || !!online}
      resumeLabel={
        online
          ? online.kind === "join"
            ? t("privateTable")
            : t("resumeTable", { name: t(`table_${online.table.id}` as "table_vip") })
          : inProgress
          ? activeTable
            ? t("resumeTable", { name: t(`table_${activeTable.id}` as "table_vip") })
            : t("resumeGame")
          : t("seeResult")
      }
      onResume={() => setScreen(online ? "online" : "game")}
      onTables={() => setScreen("tables")}
      onPractice={() => setScreen("practice")}
      onShop={() => { setShopBack("hub"); setScreen("shop"); }}
      onRules={() => setScreen("rules")}
    />
  );
  }
}
