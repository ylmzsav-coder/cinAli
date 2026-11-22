import type { BotLevel } from "../game/bot";

export interface TableConfig {
  id: string;
  name: string;
  entry: number;
  hands: number;
  level: BotLevel;
}

/** Kasa payı: pottan düşülen oran. Çiplerin zamanla erimesini sağlar. */
export const HOUSE_CUT = 0.1;
export const PLAYERS_PER_TABLE = 4;

export const TABLES: TableConfig[] = [
  { id: "caylak", name: "Çaylak", entry: 500, hands: 3, level: "kolay" },
  { id: "usta", name: "Usta", entry: 2_000, hands: 3, level: "orta" },
  { id: "sampiyon", name: "Şampiyon", entry: 10_000, hands: 5, level: "zor" },
  { id: "vip", name: "VIP", entry: 50_000, hands: 5, level: "zor" },
];

export function tableById(id: string | undefined): TableConfig | undefined {
  return TABLES.find((t) => t.id === id);
}

/** Birinciye ödenen tutar (pot - kasa payı). */
export function winnerPrize(t: TableConfig): number {
  return Math.floor(t.entry * PLAYERS_PER_TABLE * (1 - HOUSE_CUT));
}

/**
 * Oyun sonunda oyuncuya ödenecek çip.
 * En yüksek toplam puan birinciliktir; eşitlikte ödül paylaşılır.
 * Oyuncunun yaptığı her Renk Bitirme için giriş ücreti kadar ikramiye eklenir.
 * (Kazanılan her el için verilen bonus çip el bitiminde ayrıca ödenir.)
 */
export function payout(t: TableConfig, totals: number[], me: number, colorWins: number): number {
  const max = Math.max(...totals);
  const winners = totals.filter((x) => x === max).length;
  const prize = totals[me] === max ? Math.floor(winnerPrize(t) / winners) : 0;
  return prize + colorWins * t.entry;
}

export { formatNumber as formatChips } from "../i18n";
