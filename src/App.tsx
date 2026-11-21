import { useCallback, useEffect, useState } from "react";
import { TableConfig, payout, tableById } from "./economy/tables";
import { wallet } from "./economy/wallet";
import { Dictionary } from "./game/dictionary";
import { GameState, RULES, newGame, totals } from "./game/engine";
import { SavedGame, Settings, loadGame, loadSettings, saveGame, saveSettings } from "./storage";
import { Game } from "./ui/Game";
import { Hub, Practice } from "./ui/Menu";
import { Rules } from "./ui/Rules";
import { Shop } from "./ui/Shop";
import { Tables } from "./ui/Tables";

const BOT_NAMES = ["Ayşe", "Mehmet", "Zeynep"];
type Screen = "hub" | "practice" | "tables" | "shop" | "rules" | "game";

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
  const [dict, setDict] = useState<Dictionary | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [screen, setScreen] = useState<Screen>("hub");
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [saved, setSaved] = useState<SavedGame | null>(() => {
    const g = loadGame();
    return g ? settle(g) : null;
  });

  useEffect(() => {
    fetch("./kelimeler.txt")
      .then((r) => (r.ok ? r.text() : Promise.reject(r.status)))
      .then((t) => setDict(Dictionary.fromText(t)))
      .catch(() => setLoadError(true));
  }, []);

  const update = useCallback((s: GameState) => {
    setSaved((prev) => {
      if (!prev) return prev;
      const next = settle({ ...prev, state: s });
      saveGame(next);
      return next;
    });
  }, []);

  const startGame = (s: Settings, table?: TableConfig) => {
    const names = [s.name, ...BOT_NAMES];
    const hands = table?.hands ?? s.hands;
    const g = newGame(names, [false, true, true, true], hands, Date.now() % 1_000_000);
    const next: SavedGame = { version: 1, state: g, settings: { ...s, level: table?.level ?? s.level }, tableId: table?.id };
    setSaved(next);
    saveGame(next);
    setScreen("game");
  };

  const sitAt = (t: TableConfig) => {
    if (!wallet.spend(t.entry, "masa-giris", t.id)) {
      setScreen("shop");
      return;
    }
    startGame(settings, t);
  };

  const finishGame = () => {
    setSaved(null);
    saveGame(null);
    setScreen("hub");
  };

  if (loadError) return <div className="page"><p>Sözlük yüklenemedi. İnternet bağlantınızı kontrol edip sayfayı yenileyin.</p></div>;
  if (!dict) return <div className="page"><p className="muted">Sözlük yükleniyor…</p></div>;

  const activeTable = tableById(saved?.tableId);
  const inProgress = !!saved && saved.state.phase !== "gameOver";

  switch (screen) {
    case "rules":
      return <Rules onBack={() => setScreen("hub")} />;
    case "shop":
      return <Shop onBack={() => setScreen("hub")} />;
    case "tables":
      return <Tables onPick={sitAt} onShop={() => setScreen("shop")} onBack={() => setScreen("hub")} />;
    case "practice":
      return (
        <Practice
          settings={settings}
          onBack={() => setScreen("hub")}
          onStart={(s) => {
            setSettings(s);
            saveSettings(s);
            startGame(s);
          }}
        />
      );
    case "game":
      if (saved)
        return (
          <Game
            dict={dict}
            state={saved.state}
            level={saved.settings.level}
            speed={settings.speed}
            onChange={update}
            onExit={() => setScreen("hub")}
            onNewGame={finishGame}
            tableName={activeTable ? `${activeTable.name} Masası` : undefined}
            payout={saved.payout}
          />
        );
  }
  return (
    <Hub
      canResume={!!saved}
      resumeLabel={inProgress ? (activeTable ? `${activeTable.name} masasına dön` : "Oyuna devam et") : "Sonucu gör"}
      onResume={() => setScreen("game")}
      onTables={() => setScreen("tables")}
      onPractice={() => setScreen("practice")}
      onShop={() => setScreen("shop")}
      onRules={() => setScreen("rules")}
    />
  );
}
