import type { BotLevel } from "../game/bot";
import { TABLE_ENTRY, TABLE_PRIZE, USTA_ENTRY, USTA_PRIZE, SOSYETE_ORTA_ENTRY, SOSYETE_ORTA_PRIZE, SOSYETE_BUYUK_ENTRY, SOSYETE_BUYUK_PRIZE, VIP_USTA_ENTRY, VIP_USTA_PRIZE, VIP_ORTA_ENTRY, VIP_ORTA_PRIZE, OZEL_ENTRY, OZEL_PRIZE, OZEL_USTA_ENTRY, OZEL_USTA_PRIZE, OZEL_BUYUK_ENTRY, OZEL_BUYUK_PRIZE, VIP_ENTRY, VIP_PRIZE } from "./config";

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
}

/** Kasa payı: pottan düşülen oran. Çiplerin zamanla erimesini sağlar. */
export const HOUSE_CUT = 0.1;
export const PLAYERS_PER_TABLE = 4;

/** Oynanabilen masalar: Çaylak 100 → 300, Usta 500 → 1.500. */
export const TABLES: TableConfig[] = [
  { id: "caylak", name: "Çayhane", entry: TABLE_ENTRY, hands: 1, level: "orta", prize: TABLE_PRIZE },
  // Usta: yüksek girişli dört kişilik masa (2.000 çiplik pottan 500'ü kasaya)
  { id: "usta", name: "Sosyete", entry: USTA_ENTRY, hands: 1, level: "zor", prize: USTA_PRIZE },
  { id: "usta2", name: "Sosyete 1000", entry: SOSYETE_ORTA_ENTRY, hands: 1, level: "zor", prize: SOSYETE_ORTA_PRIZE },
  { id: "usta5", name: "Sosyete 5000", entry: SOSYETE_BUYUK_ENTRY, hands: 1, level: "zor", prize: SOSYETE_BUYUK_PRIZE },
  // Özel oda: herkese açık iki kişilik masa (rastgele oyuncu / arkadaş / bilgisayar)
  { id: "ozel2", name: "Teke Tek", entry: OZEL_ENTRY, hands: 1, level: "orta", prize: OZEL_PRIZE, players: 2 },
  { id: "ozel2u", name: "Teke Tek 250", entry: OZEL_USTA_ENTRY, hands: 1, level: "zor", prize: OZEL_USTA_PRIZE, players: 2 },
  { id: "ozel2b", name: "Teke Tek 500", entry: OZEL_BUYUK_ENTRY, hands: 1, level: "zor", prize: OZEL_BUYUK_PRIZE, players: 2 },
  // VIP iki kişilik özel oda: karşılıklı, yalnızca VIP aboneler
  { id: "vip2", name: "VIP", entry: VIP_ENTRY, hands: 1, level: "zor", prize: VIP_PRIZE, players: 2, vip: true },
  // VIP Usta: aynı oda, yüksek giriş (VIP kartındaki giriş seçiminden)
  { id: "vip2m", name: "VIP 250", entry: VIP_ORTA_ENTRY, hands: 1, level: "zor", prize: VIP_ORTA_PRIZE, players: 2, vip: true },
  { id: "vip2u", name: "VIP Usta", entry: VIP_USTA_ENTRY, hands: 1, level: "zor", prize: VIP_USTA_PRIZE, players: 2, vip: true },
];

/** VIP oda türü mü (serbest sohbet, izleyici yok, süre yok). */
export const isVipType = (type: string | undefined) => !!TABLES.find((t) => t.id === type)?.vip;

/** Eski masalar: yalnızca önceki sürümde başlamış oyunların ödemesi için. */
const LEGACY_TABLES: TableConfig[] = [
  { id: "sampiyon", name: "Şampiyon", entry: 10_000, hands: 5, level: "zor" },
  { id: "vip", name: "VIP", entry: 50_000, hands: 5, level: "zor" },
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
