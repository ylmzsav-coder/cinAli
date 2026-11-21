/** Çip ekonomisi sabitleri: istemci ve sunucu (functions/) aynı değerleri kullanır. */
/** Yeni oyuncuya hoş geldin hediyesi: en ucuz masada (Çaylak, giriş 500) 3 oyunluk çip. */
export const WELCOME_GAMES = 3;
export const WELCOME_CHIPS = 1_500;
export const DAILY_BONUS = 1_000;
export const AD_REWARD = 300;
export const AD_DAILY_LIMIT = 5;

export type TxReason = "hosgeldin" | "gunluk" | "reklam" | "satin-alma" | "masa-giris" | "masa-odul" | "iade";

/** UTC gününe göre anahtar (günlük ödül ve reklam sınırı için). */
export const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);
