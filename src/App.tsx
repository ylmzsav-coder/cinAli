import { useCallback, useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { TableConfig, payout, tableById } from "./economy/tables";
import { wallet } from "./economy/wallet";
import { Dictionary } from "./game/dictionary";
import { GameState, RULES, newGame, totals } from "./game/engine";
import { LangCode, setGameLang } from "./game/lang";
import { CLOUD, currentUser, firestore } from "./online/cloud";
import { loadDictionary } from "./online/dicts";
import { botNames, setUiLang, t } from "./i18n";
import { SavedGame, Settings, TABLE_TURN_SECONDS, loadGame, loadSettings, saveGame, saveSettings } from "./storage";
import { Game } from "./ui/Game";
import { Hub, Practice } from "./ui/Menu";
import { OnlineTable, type OnlineEntry } from "./ui/OnlineTable";
import { Rules } from "./ui/Rules";
import { Shop } from "./ui/Shop";
import { Tables } from "./ui/Tables";

type Screen = "hub" | "practice" | "tables" | "shop" | "rules" | "game" | "online";

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
  const colorWins = saved.state.history.filter((h) => h[0] === RULES.colorWinScore).length;
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
      saveGame(next);
      return next;
    });
  }, []);

  const startGame = (s: Settings, table?: TableConfig) => {
    setGameLang(s.gameLang);
    const names = [s.name || t("defaultName"), ...botNames()];
    const hands = table?.hands ?? s.hands;
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
    if (!wallet.spend(tb.entry, "masa-giris", tb.id)) {
      setScreen("shop");
      return;
    }
    startGame(settings, tb);
  };

  const finishGame = () => {
    setSaved(null);
    saveGame(null);
    setScreen("hub");
  };

  const activeTable = tableById(saved?.tableId);
  const inProgress = !!saved && saved.state.phase !== "gameOver";

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
    case "shop":
      return <Shop onBack={() => setScreen("hub")} />;
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
          onShop={() => setScreen("shop")}
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
            turnSeconds={saved.settings.turnSeconds ?? TABLE_TURN_SECONDS}
            sound={settings.sound}
            vibration={settings.vibration}
            chatEnabled={settings.chat}
            onChange={update}
            onExit={() => setScreen("hub")}
            onNewGame={finishGame}
            tableName={activeTable ? t("tableTitle", { name: t(`table_${activeTable.id}` as "table_vip") }) : undefined}
            payout={saved.payout}
          />
        );
      }
  }
  return (
    <Hub
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
      onShop={() => setScreen("shop")}
      onRules={() => setScreen("rules")}
    />
  );
}
