import { RULES, jokerRackValue } from "../game/engine";
import { TABLES, turnSecondsFor, winnerPrize } from "../economy/tables";
import { LangCode, alphabet, gameLang } from "../game/lang";
import { JOKER_COUNT, letterTileTotal, letterValue } from "../game/tiles";
import { t } from "../i18n";
import { TABLE_TURN_SECONDS } from "../economy/config";
import { COPYRIGHT_YEAR } from "./Menu";
import { Chips } from "./Chips";

/** Kural sayfasındaki örnek kelime (oyun dilinde). */
const EXAMPLE: Record<LangCode, string> = {
  tr: "KALEM", en: "TABLE", de: "TISCH", fr: "TABLE", es: "MESA", it: "TAVOLO", pt: "MESA",
};

export function Rules({ onBack, onLicenses }: { onBack: () => void; onLicenses?: () => void }) {
  const lang = gameLang();
  const word = EXAMPLE[lang.code];
  const letters = [...word];
  const example = `${word} = ${letters.map(letterValue).join(" + ")} = ${letters.reduce((s, l) => s + letterValue(l), 0)}`;
  const first = lang.alphabet.slice(0, 3).map((l, i) => `${l}=${i + 1}`).join(", ") +
    ` … ${lang.alphabet[lang.alphabet.length - 1]}=${lang.alphabet.length}`;
  const rules = [
    t("rule_tiles", { letters: letterTileTotal(), jokers: JOKER_COUNT }),
    t("rule_values", { first, example }),
    t("rule_deal", { hand: RULES.handSize, hand1: RULES.handSize + 1 }),
    t("rule_turn"),
    t("rule_word"),
    t("rule_open", { need: RULES.openThreshold }),
    t("rule_after"),
    t("rule_joker"),
    t("rule_finish"),
    t("rule_score", { win: RULES.winBonus, joker: jokerRackValue(), top: alphabet()[alphabet().length - 1] }),
    t("rule_color", { score: RULES.colorWinBonus }),
    t("rule_timer", { n: TABLE_TURN_SECONDS }),
    t("rule_winner"),
    t("rule_nowinner"),
    t("rule_pro"),
    t("rule_rate"),
    t("rule_sosyete_chat"),
    t("rule_rate_ozel"),
    t("rule_rate_carli"),
    t("rule_chat"),
    t("rule_friends"),
    t("rule_free"),
    t("rule_idle"),
  ];
  return (
    <div className="page">
      <button type="button" className="link" onClick={onBack}>{t("back")}</button>
      <h1>{t("rulesTitle")}</h1>
      <ol className="rules">
        {rules.map((r, i) => {
          const [head, ...rest] = r.split(": ");
          return <li key={i}>{rest.length ? <><b>{head}:</b> {rest.join(": ")}</> : r}</li>;
        })}
      </ol>
      <h2>{t("feeTitle")}</h2>
      <div className="fee-wrap">
        <table className="fee-table">
          <thead>
            <tr><th>{t("feeTable")}</th><th>{t("feePlayers")}</th><th>{t("feeEntry")}</th><th>{t("feeWinner")}</th><th>{t("feeTurn")}</th><th>{t("feeMinWord")}</th></tr>
          </thead>
          <tbody>
            {TABLES.map((tb) => {
              const group = tb.id.startsWith("caylak") ? t("table_caylak") : tb.id.startsWith("carli") ? t("playCarli") : tb.id.startsWith("usta") ? t("table_usta") : tb.vip ? t("vipShort") : t("ozelShort");
              return (
                <tr key={tb.id}>
                  <td>{group}</td>
                  <td>{tb.players ?? 4}</td>
                  <td><Chips amount={tb.entry} /></td>
                  <td><Chips amount={winnerPrize(tb)} /></td>
                  <td>{turnSecondsFor(tb) >= 60 && turnSecondsFor(tb) % 60 === 0 && turnSecondsFor(tb) > 60 ? t("feeMin", { n: turnSecondsFor(tb) / 60 }) : t("feeSec", { n: turnSecondsFor(tb) })}</td>
                  <td>{t("feeLetters", { n: tb.minWord ?? 2 })}</td>
                </tr>
              );
            })}
            <tr><td>{t("practiceShort")}</td><td>2</td><td colSpan={2}>{t("feeFree")}</td><td>{t("feeSec", { n: TABLE_TURN_SECONDS })}</td><td>{t("feeLetters", { n: 2 })}</td></tr>
          </tbody>
        </table>
      </div>
      <h2>{t("howTitle")}</h2>
      <ul className="rules">
        <li>{t("how_1")}</li>
        <li>{t("how_2", { need: RULES.openThreshold })}</li>
        <li>{t("how_3")}</li>
        <li>{t("how_4")}</li>
      </ul>
      <h2>{t("distTitle", { lang: lang.name })}</h2>
      <div className="dist">
        {lang.alphabet.map((l) => (
          <span key={l}>{l}×{lang.counts[l]}</span>
        ))}
      </div>
      <p className="muted small">{t("dictSource")}</p>
      <p className="muted small">{t("copyright", { year: COPYRIGHT_YEAR })}</p>
      {onLicenses && <button type="button" className="link small" onClick={onLicenses}>📜 {t("licensesLink")}</button>}
    </div>
  );
}
