import { giftById } from "../economy/gifts";

/**
 * Hediye simgesi (emoji). Özel çizim gerekirse burada id'ye göre eklenir;
 * ince belli çay bardağı çizimi git geçmişinde (87d3105) duruyor.
 */
export function GiftIcon({ id, size = "1em" }: { id: string; size?: string }) {
  return <span className="gift-emoji-inline" style={{ fontSize: size }}>{giftById(id)?.emoji ?? "🎁"}</span>;
}
