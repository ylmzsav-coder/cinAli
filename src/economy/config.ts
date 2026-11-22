/** Çip ekonomisi sabitleri: istemci ve sunucu (functions/) aynı değerleri kullanır. */
/** Yeni oyuncuya hoş geldin hediyesi: en ucuz masada (Çaylak, giriş 500) 3 oyunluk çip. */
export const WELCOME_GAMES = 3;
export const WELCOME_CHIPS = 1_500;
export const DAILY_BONUS = 1_000;
/** Çipi biten oyuncuya hediye: bakiye en ucuz masa girişinin altına düşünce 12 saat sonra. */
export const REFILL_CHIPS = 1_500;
export const REFILL_HOURS = 12;
export const REFILL_BELOW = 500;
export const REFILL_MS = REFILL_HOURS * 3_600_000;
/** Bakiyeye göre "çipi bitti" zamanını günceller (yeterliyse null, yeni bittiyse şimdi). */
export const nextBrokeSince = (balance: number, prev: number | null | undefined, now = Date.now()): number | null =>
  balance >= REFILL_BELOW ? null : prev ?? now;
export const AD_REWARD = 300;
export const AD_DAILY_LIMIT = 5;

export type TxReason = "hosgeldin" | "gunluk" | "reklam" | "satin-alma" | "masa-giris" | "masa-odul" | "iade" | "destek" | "el-bonus";

/** UTC gününe göre anahtar (günlük ödül ve reklam sınırı için). */
export const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);
