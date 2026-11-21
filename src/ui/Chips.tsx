import { formatChips } from "../economy/tables";

export function Chips({ amount, big }: { amount: number; big?: boolean }) {
  return (
    <span className={`chips ${big ? "chips-big" : ""}`}>
      <span className="chip-icon" aria-hidden />
      {formatChips(amount)}
    </span>
  );
}
