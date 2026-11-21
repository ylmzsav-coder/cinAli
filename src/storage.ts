import type { BotLevel } from "./game/bot";
import type { GameState } from "./game/engine";
import { LANGS, LangCode, detectLang } from "./game/lang";

export interface Settings {
  /** Boşsa dilin varsayılan adı kullanılır ("Sen", "You"…). */
  name: string;
  hands: number;
  level: BotLevel;
  speed: "yavas" | "normal" | "hizli";
  /** Arayüz dili. */
  uiLang: LangCode;
  /** Kelime oyununun dili (alfabe, taşlar, sözlük). */
  gameLang: LangCode;
  /** Hamle süresi (saniye); 0 = kapalı. */
  turnSeconds: number;
  /** Son saniyelerde tık sesi. */
  sound: boolean;
  /** Son saniyelerde titreşim. */
  vibration: boolean;
  /** Diğer oyuncuların hazır mesaj/emojilerini göster. */
  chat: boolean;
  /** Menülerde giriş müziği. */
  music: boolean;
}

/** Çipli masalarda sabit hamle süresi. */
export const TABLE_TURN_SECONDS = 60;

function deviceLang(): LangCode {
  try {
    return detectLang(navigator.languages ?? [navigator.language]);
  } catch {
    return "en";
  }
}

export function defaultSettings(): Settings {
  const ui = deviceLang();
  return { name: "", hands: 5, level: "orta", speed: "normal", uiLang: ui, gameLang: LANGS[ui].playable ? ui : "en", turnSeconds: 60, sound: true, vibration: true, chat: true, music: true };
}

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

export const loadSettings = (): Settings => {
  const s = { ...defaultSettings(), ...(read<Partial<Settings>>(KEY_SETTINGS) ?? {}) };
  if (!(s.uiLang in LANGS)) s.uiLang = "en";
  if (!LANGS[s.gameLang]?.playable) s.gameLang = "en";
  // Eski sürümlerin varsayılan adı
  if (s.name === "Sen") s.name = "";
  // Eski 30 sn hamle süresi kaldırıldı: 60 sn'ye taşınır ve kalıcı kaydedilir
  if (!(s.turnSeconds >= 45 || s.turnSeconds === 0)) {
    s.turnSeconds = 60;
    write(KEY_SETTINGS, s);
  }
  return s;
};
export const saveSettings = (s: Settings) => write(KEY_SETTINGS, s);

export interface SavedGame {
  version: 2;
  state: GameState;
  settings: Settings;
  /** Çipli masada oynanıyorsa masa kimliği. */
  tableId?: string;
  /** Masa ödülü ödendi mi (iki kez ödenmesin). */
  settled?: boolean;
  /** Ödenen çip (oyun sonu ekranı için). */
  payout?: number;
}

export const loadGame = (): SavedGame | null => {
  const g = read<SavedGame>(KEY_GAME);
  return g && g.version === 2 && typeof g.state?.lang === "string" ? g : null;
};
export const saveGame = (g: SavedGame | null) => write(KEY_GAME, g);
