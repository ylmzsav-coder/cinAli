import { formatChips } from "../economy/tables";

export function Chips({ amount, big, loading }: { amount: number; big?: boolean; loading?: boolean }) {
  return (
    <span className={`chips ${big ? "chips-big" : ""}`}>
      <span className="chip-icon" aria-hidden>🪙</span>
      {loading ? "…" : formatChips(amount)}
    </span>
  );
}
