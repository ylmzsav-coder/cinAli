/**
 * AlFaBe 101 logosu: harfler sırayla büyük/küçük (A l F a B e), her biri farklı
 * renkte, taş üzerinde; altında "101".
 */
const LETTERS: [string, string][] = [
  ["A", "#c62828"],
  ["l", "#1565c0"],
  ["F", "#e09100"],
  ["a", "#2e7d32"],
  ["B", "#6a1b9a"],
  ["e", "#1d1d1d"],
];

export const BRAND = "AlFaBe 101";

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
      <div className="brand-101">101</div>
    </div>
  );
}
