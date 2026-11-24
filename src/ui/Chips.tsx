import type { ReactNode } from "react";
import { formatChips } from "../economy/tables";

export function Chips({ amount, big, loading, icon }: { amount: number; big?: boolean; loading?: boolean; icon?: ReactNode }) {
  return (
    <span className={`chips ${big ? "chips-big" : ""}`}>
      {icon === undefined ? <span className="chip-icon" aria-hidden>🪙</span> : icon}
      {loading ? "…" : formatChips(amount)}
    </span>
  );
}
