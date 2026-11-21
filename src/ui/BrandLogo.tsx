/**
 * Word Okey logosu: üstte renkli taşlar üzerinde "WORD", altında altın sarısı "OKEY".
 */
const LETTERS: [string, string][] = [
  ["W", "#c62828"],
  ["O", "#1565c0"],
  ["R", "#e09100"],
  ["D", "#2e7d32"],
];

export const BRAND = "Word Okey";

export function BrandLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  return (
    <div className={`brand brand-${size}`} role="img" aria-label={BRAND}>
      <div className="brand-word">
        {LETTERS.map(([l, c], i) => (
          <span key={i} className="brand-tile" style={{ color: c }}>
            {l}
          </span>
        ))}
      </div>
      <div className="brand-sub">OKEY</div>
    </div>
  );
}
