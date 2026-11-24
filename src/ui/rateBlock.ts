import type { TableConfig } from "../economy/tables";
import { t } from "../i18n";
import type { myRate } from "../stats";

/** Başarı oranı şartını karşılamayan oyuncuya gösterilen uyarı (Sosyete %76, Teke Tek %50). */
export function rateBlockMessage(tb: TableConfig, me: ReturnType<typeof myRate>): { title: string; text: string } {
  const ozel = tb.id.startsWith("ozel");
  const p = { need: tb.minRate ?? 0, rate: me.rate, won: me.won, played: me.played };
  return { title: t(ozel ? "rateBlockTitleOzel" : "rateBlockTitle"), text: t(ozel ? "rateBlockTextOzel" : "rateBlockText", p) };
}
