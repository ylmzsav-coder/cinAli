import type { TableConfig } from "../economy/tables";
import { t } from "../i18n";
import type { myRate } from "../stats";

/** Başarı oranı şartını karşılamayan oyuncuya gösterilen uyarı (Sosyete %76, Fifty Cent %50, Çarli %31). */
export function rateBlockMessage(tb: TableConfig, me: ReturnType<typeof myRate>): { title: string; text: string } {
  const p = { need: tb.minRate ?? 0, rate: me.rate, won: me.won, played: me.played };
  if (tb.id.startsWith("ozel")) return { title: t("rateBlockTitleOzel"), text: t("rateBlockTextOzel", p) };
  if (tb.id.startsWith("carli")) return { title: t("rateBlockTitleCarli"), text: t("rateBlockTextCarli", p) };
  return { title: t("rateBlockTitle"), text: t("rateBlockText", p) };
}
