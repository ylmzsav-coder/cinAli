import { t } from "../i18n";
import { STROKES } from "../strokes";

/** Bir çizgi: [x1, y1, x2, y2]. Harfler 60×80'lik kutuda çizilir. */
type Seg = [number, number, number, number];

/** Örnek kelime ET: E = 1 dikey + 3 yatay (4 hareket), T = 1 yatay + 1 dikey (2 hareket). */
const E_JOINED: Seg[] = [[12, 8, 12, 72], [12, 8, 50, 8], [12, 40, 44, 40], [12, 72, 50, 72]];
const T_JOINED: Seg[] = [[8, 8, 52, 8], [30, 8, 30, 72]];
/** Parça parça: aynı çizgiler aralarında boşlukla (birleşme yerleri ayrık). */
const E_APART: Seg[] = [[6, 8, 6, 72], [20, 8, 54, 8], [20, 40, 48, 40], [20, 72, 54, 72]];
const T_APART: Seg[] = [[6, 8, 54, 8], [30, 22, 30, 74]];
const COLORS = ["#e53935", "#1e88e5", "#43a047", "#fb8c00"];

/** Çizginin ortasının biraz dışında, numara rozeti için konum. */
function badgeAt([x1, y1, x2, y2]: Seg): [number, number] {
  const vertical = x1 === x2;
  return vertical ? [x1 - 0.5, (y1 + y2) / 2] : [(x1 + x2) / 2, y1];
}

function Letter({ segs, numbered, start = 0, label }: { segs: Seg[]; numbered: boolean; start?: number; label: string }) {
  return (
    <svg className="stroke-letter" viewBox="-6 -6 72 92" role="img" aria-label={label}>
      {segs.map((s, i) => (
        <line key={i} x1={s[0]} y1={s[1]} x2={s[2]} y2={s[3]} stroke={numbered ? COLORS[i % COLORS.length] : "#222"}
          strokeWidth={7} strokeLinecap="round" className={numbered ? "stroke-draw" : undefined}
          style={numbered ? { animationDelay: `${(start + i) * 0.45}s` } : undefined} pathLength={1} />
      ))}
      {numbered && segs.map((s, i) => {
        const [x, y] = badgeAt(s);
        return (
          <g key={`n${i}`} className="stroke-num" style={{ animationDelay: `${(start + i) * 0.45 + 0.3}s` }}>
            <circle cx={x} cy={y} r={8} fill="#fff" stroke={COLORS[i % COLORS.length]} strokeWidth={2.5} />
            <text x={x} y={y + 4} textAnchor="middle" fontSize={11} fontWeight={800} fill="#111">{start + i + 1}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** "Nasıl sayılır?" kartı: ET kelimesi çizgi çizgi ve bütün harflerin hareket sayıları. */
export function StrokeDemo() {
  const groups = new Map<number, string[]>();
  for (const [l, n] of Object.entries(STROKES)) {
    if ("QWX".includes(l)) continue; // Türk alfabesinde yok
    groups.set(n, [...(groups.get(n) ?? []), l]);
  }
  const order = "ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ";
  return (
    <section className="stroke-demo" aria-label={t("strokeHowTitle")}>
      <h3 className="wordnum-h">✏️ {t("strokeHowTitle")}</h3>
      <p className="stroke-rule">{t("strokeHowText")}</p>
      <div className="stroke-rows">
        <div className="stroke-row">
          <small>{t("strokeApart")}</small>
          <div className="stroke-pair">
            <Letter segs={E_APART} numbered label="E" />
            <Letter segs={T_APART} numbered start={4} label="T" />
          </div>
        </div>
        <span className="stroke-arrow" aria-hidden>→</span>
        <div className="stroke-row">
          <small>{t("strokeJoined")}</small>
          <div className="stroke-pair">
            <Letter segs={E_JOINED} numbered={false} label="E" />
            <Letter segs={T_JOINED} numbered={false} label="T" />
          </div>
        </div>
      </div>
      <p className="stroke-sum"><b>E</b> = 1 + 1 + 1 + 1 = <b>4</b> · <b>T</b> = 1 + 1 = <b>2</b> · <b>ET</b> = 4 + 2 = <b>6</b></p>
      <details className="stroke-table">
        <summary>{t("strokeAlphabet")}</summary>
        <div className="stroke-groups">
          {[...groups.keys()].sort((a, b) => a - b).map((n) => (
            <div key={n} className="stroke-group">
              <b>{n}</b>
              <span>{groups.get(n)!.sort((a, b) => order.indexOf(a) - order.indexOf(b)).join("  ")}</span>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}
