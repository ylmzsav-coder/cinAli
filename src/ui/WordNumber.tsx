import { useEffect, useMemo, useRef, useState } from "react";
import { formatNumber, t, uiLang } from "../i18n";
import { FAMOUS_SEVENS, SEVEN_GROUPS, type SevenGroup } from "../sevens";
import { SPACE_WORDS, digitalRoot, wordNumber } from "../strokes";
import { StrokeDemo } from "./StrokeDemo";

/** Kayıtlı liste: kök değeri 7 olan bütün sözlük kelimeleri (tools/kok7.ts üretir). */
let sevensCache: Promise<{ total: number; words: string[] }> | null = null;
function loadSevens() {
  if (!sevensCache) {
    const v = (typeof __DICT_VERSIONS__ !== "undefined" && __DICT_VERSIONS__["kok7-tr"]) || "";
    sevensCache = fetch(`./dict/kok7-tr.txt${v ? `?v=${v}` : ""}`)
      .then((r) => (r.ok ? r.text() : Promise.reject(r.status)))
      .then((text) => {
        const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
        const total = lines[0]?.startsWith("#") ? Number(lines.shift()!.slice(1)) : 0;
        return { total, words: lines };
      });
    sevensCache.catch(() => { sevensCache = null; });
  }
  return sevensCache;
}

/** Bir kelimenin hesabı: harf taşları, toplam ve kök değeri. */
function Breakdown({ word }: { word: string }) {
  const r = wordNumber(word);
  if (!r.letters.length) return null;
  return (
    <>
      <div className="wordnum-letters">
        {r.letters.map((l, i) => (
          <span key={i} className="wordnum-tile"><b>{l}</b><small>{r.parts[i]}</small></span>
        ))}
      </div>
      <p className="wordnum-sum">
        {r.parts.join(" + ")} = <b>{r.total}</b>
        {r.total > 9 && <> → {[...String(r.total)].join(" + ")} = <b>{digitalRoot(r.total)}</b></>}
      </p>
      <div className="wordnum-root"><small>{t("wordNumRoot")}</small><b>{r.root}</b></div>
    </>
  );
}

const STEP = 600;
const SPACE = new Set(SPACE_WORDS);

/** Kelimelerin Kök Değeri: harflerin kalem hareketleri toplanır, rakamları tek basamağa indirilir. */
export function WordNumber({ onBack }: { onBack: () => void }) {
  const [word, setWord] = useState("");
  const resultRef = useRef<HTMLDivElement>(null);
  const [picked, setPicked] = useState(0);
  // Bütün yediler listesi
  const [allOpen, setAllOpen] = useState(false);
  const [famousOpen, setFamousOpen] = useState(false);
  const [sevens, setSevens] = useState<{ total: number; words: string[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [shown, setShown] = useState(STEP);
  const [card, setCard] = useState<string | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  // Sayfa en üstten açılır (menüde aşağı kaydırılmış olsa bile)
  useEffect(() => { window.scrollTo(0, 0); }, []);
  // Tablodan kelime seçilince sonuç görünür olsun
  useEffect(() => { if (picked) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); }, [picked]);
  useEffect(() => {
    if (!allOpen || sevens) return;
    setFailed(false);
    loadSevens().then(setSevens, () => setFailed(true));
  }, [allOpen, sevens]);
  // Liste aşağı kaydırıldıkça devamı dizilir (hepsi birden çizilip telefon yorulmasın)
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !sevens || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) setShown((n) => n + STEP); }, { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [sevens, shown]);
  // Uzay altılısı en başta sabit (ayrı renkte); ardından diğer yediler en uzundan en kısaya
  // (aynı uzunluktakiler sözlük sırasında: sık kullanılan önce)
  const rest = useMemo(() => (sevens ? sevens.words.filter((w) => !SPACE.has(w)) : [])
    .map((w, i) => ({ w, i, n: [...w].length }))
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .map((x) => x.w), [sevens]);
  const hasResult = wordNumber(word).letters.length > 0;
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
      <button type="button" className="big wordnum-all-btn" aria-expanded={allOpen} onClick={() => setAllOpen((o) => !o)}>
        {allOpen ? `✖ ${t("wordNumHide")}` : `7️⃣ ${t("wordNumAll")}`}
      </button>
      <button type="button" className="big wordnum-famous-btn" aria-expanded={famousOpen} onClick={() => setFamousOpen((o) => !o)}>
        {famousOpen ? `✖ ${t("wordNumHide")}` : `⭐ ${t("famousSevens")}`}
      </button>
      {famousOpen && <FamousSevens />}
      {allOpen && (
        <section className="wordnum-all" aria-label={t("wordNumAllTitle")}>
          <h3 className="wordnum-h">{t("wordNumAllTitle")}</h3>
          {failed && <p className="muted">{t("dictError")}</p>}
          {!sevens && !failed && <p className="muted">{t("loadingDict")}</p>}
          {sevens && (
            <>
              <p className="muted small wordnum-count">{t("wordNumAllCount", { n: formatNumber(sevens.words.length), total: formatNumber(sevens.total) })}</p>
              <div className="wordnum-chips">
                {SPACE_WORDS.map((w, i) => (
                  <button key={w} type="button" className="wordnum-chip space" onClick={() => setCard(w)}><i>{i + 1}</i>{w}</button>
                ))}
                {rest.slice(0, shown).map((w) => (
                  <button key={w} type="button" className="wordnum-chip" onClick={() => setCard(w)}>{w}</button>
                ))}
              </div>
              {shown < rest.length && <div ref={sentinel} className="wordnum-more"><button type="button" onClick={() => setShown((n) => n + STEP)}>{t("wordNumMore", { n: formatNumber(rest.length - shown) })}</button></div>}
            </>
          )}
        </section>
      )}
      <StrokeDemo />
      <p className="muted">{t("wordNumIntro")}</p>
      <input className="wordnum-input" value={word} maxLength={24} autoCapitalize="characters" spellCheck={false}
        placeholder={t("wordNumPlaceholder")} aria-label={t("wordNumPlaceholder")} onChange={(e) => setWord(e.target.value)} />
      {hasResult && (
        <div className="wordnum-result" aria-live="polite" ref={resultRef}>
          <Breakdown word={word} />
        </div>
      )}
      <p className="muted small">{t("wordNumNote")}</p>
      {card && (
        <div className="modal-bg" onClick={() => setCard(null)}>
          <div className={`modal wordnum-card${SPACE.has(card) ? " space" : ""}`} role="dialog" aria-label={card} onClick={(e) => e.stopPropagation()}>
            <div className="wordnum-result"><Breakdown word={card} /></div>
            <div className="modal-actions"><button type="button" className="primary" onClick={() => setCard(null)}>{t("close")}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Ünlü 7'liler: konularına göre gruplu kartlar. */
function FamousSevens() {
  const lang = uiLang() === "tr" ? "tr" : "en";
  const groups = Object.keys(SEVEN_GROUPS) as SevenGroup[];
  return (
    <section className="famous7" aria-label={t("famousSevens")}>
      <h3 className="wordnum-h">⭐ {t("famousSevens")} <small className="muted">({FAMOUS_SEVENS.length})</small></h3>
      {groups.map((g) => (
        <div key={g} className="famous7-group">
          <h4>{SEVEN_GROUPS[g][lang]}</h4>
          <div className="famous7-cards">
            {FAMOUS_SEVENS.filter((s) => s.group === g).map((s) => (
              <article key={s.en.title} className="famous7-card">
                <span className="famous7-icon" aria-hidden>{s.icon}</span>
                <div><b>{s[lang].title}</b><p>{s[lang].items}</p></div>
              </article>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
