import { SETTINGS_EVENT } from "./ui/Profile";
import { BACK_EVENT, setupBackButton } from "./backButton";
import { useCallback, useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { PLAYERS_PER_TABLE, TableConfig, noWinnerGame, payout, tableById, winnerPrize } from "./economy/tables";
import { wallet } from "./economy/wallet";
import { Dictionary } from "./game/dictionary";
import { GAME_HANDS, GameState, colorWinsOf, newGame, totals } from "./game/engine";
import { LangCode, setGameLang } from "./game/lang";
import { CLOUD, currentUser, firestore } from "./online/cloud";
import { loadDictionary } from "./online/dicts";
import { botNames, setUiLang, t } from "./i18n";
import { type Gender, SavedGame, Settings, TABLE_TURN_SECONDS, loadGame, loadSettings, saveGame, saveSettings } from "./storage";
import { Game } from "./ui/Game";
import { Hub, Practice } from "./ui/Menu";
import { RotateHint, Splash } from "./ui/Splash";
import type { TwoMode } from "./ui/TwoPlayer";
import { enterFullscreenLandscape } from "./display";
import { startMusic, stopMusic } from "./music";
import { flushFeedback } from "./feedbackBox";
import { recordProgress, recordQuit } from "./stats";
import { OnlineTable, type OnlineEntry } from "./ui/OnlineTable";
import { Terms } from "./ui/Terms";
import { Admin } from "./ui/Admin";
import { Rules } from "./ui/Rules";
import { TableLobby } from "./ui/Lobby";
import { startHeartbeat } from "./online/social";
import { Shop } from "./ui/Shop";
import { Tables } from "./ui/Tables";

type Screen = "hub" | "practice" | "tables" | "shop" | "rules" | "game" | "online" | "lobby" | "terms" | "privacy" | "community" | "licenses" | "admin";

const paidGames = new Set<number>();

/**
 * Çipli masa bittiyse ödülü BİR KEZ öder. Önce "ödendi" işareti kaydedilir,
 * sonra çip eklenir; aynı oyun için tekrar çağrılırsa (React'in çift
 * çağrısı, sayfa yenileme vb.) ikinci kez ödeme yapılmaz.
 */
/** Oyunun kendi fiyatıyla masa: oyun başladığındaki giriş ücreti ve ödül geçerlidir. */
function tableOf(saved: SavedGame | null): TableConfig | undefined {
  const tb = tableById(saved?.tableId);
  if (!tb || !saved) return tb;
  return { ...tb, entry: saved.entry ?? tb.entry, prize: saved.prize ?? tb.prize };
}

/** Sosyete fiyatları değişmeden önce başlamış oyunlar eski fiyatla biter. */
const OLD_SOSYETE: Record<string, [number, number]> = { usta: [500, 2_000], usta5: [5_000, 20_000] };

function settle(saved: SavedGame): SavedGame {
  const table = tableOf(saved);
  if (!table || saved.settled || saved.state.phase !== "gameOver") return saved;
  const stored = loadGame();
  if (paidGames.has(saved.state.seed) || (stored?.settled && stored.state.seed === saved.state.seed)) {
    return { ...saved, settled: true, payout: stored?.payout ?? saved.payout };
  }
  // Kimse bitiremedi: ödeme yok, giriş ücreti yeni oyunda kullanılır (çıkarsa iade edilir)
  if (noWinnerGame(saved.state)) {
    const next = { ...saved, settled: true, payout: 0, carry: true };
    paidGames.add(saved.state.seed);
    saveGame(next);
    return next;
  }
  const colorWins = colorWinsOf(saved.state, 0);
  const amount = payout(table, totals(saved.state), 0, colorWins);
  const next = { ...saved, settled: true, payout: amount };
  paidGames.add(saved.state.seed);
  saveGame(next);
  if (amount > 0) wallet.add(amount, "masa-odul", table.id);
  return next;
}


/** Oturum içinde açılış ekranı geçildi mi (yenilemede menüye dönmek için). */
const STARTED_KEY = "wordokey.started";

export function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  setUiLang(settings.uiLang);

  const [screen, setScreen] = useState<Screen>("hub");
  /** Mağazadan geri dönülecek ekran (oyundan açılınca oyuna döner). */
  const [shopBack, setShopBack] = useState<Screen>("hub");
  /** İzlenen arkadaş masası. */
  /** Bekleme masasındaki (oyun başlamadan önce) masa. */
  const [lobbyTable, setLobbyTable] = useState<TableConfig | null>(null);
  /** VIP bekleme masasında aranan rakip cinsiyeti (cihazda bilgisayar rakibin adı buna göre). */
  const [lobbyWant, setLobbyWant] = useState<Gender | null>(null);
  // Açılış ekranı (dokunmadan tam ekran/müzik başlatılamaz)
  // Aynı oturumda sayfa yenilenirse (ör. yeni sürüm yüklenince) açılışa geri dönülmez
  const [started, setStarted] = useState(() => {
    try {
      return sessionStorage.getItem(STARTED_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [saved, setSaved] = useState<SavedGame | null>(() => {
    let g = loadGame();
    // Fiyatı kayıtlı olmayan (güncellemeden önce başlamış) Sosyete oyunu eski fiyatla biter
    if (g?.tableId && g.entry === undefined && OLD_SOSYETE[g.tableId] && !(g.settled && !g.carry)) {
      const [entry, prize] = OLD_SOSYETE[g.tableId];
      g = { ...g, entry, prize };
      saveGame(g);
    }
    // Eski sürümün hatası: 4 kişilik masada (Çayhane, Sosyete) 2 kişilik başlamış, bitmemiş oyun
    // silinir ve giriş ücreti iade edilir; masaya yeniden oturulunca 4 kişilik başlar.
    const tb = tableById(g?.tableId);
    if (g && tb && g.state.phase !== "gameOver" && g.state.players.length !== (tb.players ?? PLAYERS_PER_TABLE)) {
      wallet.add(g.entry ?? tb.entry, "iade", tb.id);
      saveGame(null);
      return null;
    }
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

  // Sunucu modu: oturum aç, kumbarayı başlat, yarım kalan masa varsa hatırla
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

  // Oyun masasındaki profil kartından değişen ayarlar
  useEffect(() => {
    const onChange = () => setSettings(loadSettings());
    window.addEventListener(SETTINGS_EVENT, onChange);
    return () => window.removeEventListener(SETTINGS_EVENT, onChange);
  }, []);
  const changeSettings = (s: Settings) => {
    setSettings(s);
    saveSettings(s);
  };

  const update = useCallback((s: GameState) => {
    setSaved((prev) => {
      if (!prev) return prev;
      const next = settle({ ...prev, state: s });
      // Pratik (çipsiz) masa eğitim amaçlıdır: istatistik kartına işlenmez
      if (next.tableId) recordProgress(next.state, next.payout);
      saveGame(next);
      return next;
    });
  }, []);

  const startGame = (s: Settings, table?: TableConfig, want?: Gender) => {
    setGameLang(s.gameLang);
    // Pratik (çipsiz) iki kişilik; çipli masalarda masanın oyuncu sayısı (belirtilmemişse 4: Çayhane, Sosyete)
    const size = table ? table.players ?? PLAYERS_PER_TABLE : 2;
    // İki kişilik VIP odada bilgisayar rakip aranan cinsiyette (bot adları: kadın, erkek, kadın)
    const bots = size === 2 && want ? [botNames()[want === "kadin" ? 0 : 1]] : botNames();
    const names = [s.name || t("defaultName"), ...bots].slice(0, size);
    // Oyun tek el: taşlarını ilk bitiren olunca oyun biter
    const hands = table?.hands ?? GAME_HANDS;
    const g = newGame(names, names.map((_, i) => i > 0), hands, Date.now() % 1_000_000, table?.minWord);
    const next: SavedGame = {
      version: 2,
      state: g,
      settings: { ...s, level: table?.level ?? s.level, turnSeconds: table ? TABLE_TURN_SECONDS : s.turnSeconds },
      tableId: table?.id,
      ...(table ? { entry: table.entry, prize: winnerPrize(table) } : {}),
    };
    setSaved(next);
    saveGame(next);
    setScreen("game");
  };

  const [shopNotice, setShopNotice] = useState<string | null>(null);
  const sitAt = (tb: TableConfig, want?: Gender) => {
    // VIP oda yalnızca abonelere (Masalar sayfası da kontrol eder)
    if (tb.vip && !wallet.isVip()) return;
    if (CLOUD) {
      // Giriş ücretini ve masayı sunucu yönetir
      setOnline({ kind: "public", table: tb, want });
      setScreen("online");
      return;
    }
    if (wallet.snapshot.balance < tb.entry) {
      setShopNotice(t("needChipsTable", { table: t(`table_${tb.id}` as "table_vip"), need: tb.entry.toLocaleString(), have: wallet.snapshot.balance.toLocaleString() }));
      setShopBack("hub");
      setScreen("shop");
      return;
    }
    // Önce bekleme masası: boş koltuklara davet, süre dolunca bilgisayar oyuncuları
    setLobbyTable(tb);
    setLobbyWant(want ?? null);
    setScreen("lobby");
  };

  /** İki kişilik oda (Özel Oda / VIP): rastgele oyuncu, arkadaşla ya da bilgisayara karşı. */
  const playTwo = (tb: TableConfig, mode: TwoMode) => {
    if (tb.vip && !wallet.isVip()) return;
    if (mode === "random") return sitAt(tb);
    if (mode === "friend") {
      if (!CLOUD) return sitAt(tb); // bekleme masasında "+ DAVET ET"
      setOnline({ kind: "create", table: tb });
      setScreen("online");
      return;
    }
    // Bilgisayara karşı: beklemeden başlar
    if (CLOUD) {
      setOnline({ kind: "public", table: tb, bot: true });
      setScreen("online");
      return;
    }
    if (!wallet.spend(tb.entry, "masa-giris", tb.id)) {
      setShopBack("hub");
      setScreen("shop");
      return;
    }
    startGame(settings, tb);
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
    startGame(settings, tb, lobbyWant ?? undefined);
  };

  /** Kimse bitiremedi: aynı masada ücretsiz yeni oyun (giriş ücreti aktarılır). */
  const replayCarry = () => {
    const tb = tableOf(saved);
    if (!saved?.carry || !tb) return;
    saveGame(null);
    // Aktarılan ücret eski fiyattansa yeni oyun da o fiyatla oynanır
    startGame(settings, tb);
  };
  /** Kimse bitiremedi ve masadan çıkılıyor: giriş ücreti kesintisiz iade. */
  const leaveCarry = () => {
    const tb = tableOf(saved);
    if (saved?.carry && tb) wallet.add(tb.entry, "iade", tb.id);
    setSaved(null);
    saveGame(null);
    setScreen("hub");
  };

  const finishGame = () => {
    if (saved?.carry) return leaveCarry();
    // Çipli masada oyun bitmeden çıkılırsa yenilgi sayılır (Pratik masa işlenmez)
    if (saved?.tableId) recordQuit(saved.state);
    setSaved(null);
    saveGame(null);
    setScreen("hub");
  };

  const activeTable = tableOf(saved);
  const inProgress = !!saved && saved.state.phase !== "gameOver";

  // Müzik: menülerde çalar, oyunda susar
  const inGame = screen === "game" || screen === "online";
  // Android geri tuşu: oyunda Game, menüde Hub karşılar; diğer ekranlar menüye döner
  useEffect(() => {
    void setupBackButton();
  }, []);
  useEffect(() => {
    const onBack = () => {
      if (screen === "game" || screen === "online" || screen === "hub") return;
      if (screen === "licenses") setScreen("rules");
      else setScreen("hub");
    };
    window.addEventListener(BACK_EVENT, onBack);
    return () => window.removeEventListener(BACK_EVENT, onBack);
  }, [screen]);
  // Çevrimiçi durumu (arkadaş listesindeki yeşil nokta)
  useEffect(() => {
    if (started) startHeartbeat(settings.name, settings.invites !== false);
  }, [started, settings.name, settings.invites]);

  // Yenilemeden sonra tam ekran ve müzik ilk dokunuşta geri gelir (tarayıcı dokunuş ister)
  useEffect(() => {
    if (!started) return;
    const once = () => {
      void enterFullscreenLandscape();
      window.removeEventListener("pointerdown", once);
    };
    if (!document.fullscreenElement) window.addEventListener("pointerdown", once);
    return () => window.removeEventListener("pointerdown", once);
  }, [started]);

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
          try {
            sessionStorage.setItem(STARTED_KEY, "1");
          } catch {
            /* yok say */
          }
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
            onChat={(on, priv) => changeSettings(priv ? { ...settings, chatInvite: on } : { ...settings, chat: on })}
            onExit={() => setScreen("hub")}
            onDone={() => {
              setOnline(null);
              setScreen("hub");
            }}
          />
        );
      break;
    case "rules":
      return <Rules onBack={() => setScreen("hub")} onLicenses={() => setScreen("licenses")} />;
    case "admin":
      return <Admin onBack={() => setScreen("hub")} />;
    case "terms":
      return <Terms onBack={() => setScreen("hub")} />;
    case "licenses":
      return <Terms kind="licenses" onBack={() => setScreen("rules")} />;
    case "community":
      return <Terms kind="community" onBack={() => setScreen("hub")} />;
    case "privacy":
      return <Terms kind="privacy" onBack={() => setScreen("hub")} />;
    case "lobby":
      if (!lobbyTable) return null;
      return (
        <TableLobby table={lobbyTable} name={settings.name || t("defaultName")} want={lobbyWant ?? undefined}
          onStart={startFromLobby} onLeave={() => { setLobbyTable(null); setScreen("hub"); }} />
      );
    case "shop":
      return <Shop notice={shopNotice} onBack={() => { setShopNotice(null); setScreen(shopBack); }} />;
    case "tables":
      return (
        <Tables
          onPick={sitAt}
          onTwo={playTwo}
          gender={settings.gender}
          onGender={(g) => changeSettings({ ...settings, gender: g })}
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
            vipSeats={[wallet.isVip()]}
            level={saved.settings.level}
            speed={settings.speed}
            turnSeconds={activeTable?.vip ? 0 : saved.tableId ? TABLE_TURN_SECONDS : settings.turnSeconds}
            sound={settings.sound}
            vibration={settings.vibration}
            chatEnabled={settings.chat}
            onChatEnabled={(on) => changeSettings({ ...settings, chat: on })}
            chatRoom={!!activeTable?.vip}
            onChange={update}
            onExit={() => setScreen("hub")}
            onNewGame={finishGame}
            carry={saved.carry ? { entry: activeTable?.entry ?? 0, onReplay: replayCarry, onLeave: leaveCarry } : undefined}
            onLeave={finishGame}
            onShop={() => { setShopBack("game"); setScreen("shop"); }}
            tableName={activeTable ? t(`table_${activeTable.id}` as "table_vip") : undefined} tableId={activeTable?.id} prize={activeTable ? winnerPrize(activeTable) : 0}
            payout={saved.payout}
          />
        );
      }
  }
  return (
    <Hub
      onJoinInvite={CLOUD ? (code) => { setOnline({ kind: "join", code }); setScreen("online"); } : undefined}
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
      onSitTable={(tb, want) => sitAt(tb, want)}
      onTwo={playTwo}
      onPractice={() => setScreen("practice")}
      onShop={() => { setShopBack("hub"); setScreen("shop"); }}
      onRules={() => setScreen("rules")}
      onTerms={() => setScreen("terms")}
      onPrivacy={() => setScreen("privacy")}
      onCommunity={() => setScreen("community")}
      onAdmin={() => setScreen("admin")}
    />
  );
  }
}
