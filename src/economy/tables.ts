import type { BotLevel } from "../game/bot";
import { CARLI_ENTRY, CARLI_PRIZE, CARLI_ORTA_ENTRY, CARLI_ORTA_PRIZE, CARLI_BUYUK_ENTRY, CARLI_BUYUK_PRIZE, TABLE_TURN_SECONDS, VIP_TURN_SECONDS, TABLE_ENTRY, TABLE_PRIZE, USTA_ENTRY, USTA_PRIZE, SOSYETE_ORTA_ENTRY, SOSYETE_ORTA_PRIZE, SOSYETE_BUYUK_ENTRY, SOSYETE_BUYUK_PRIZE, VIP_USTA_ENTRY, VIP_USTA_PRIZE, VIP_ORTA_ENTRY, VIP_ORTA_PRIZE, OZEL_ENTRY, OZEL_PRIZE, OZEL_USTA_ENTRY, OZEL_USTA_PRIZE, OZEL_BUYUK_ENTRY, OZEL_BUYUK_PRIZE, VIP_ENTRY, VIP_PRIZE } from "./config";

export interface TableConfig {
  id: string;
  name: string;
  entry: number;
  hands: number;
  level: BotLevel;
  /** Birinciye ödenen sabit çip (yoksa pot - kasa payı). */
  prize?: number;
  /** Oyuncu sayısı (varsayılan 4). */
  players?: number;
  /** Yalnızca VIP abonelere açık; izleyici kabul etmez, serbest sohbet var. */
  vip?: boolean;
  /** En kısa kelime (Sosyete profesyonel masa: 3, iki harfli kelime yok). */
  minWord?: number;
  /** Masaya oturmak için gereken en düşük başarı oranı (yüzde). Sosyete: 76. */
  minRate?: number;
  /** Hamle süresi (saniye); verilmezse TABLE_TURN_SECONDS (60). VIP Oda: 180. */
  turnSeconds?: number;
  /** Oyuncular arası serbest sohbet (küfür filtreli). VIP'te abonelikle, Sosyete'de ücretsiz. */
  chat?: boolean;
}

/** Sosyete (profesyonel masa) giriş şartı: başarı oranı en az yüzde 76. */
export const SOSYETE_MIN_RATE = 76;
/** Fifty Cent (eski adı Teke Tek) giriş şartı: başarı oranı en az yüzde 50. */
export const TEKE_TEK_MIN_RATE = 50;
/** Çarli giriş şartı: başarı oranı en az yüzde 31 (altındakiler Çayhane'de oynar). */
export const CARLI_MIN_RATE = 31;

/** Oyuncunun başarı oranı masanın şartını karşılıyor mu. */
export function rateAllows(t: TableConfig, rate: number): boolean {
  return !t.minRate || rate >= t.minRate;
}

/** Başarı oranı (yüzde): kazanılan / oynanan oyun. Hiç oyun yoksa 0. */
export function ratePercent(won: number, played: number): number {
  return played > 0 ? Math.round((won / played) * 100) : 0;
}

/**
 * Bitmiş oyunun oyuncu için sonucu (başarı oranına işlenir): ıstakasını ilk bitiren
 * kazanır, diğerleri kaybeder. Deste bitip kimse bitiremediyse oyun sayılmaz (null).
 */
export function gameOutcome(state: { phase: string; lastResult: { reason: string } | null }, winners: number[], seat: number): "won" | "lost" | null {
  if (state.phase !== "gameOver" || noWinnerGame(state)) return null;
  return winners.includes(seat) ? "won" : "lost";
}

/** Kasa payı: pottan düşülen oran. Çiplerin zamanla erimesini sağlar. */
export const HOUSE_CUT = 0.1;
export const PLAYERS_PER_TABLE = 4;

/** Oynanabilen masalar: Çaylak 100 → 300, Usta 500 → 1.500. */
export const TABLES: TableConfig[] = [
  { id: "caylak", name: "Çayhane", entry: TABLE_ENTRY, hands: 1, level: "orta", prize: TABLE_PRIZE },
  // Çarli: dört kişilik, başarı oranı %31+; iki harfli kelime yok
  { id: "carli", name: "Çarli", entry: CARLI_ENTRY, hands: 1, level: "orta", prize: CARLI_PRIZE, minWord: 3, minRate: CARLI_MIN_RATE },
  { id: "carli2", name: "Çarli 200", entry: CARLI_ORTA_ENTRY, hands: 1, level: "orta", prize: CARLI_ORTA_PRIZE, minWord: 3, minRate: CARLI_MIN_RATE },
  { id: "carli3", name: "Çarli 300", entry: CARLI_BUYUK_ENTRY, hands: 1, level: "orta", prize: CARLI_BUYUK_PRIZE, minWord: 3, minRate: CARLI_MIN_RATE },
  // Sosyete: dört kişilik profesyonel masalar (100 → 400, 1.000 → 4.000, 10.000 → 40.000)
  { id: "usta", name: "Sosyete", entry: USTA_ENTRY, hands: 1, level: "zor", prize: USTA_PRIZE, minWord: 3, minRate: SOSYETE_MIN_RATE, chat: true },
  { id: "usta2", name: "Sosyete 1000", entry: SOSYETE_ORTA_ENTRY, hands: 1, level: "zor", prize: SOSYETE_ORTA_PRIZE, minWord: 3, minRate: SOSYETE_MIN_RATE, chat: true },
  { id: "usta5", name: "Sosyete 10000", entry: SOSYETE_BUYUK_ENTRY, hands: 1, level: "zor", prize: SOSYETE_BUYUK_PRIZE, minWord: 3, minRate: SOSYETE_MIN_RATE, chat: true },
  // Özel oda: herkese açık iki kişilik masa (rastgele oyuncu / arkadaş / bilgisayar).
  // İki harfli kelime yalnızca Çayhane ve Pratik masada geçerli; diğer masalarda en az 3 harf.
  { id: "ozel2", name: "Fifty Cent", entry: OZEL_ENTRY, hands: 1, level: "orta", prize: OZEL_PRIZE, players: 2, minWord: 3, minRate: TEKE_TEK_MIN_RATE },
  { id: "ozel2u", name: "Fifty Cent 1000", entry: OZEL_USTA_ENTRY, hands: 1, level: "zor", prize: OZEL_USTA_PRIZE, players: 2, minWord: 3, minRate: TEKE_TEK_MIN_RATE },
  { id: "ozel2b", name: "Fifty Cent 10000", entry: OZEL_BUYUK_ENTRY, hands: 1, level: "zor", prize: OZEL_BUYUK_PRIZE, players: 2, minWord: 3, minRate: TEKE_TEK_MIN_RATE },
  // VIP iki kişilik özel oda: karşılıklı, yalnızca VIP aboneler
  { id: "vip2", name: "VIP", entry: VIP_ENTRY, hands: 1, level: "zor", prize: VIP_PRIZE, players: 2, vip: true, minWord: 3, turnSeconds: VIP_TURN_SECONDS },
  // VIP Usta: aynı oda, yüksek giriş (VIP kartındaki giriş seçiminden)
];

/** VIP oda türü mü (serbest sohbet, izleyici yok, süre yok). */
/** Masanın hamle süresi (saniye): VIP Oda 180, diğer çipli masalar 60. */
export function turnSecondsFor(t: TableConfig): number {
  return t.turnSeconds ?? TABLE_TURN_SECONDS;
}

export const isVipType = (type: string | undefined) => !!tableById(type)?.vip;

/** Oyuncular arası serbest sohbet açık mı: VIP Oda ve Sosyete (küfür filtreli). */
export const isChatType = (type: string | undefined) => { const tb = tableById(type); return !!(tb?.vip || tb?.chat); };

/** Eski masalar: yalnızca önceki sürümde başlamış oyunların ödemesi için. */
const LEGACY_TABLES: TableConfig[] = [
  { id: "sampiyon", name: "Şampiyon", entry: 10_000, hands: 5, level: "zor" },
  { id: "vip", name: "VIP", entry: 50_000, hands: 5, level: "zor" },
  // VIP Oda artık tek masa (100 → 200): sohbet ve sakin oyun için. Eski seçenekler yalnızca sürmekte olan oyunlar için.
  { id: "vip2m", name: "VIP 250", entry: VIP_ORTA_ENTRY, hands: 1, level: "zor", prize: VIP_ORTA_PRIZE, players: 2, vip: true, minWord: 3, turnSeconds: VIP_TURN_SECONDS },
  { id: "vip2u", name: "VIP 500", entry: VIP_USTA_ENTRY, hands: 1, level: "zor", prize: VIP_USTA_PRIZE, players: 2, vip: true, minWord: 3, turnSeconds: VIP_TURN_SECONDS },
];

export function tableById(id: string | undefined): TableConfig | undefined {
  return TABLES.find((t) => t.id === id) ?? LEGACY_TABLES.find((t) => t.id === id);
}

/** Birinciye ödenen tutar. */
export function winnerPrize(t: TableConfig): number {
  return t.prize ?? Math.floor(t.entry * (t.players ?? PLAYERS_PER_TABLE) * (1 - HOUSE_CUT));
}

/**
 * Oyun sonunda oyuncuya ödenecek çip.
 * Kazanan, ıstakasındaki taşları ilk bitiren oyuncudur (winners: gameWinners); ödülü o alır.
 * Puan sıralaması ödülü belirlemez. Oyuncunun yaptığı her Renk Bitirme için giriş ücreti
 * kadar ikramiye eklenir.
 */
export function payout(t: TableConfig, winners: number[], me: number, colorWins: number): number {
  const prize = winners.includes(me) ? Math.floor(winnerPrize(t) / winners.length) : 0;
  return prize + colorWins * t.entry;
}

export { formatNumber as formatChips } from "../i18n";

/**
 * Kimse bitiremedi (deste bitti): çipli masada kaybeden yoktur, ödül verilmez.
 * Giriş ücreti yeni oyunda kullanılır; oyuncu masadan çıkarsa kesintisiz iade edilir.
 */
export function noWinnerGame(state: { phase: string; lastResult: { reason: string } | null }): boolean {
  return state.phase === "gameOver" && state.lastResult?.reason === "deckEmpty";
}
