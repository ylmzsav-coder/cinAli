import type { BotLevel } from "./game/bot";
import type { GameState } from "./game/engine";

export interface Settings {
  name: string;
  hands: number;
  level: BotLevel;
  speed: "yavas" | "normal" | "hizli";
}

export const DEFAULT_SETTINGS: Settings = { name: "Sen", hands: 5, level: "orta", speed: "normal" };

const KEY_SETTINGS = "cinali.settings";
const KEY_GAME = "cinali.game";

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* depolama kullanılamıyor; oyun yine de çalışır */
  }
}

export const loadSettings = (): Settings => ({ ...DEFAULT_SETTINGS, ...(read<Settings>(KEY_SETTINGS) ?? {}) });
export const saveSettings = (s: Settings) => write(KEY_SETTINGS, s);

export interface SavedGame {
  version: 1;
  state: GameState;
  settings: Settings;
}

export const loadGame = (): SavedGame | null => {
  const g = read<SavedGame>(KEY_GAME);
  return g && g.version === 1 && typeof g.state?.turnPlays === "number" ? g : null;
};
export const saveGame = (g: SavedGame | null) => write(KEY_GAME, g);
