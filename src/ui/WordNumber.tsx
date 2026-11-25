import { useEffect, useRef, useState } from "react";
import { t } from "../i18n";
import { SPACE_WORDS, digitalRoot, wordNumber } from "../strokes";

/** Kelimenin Sayısı: harflerin kalem hareketleri toplanır, rakamları tek basamağa indirilir. */
export function WordNumber({ onBack }: { onBack: () => void }) {
  const [word, setWord] = useState("");
  const resultRef = useRef<HTMLDivElement>(null);
  const [picked, setPicked] = useState(0);
  // Sayfa en üstten açılır (menüde aşağı kaydırılmış olsa bile)
  useEffect(() => { window.scrollTo(0, 0); }, []);
  // Tablodan kelime seçilince sonuç görünür olsun
  useEffect(() => { if (picked) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); }, [picked]);
  const r = wordNumber(word);
  const sumDigits = (n: number) => [...String(n)].join(" + ");
  return (
    <div className="page wordnum-page">
      <div className="page-head">
        <button type="button" className="link" onClick={onBack}>{t("back")}</button>
      </div>
      <h1>🔢 {t("wordNumTitle")}</h1>
      <h3 className="wordnum-h">🌌 {t("wordNumSpace")}</h3>
      <table className="wordnum-table">
        <thead>
          <tr><th>{t("wordNumWord")}</th><th>{t("wordNumStrokes")}</th><th>{t("wordNumTotal")}</th><th>{t("wordNumRoot")}</th></tr>
        </thead>
        <tbody>
          {SPACE_WORDS.map((w) => {
            const s = wordNumber(w);
            return (
              <tr key={w} onClick={() => { setWord(w); setPicked((n) => n + 1); }}>
                <td><b>{w}</b></td><td>{s.parts.join("+")}</td><td>{s.total}</td><td><b className="wordnum-seven">{s.root}</b> ✅</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="muted">{t("wordNumIntro")}</p>
      <input className="wordnum-input" value={word} maxLength={24} autoCapitalize="characters" spellCheck={false}
        placeholder={t("wordNumPlaceholder")} aria-label={t("wordNumPlaceholder")} onChange={(e) => setWord(e.target.value)} />
      {r.letters.length > 0 && (
        <div className="wordnum-result" aria-live="polite" ref={resultRef}>
          <div className="wordnum-letters">
            {r.letters.map((l, i) => (
              <span key={i} className="wordnum-tile"><b>{l}</b><small>{r.parts[i]}</small></span>
            ))}
          </div>
          <p className="wordnum-sum">
            {r.parts.join(" + ")} = <b>{r.total}</b>
            {r.total > 9 && <> → {sumDigits(r.total)} = <b>{digitalRoot(r.total)}</b></>}
          </p>
          <div className="wordnum-root"><small>{t("wordNumRoot")}</small><b>{r.root}</b></div>
        </div>
      )}
      <p className="muted small">{t("wordNumNote")}</p>
    </div>
  );
}
