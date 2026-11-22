import { useState } from "react";
import { TABLES, TableConfig, winnerPrize } from "../economy/tables";
import { CLOUD } from "../online/cloud";
import { TABLE_ENTRY, TABLE_PRIZE } from "../economy/config";
import { useWallet } from "../economy/useWallet";
import { t } from "../i18n";
import { Chips } from "./Chips";
import { VipModal } from "./Vip";

interface Props {
  onPick: (t: TableConfig) => void;
  onCreatePrivate: (t: TableConfig) => void;
  onJoinCode: (code: string) => void;
  onShop: () => void;
  onBack: () => void;
}

export function Tables({ onPick, onCreatePrivate, onJoinCode, onShop, onBack }: Props) {
  const w = useWallet();
  const [level, setLevel] = useState(TABLES[0].id);
  const [code, setCode] = useState("");
  const [vipOpen, setVipOpen] = useState(false);
  const chosen = TABLES.find((x) => x.id === level)!;
  return (
    <div className="page">
      <div className="page-head">
        <button type="button" className="link" onClick={onBack}>{t("back")}</button>
        <button type="button" className="balance small-balance" onClick={onShop} aria-label={t("balanceAria")}>
          <Chips amount={w.balance} loading={!w.ready} /> <span className="plus-chip">+</span>
        </button>
      </div>
      <h1>{t("chipTables")}</h1>
      <p className="muted small">{t("tablesDesc", { entry: TABLE_ENTRY, prize: TABLE_PRIZE })}</p>
      <div className="tables">
        {TABLES.map((tb) => {
          const afford = w.balance >= tb.entry;
          if (tb.vip) {
            const isVip = !!w.vipUntil && w.vipUntil > Date.now();
            return (
              <div key={tb.id} className="table-card tc-vip2">
                <div className="tc-name">👑 {t("table_vip2")}</div>
                <div className="vip-chat-tag">💬 {t("vipChatGame")}</div>
                <div className="muted small">{t("vipTableDesc")}</div>
                <div className="tc-row"><span className="muted small">{t("entry")}</span><Chips amount={tb.entry} /></div>
                <div className="tc-row"><span className="muted small">{t("toWinner")}</span><Chips amount={winnerPrize(tb)} /></div>
                {!w.ready ? (
                  <button type="button" disabled aria-busy>…</button>
                ) : !isVip ? (
                  <>
                    <div className="vip-guest-note">🤝 {t("vipGuestShort")}</div>
                    <button type="button" className="vip-buy" onClick={() => setVipOpen(true)}>👑 {t("vipBecome")}</button>
                  </>
                ) : afford ? (
                  <>
                    <button type="button" className="primary" onClick={() => onPick(tb)}>{t("sit")}</button>
                    {CLOUD && <button type="button" onClick={() => onCreatePrivate(tb)}>📨 {t("vipInviteFriend")}</button>}
                  </>
                ) : (
                  <button type="button" onClick={onShop}>{t("chipsMissing", { n: tb.entry - w.balance })}</button>
                )}
              </div>
            );
          }
          return (
            <div key={tb.id} className={`table-card tc-${tb.id}`}>
              <div className="tc-name">{t(`table_${tb.id}` as "table_vip")}</div>
              <div className="muted small">{t(`opponents_${tb.level}`)}</div>
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

      {vipOpen && <VipModal onClose={() => setVipOpen(false)} />}
      <h2>{t("playFriends")}</h2>
      {CLOUD ? (
        <div className="friends">
          <p className="muted small">{t("friendsDesc")}</p>
          <div className="friends-row">
            <select value={level} onChange={(e) => setLevel(e.target.value)} aria-label={t("entry")}>
              {TABLES.map((tb) => (
                <option key={tb.id} value={tb.id}>
                  {t(`table_${tb.id}` as "table_vip")} · {tb.entry.toLocaleString()}
                </option>
              ))}
            </select>
            <button type="button" className="primary" disabled={!w.ready || w.balance < chosen.entry}
              onClick={() => onCreatePrivate(chosen)}>{t("createPrivate")}</button>
          </div>
          <form className="friends-row" onSubmit={(e) => {
            e.preventDefault();
            if (code.trim().length >= 6) onJoinCode(code.trim().toUpperCase());
          }}>
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
              placeholder={t("tableCode")} aria-label={t("tableCode")} autoCapitalize="characters" className="code-input" />
            <button type="submit" disabled={code.trim().length < 6}>{t("joinWithCode")}</button>
          </form>
        </div>
      ) : (
        <p className="muted small">{t("needsOnline")}</p>
      )}
    </div>
  );
}
