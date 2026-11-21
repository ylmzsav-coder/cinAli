import { useCallback, useEffect, useState } from "react";
import { Dictionary } from "./game/dictionary";
import { GameState, newGame } from "./game/engine";
import { Settings, loadGame, loadSettings, saveGame, saveSettings } from "./storage";
import { Game } from "./ui/Game";
import { Menu } from "./ui/Menu";
import { Rules } from "./ui/Rules";

const BOT_NAMES = ["Ayşe", "Mehmet", "Zeynep"];

export function App() {
  const [dict, setDict] = useState<Dictionary | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [screen, setScreen] = useState<"menu" | "game" | "rules">("menu");
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [game, setGame] = useState<GameState | null>(() => loadGame()?.state ?? null);

  useEffect(() => {
    fetch("./kelimeler.txt")
      .then((r) => (r.ok ? r.text() : Promise.reject(r.status)))
      .then((t) => setDict(Dictionary.fromText(t)))
      .catch(() => setLoadError(true));
  }, []);

  const update = useCallback(
    (s: GameState) => {
      setGame(s);
      saveGame(s.phase === "gameOver" ? null : { version: 1, state: s, settings });
    },
    [settings],
  );

  const start = (s: Settings) => {
    setSettings(s);
    saveSettings(s);
    const g = newGame([s.name, ...BOT_NAMES], [false, true, true, true], s.hands, Date.now() % 1_000_000);
    setGame(g);
    saveGame({ version: 1, state: g, settings: s });
    setScreen("game");
  };

  if (loadError) return <div className="page"><p>Sözlük yüklenemedi. İnternet bağlantınızı kontrol edip sayfayı yenileyin.</p></div>;
  if (!dict) return <div className="page"><p className="muted">Sözlük yükleniyor…</p></div>;

  if (screen === "rules") return <Rules onBack={() => setScreen(game ? "game" : "menu")} />;
  if (screen === "game" && game)
    return (
      <Game
        dict={dict}
        state={game}
        level={settings.level}
        speed={settings.speed}
        onChange={update}
        onExit={() => setScreen("menu")}
        onNewGame={() => setScreen("menu")}
      />
    );
  return (
    <Menu
      settings={settings}
      canResume={!!game && game.phase !== "gameOver"}
      onStart={start}
      onResume={() => setScreen("game")}
      onRules={() => setScreen("rules")}
    />
  );
}
