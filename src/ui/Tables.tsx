import { TABLES, TableConfig, winnerPrize } from "../economy/tables";
import { useWallet } from "../economy/useWallet";
import { t } from "../i18n";
import { Chips } from "./Chips";

interface Props {
  onPick: (t: TableConfig) => void;
  onShop: () => void;
  onBack: () => void;
}

export function Tables({ onPick, onShop, onBack }: Props) {
  const w = useWallet();
  return (
    <div className="page">
      <div className="page-head">
        <button type="button" className="link" onClick={onBack}>{t("back")}</button>
        <button type="button" className="balance small-balance" onClick={onShop} aria-label={t("balanceAria")}>
          <Chips amount={w.balance} loading={!w.ready} /> <span className="plus-chip">+</span>
        </button>
      </div>
      <h1>{t("chipTables")}</h1>
      <p className="muted small">{t("tablesDesc")}</p>
      <div className="tables">
        {TABLES.map((tb) => {
          const afford = w.balance >= tb.entry;
          return (
            <div key={tb.id} className={`table-card tc-${tb.id}`}>
              <div className="tc-name">{t(`table_${tb.id}` as "table_vip")}</div>
              <div className="muted small">{t(`opponents_${tb.level}`)} · {t("handsN", { n: tb.hands })}</div>
              <div className="tc-row"><span className="muted small">{t("entry")}</span><Chips amount={tb.entry} /></div>
              <div className="tc-row"><span className="muted small">{t("toWinner")}</span><Chips amount={winnerPrize(tb)} /></div>
              {!w.ready ? (
                <button type="button" disabled aria-busy>…</button>
              ) : afford ? (
                <button type="button" className="primary" onClick={() => onPick(tb)}>{t("sit")}</button>
              ) : (
                <button type="button" onClick={onShop}>{t("chipsMissing", { n: tb.entry - w.balance })}</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
