export type Gender = "erkek" | "kadin";
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
  /** Oyuncunun cinsiyeti (VIP odada bayan/erkek oyuncu eşleşmesi için; kendi beyanı). */
  gender?: Gender;
  /** Hamle süresi (saniye); 0 = kapalı. */
  turnSeconds: number;
  /** Hamle süresi ayarının taşıma sürümü (2 = 45 sn varsayılanı). */
  timerV?: number;
  /** Son saniyelerde tık sesi. */
  sound: boolean;
  /** Son saniyelerde titreşim. */
  vibration: boolean;
  /** Diğer oyuncuların hazır mesaj/emojilerini göster. */
  chat: boolean;
  /** Menülerde giriş müziği. */
  music: boolean;
  /** Profil fotoğrafı gösterilsin mi (kapalıysa baş harf). */
  showPhoto?: boolean;
  /** Arkadaşlardan oyun daveti alınsın mı. */
  invites?: boolean;
  /** Davetle kurulan (özel) masalarda sohbet. `chat` ise rastgele masalardaki sohbettir. */
  chatInvite?: boolean;
}

/** Çipli masalarda sabit hamle süresi. */
export const TABLE_TURN_SECONDS = 45;

function deviceLang(): LangCode {
  try {
    return detectLang(navigator.languages ?? [navigator.language]);
  } catch {
    return "en";
  }
}

export function defaultSettings(): Settings {
  const ui = deviceLang();
  return { name: "", hands: 5, level: "orta", speed: "normal", uiLang: ui, gameLang: LANGS[ui].playable ? ui : "en", turnSeconds: 45, timerV: 2, sound: true, vibration: true, chat: true, music: true, showPhoto: true, invites: true, chatInvite: true };
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
  // Varsayılan hamle süresi 45 sn oldu: eski kayıtlar (30/60 sn) bir kez 45 sn'ye taşınır
  if (s.timerV !== 2) {
    if (s.turnSeconds !== 0) s.turnSeconds = 45;
    s.timerV = 2;
    write(KEY_SETTINGS, s);
  }
  return s;
};
export const saveSettings = (s: Settings) => write(KEY_SETTINGS, s);

export interface SavedGame {
  /** Kimse bitiremedi: giriş ücreti yeni oyuna aktarılır (çıkılırsa iade). */
  carry?: boolean;
  version: 2;
  state: GameState;
  settings: Settings;
  /** Çipli masada oynanıyorsa masa kimliği. */
  tableId?: string;
  /** Oyun başladığındaki giriş ücreti ve birinciye ödül (fiyat değişse de bu oyun eski fiyatla biter). */
  entry?: number;
  prize?: number;
  /** Masa ödülü ödendi mi (iki kez ödenmesin). */
  /** Bonus çipi ödenmiş el sayısı (kazanılan her el için). */
  handChipsPaid?: number;
  settled?: boolean;
  /** Ödenen çip (oyun sonu ekranı için). */
  payout?: number;
}

export const loadGame = (): SavedGame | null => {
  const g = read<SavedGame>(KEY_GAME);
  // Eski puanlama (en düşük kazanır) ile başlamış oyun: puanlar yeni sisteme
  // (en yüksek kazanır) uysun diye işaretleri çevrilir.
  if (g?.state && !g.state.results && g.state.history?.length) {
    g.state.history = g.state.history.map((h) => h.map((v) => -v));
    g.state.results = [];
  }
  return g && g.version === 2 && typeof g.state?.lang === "string" ? g : null;
};
export const saveGame = (g: SavedGame | null) => write(KEY_GAME, g);
