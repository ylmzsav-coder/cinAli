/** Çip ekonomisi sabitleri: istemci ve sunucu (functions/) aynı değerleri kullanır. */
/** Masa giriş ücreti ve birinciye ödenen çip. */
export const TABLE_ENTRY = 100;
export const TABLE_PRIZE = 400;
/** Usta masa: giriş ve birinciye ödül. */
export const USTA_ENTRY = 500;
export const USTA_PRIZE = 1_500;
/** Özel oda (2 kişi, herkese açık): giriş ve kazanana ödül. */
export const OZEL_ENTRY = 100;
export const OZEL_PRIZE = 300;
/** Özel Oda yüksek giriş: giriş 300, kazanana 900. */
export const OZEL_USTA_ENTRY = 300;
export const OZEL_USTA_PRIZE = 900;
/** VIP Usta oda (2 kişi): giriş ve kazanana ödül. */
export const VIP_USTA_ENTRY = 500;
export const VIP_USTA_PRIZE = 1_500;
/** Yeni oyuncuya hoş geldin hediyesi: 5 oyunluk çip. */
export const WELCOME_GAMES = 5;
export const WELCOME_CHIPS = 500;
export const DAILY_BONUS = 100;
/** VIP abonelik: haftalık, abone olana hediye çip; VIP masa yalnızca abonelere açık. */
export const VIP_BONUS_CHIPS = 1_000;
export const VIP_DAYS = 7;
export const VIP_MS = VIP_DAYS * 86_400_000;
/** VIP iki kişilik masa: giriş ve birinciye ödenen çip. */
export const VIP_ENTRY = 100;
export const VIP_PRIZE = 300;
/** Çipi biten oyuncuya hediye: bakiye masa girişinin altına düşünce 12 saat sonra. */
export const REFILL_CHIPS = 300;
export const REFILL_HOURS = 12;
export const REFILL_BELOW = TABLE_ENTRY;
export const REFILL_MS = REFILL_HOURS * 3_600_000;
/** Bakiyeye göre "çipi bitti" zamanını günceller (yeterliyse null, yeni bittiyse şimdi). */
export const nextBrokeSince = (balance: number, prev: number | null | undefined, now = Date.now()): number | null =>
  balance >= REFILL_BELOW ? null : prev ?? now;
export const AD_REWARD = 50;
export const AD_DAILY_LIMIT = 5;

export type TxReason = "hosgeldin" | "gunluk" | "reklam" | "satin-alma" | "masa-giris" | "masa-odul" | "iade" | "destek" | "el-bonus" | "vip" | "hediye-gonder" | "hediye-cip";

/** UTC gününe göre anahtar (günlük ödül ve reklam sınırı için). */
export const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);
