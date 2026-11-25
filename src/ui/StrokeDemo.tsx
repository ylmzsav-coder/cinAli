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

/** G: 1) üstten başlayan kavis aşağı iner ve yukarı çıkar (tek hareket), 2) sağdan sola içeri düz çizgi. */
const G_CURVE = "M 50 18 A 24 30 0 1 0 52 58 L 52 44";
function GLetter({ apart }: { apart: boolean }) {
  const bar = apart ? "M 44 44 L 26 44" : "M 52 44 L 34 44";
  return (
    <svg className="stroke-letter" viewBox="-6 -6 72 92" role="img" aria-label="G">
      <path d={G_CURVE} fill="none" stroke={apart ? COLORS[0] : "#222"} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round"
        pathLength={1} className={apart ? "stroke-draw" : undefined} style={apart ? { animationDelay: "0.2s", animationDuration: "0.9s" } : undefined} />
      <path d={bar} fill="none" stroke={apart ? COLORS[1] : "#222"} strokeWidth={7} strokeLinecap="round"
        pathLength={1} className={apart ? "stroke-draw" : undefined} style={apart ? { animationDelay: "1.2s" } : undefined} />
      {apart && (
        <>
          <g className="stroke-num" style={{ animationDelay: "0.6s" }}>
            <circle cx={4} cy={40} r={8} fill="#fff" stroke={COLORS[0]} strokeWidth={2.5} />
            <text x={4} y={44} textAnchor="middle" fontSize={11} fontWeight={800} fill="#111">1</text>
          </g>
          <g className="stroke-num" style={{ animationDelay: "1.5s" }}>
            <circle cx={35} cy={30} r={8} fill="#fff" stroke={COLORS[1]} strokeWidth={2.5} />
            <text x={35} y={34} textAnchor="middle" fontSize={11} fontWeight={800} fill="#111">2</text>
          </g>
        </>
      )}
    </svg>
  );
}

/** Kavisli harfler: her hareket bir SVG yolu; parça parça halde yollar sağa kaydırılır. Rozet konumları yol başına. */
interface PathStroke { d: string; apartDx: number; badge: [number, number] }
const P_STROKES: PathStroke[] = [
  { d: "M 12 8 L 12 72", apartDx: -6, badge: [6, 56] },
  { d: "M 12 8 L 32 8 A 16 16 0 0 1 32 40 L 12 40", apartDx: 8, badge: [48, 24] },
];
const B_STROKES: PathStroke[] = [
  { d: "M 12 8 L 12 72", apartDx: -6, badge: [6, 56] },
  { d: "M 12 8 L 30 8 A 15 16 0 0 1 30 40 L 12 40", apartDx: 8, badge: [45, 24] },
  { d: "M 12 40 L 34 40 A 16 16 0 0 1 34 72 L 12 72", apartDx: 8, badge: [52, 56] },
];
function PathLetter({ strokes, apart, label }: { strokes: PathStroke[]; apart: boolean; label: string }) {
  return (
    <svg className="stroke-letter" viewBox="-6 -6 72 92" role="img" aria-label={label}>
      {strokes.map((st, i) => (
        <path key={i} d={st.d} transform={apart ? `translate(${st.apartDx} 0)` : undefined} fill="none"
          stroke={apart ? COLORS[i % COLORS.length] : "#222"} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round"
          pathLength={1} className={apart ? "stroke-draw" : undefined} style={apart ? { animationDelay: `${i * 0.6}s`, animationDuration: "0.5s" } : undefined} />
      ))}
      {apart && strokes.map((st, i) => (
        <g key={`n${i}`} className="stroke-num" style={{ animationDelay: `${i * 0.6 + 0.4}s` }}>
          <circle cx={st.badge[0]} cy={st.badge[1]} r={8} fill="#fff" stroke={COLORS[i % COLORS.length]} strokeWidth={2.5} />
          <text x={st.badge[0]} y={st.badge[1] + 4} textAnchor="middle" fontSize={11} fontWeight={800} fill="#111">{i + 1}</text>
        </g>
      ))}
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
      <div className="stroke-g">
        <h4>⚠️ {t("strokeGTitle")}</h4>
        <p>{t("strokeGText")}</p>
        <div className="stroke-rows">
          <div className="stroke-row"><small>{t("strokeApart")}</small><div className="stroke-pair"><GLetter apart /></div></div>
          <span className="stroke-arrow" aria-hidden>→</span>
          <div className="stroke-row"><small>{t("strokeJoined")}</small><div className="stroke-pair"><GLetter apart={false} /></div></div>
        </div>
        <p className="stroke-sum"><b>G</b> = 1 + 1 = <b>2</b> · <b>Ğ</b> = 2 + 1 = <b>3</b></p>
      </div>
      <div className="stroke-g">
        <h4>🔍 {t("strokePBTitle")}</h4>
        <p>{t("strokePBText")}</p>
        <div className="stroke-rows">
          <div className="stroke-row"><small>P</small><div className="stroke-pair"><PathLetter strokes={P_STROKES} apart label="P" /><PathLetter strokes={P_STROKES} apart={false} label="P" /></div><b className="stroke-total">P = 2</b></div>
          <div className="stroke-row"><small>B</small><div className="stroke-pair"><PathLetter strokes={B_STROKES} apart label="B" /><PathLetter strokes={B_STROKES} apart={false} label="B" /></div><b className="stroke-total">B = 3</b></div>
        </div>
      </div>
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
