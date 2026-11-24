/** Çip ekonomisi sabitleri: istemci ve sunucu (functions/) aynı değerleri kullanır. */
/** Masa giriş ücreti ve birinciye ödenen çip. */
/** Hamle süresi (saniye): Çayhane, Teke Tek, Sosyete 60 sn; VIP Oda 3 dakika. */
export const TABLE_TURN_SECONDS = 60;
export const VIP_TURN_SECONDS = 180;
export const TABLE_ENTRY = 100;
export const TABLE_PRIZE = 400;
/** Çarli (4 kişi, başarı oranı %31+): 100 → 400, 200 → 800, 300 → 1.200. */
export const CARLI_ENTRY = 100;
export const CARLI_PRIZE = 400;
export const CARLI_ORTA_ENTRY = 200;
export const CARLI_ORTA_PRIZE = 800;
export const CARLI_BUYUK_ENTRY = 300;
export const CARLI_BUYUK_PRIZE = 1_200;
/** Sosyete (ilk masa): giriş ve birinciye ödül. */
export const USTA_ENTRY = 100;
export const USTA_PRIZE = 400;
/** Sosyete büyük masalar: 1.000 → 4.000, 10.000 → 40.000 */
export const SOSYETE_ORTA_ENTRY = 1_000;
export const SOSYETE_ORTA_PRIZE = 4_000;
export const SOSYETE_BUYUK_ENTRY = 10_000;
export const SOSYETE_BUYUK_PRIZE = 40_000;
/** Özel oda (2 kişi, herkese açık): giriş ve kazanana ödül. */
export const OZEL_ENTRY = 100;
export const OZEL_PRIZE = 200;
/** Teke Tek orta giriş: giriş 1.000, kazanana 2.000. */
export const OZEL_USTA_ENTRY = 1_000;
export const OZEL_USTA_PRIZE = 2_000;
/** Teke Tek en yüksek giriş: giriş 10.000, kazanana 20.000. */
export const OZEL_BUYUK_ENTRY = 10_000;
export const OZEL_BUYUK_PRIZE = 20_000;
/** VIP Usta oda (2 kişi): giriş ve kazanana ödül. */
export const VIP_USTA_ENTRY = 500;
export const VIP_USTA_PRIZE = 1_000;
/** VIP orta masa: giriş 250, kazanana 500. */
export const VIP_ORTA_ENTRY = 250;
export const VIP_ORTA_PRIZE = 500;
/** Yeni oyuncuya hoş geldin hediyesi: 5 oyunluk çip. */
export const WELCOME_GAMES = 9;
export const WELCOME_CHIPS = 999;
export const DAILY_BONUS = 100;
/** VIP abonelik: haftalık, abone olana hediye çip; VIP masa yalnızca abonelere açık. */
export const VIP_BONUS_CHIPS = 1_000;
export const VIP_DAYS = 7;
export const VIP_MS = VIP_DAYS * 86_400_000;
/** VIP iki kişilik masa: giriş ve birinciye ödenen çip. */
export const VIP_ENTRY = 100;
export const VIP_PRIZE = 200;
/** Çipi biten oyuncuya hediye: bakiye masa girişinin altına düşünce 12 saat sonra. */
export const REFILL_CHIPS = 100;
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
