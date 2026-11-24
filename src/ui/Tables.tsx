import { useState } from "react";
import { TABLES, TableConfig, winnerPrize } from "../economy/tables";
import { CLOUD } from "../online/cloud";
import { TABLE_ENTRY, TABLE_PRIZE } from "../economy/config";
import { useWallet } from "../economy/useWallet";
import { wallet } from "../economy/wallet";
import { t } from "../i18n";
import { KumbaraIcon } from "./Kumbara";
import { Chips } from "./Chips";
import { GenderModal, VipModal } from "./Vip";
import { TwoPlayerChoices, type TwoMode } from "./TwoPlayer";
import type { Gender } from "../storage";

interface Props {
  onPick: (t: TableConfig, want?: Gender) => void;
  /** İki kişilik oda: rastgele oyuncu, arkadaşla ya da bilgisayara karşı. */
  onTwo: (t: TableConfig, mode: TwoMode) => void;
  /** Oyuncunun cinsiyeti (VIP bayan/erkek arama için); yoksa sorulur. */
  gender?: Gender;
  onGender: (g: Gender) => void;
  onCreatePrivate: (t: TableConfig) => void;
  onJoinCode: (code: string) => void;
  onShop: () => void;
  onBack: () => void;
}

export function Tables({ onPick, onTwo, gender, onGender, onCreatePrivate, onJoinCode, onShop, onBack }: Props) {
  // VIP bayan/erkek arama: cinsiyet bilinmiyorsa önce sorulur
  const [askFor, setAskFor] = useState<{ tb: TableConfig; want: Gender } | null>(null);
  const search = (tb: TableConfig, want: Gender) => (gender ? onPick(tb, want) : setAskFor({ tb, want }));
  const w = useWallet();
  const [level, setLevel] = useState(TABLES[0].id);
  const [code, setCode] = useState("");
  const [vipOpen, setVipOpen] = useState(false);
  const chosen = TABLES.find((x) => x.id === level)!;
  // VIP oda tek kart: giriş seçimi (100 → 300 / 500 → 1.500)
  const vipTables = TABLES.filter((x) => x.vip);
  const [vipId, setVipId] = useState(vipTables[0].id);
  return (
    <div className="page">
      <div className="page-head">
        <button type="button" className="link" onClick={onBack}>{t("back")}</button>
        <button type="button" className="balance small-balance" onClick={onShop} aria-label={t("balanceAria")}>
          <Chips amount={w.balance} loading={!w.ready} icon={<KumbaraIcon />} /> <span className="plus-chip">+</span>
        </button>
      </div>
      <h1>{t("chipTables")}</h1>
      <p className="muted small">{t("tablesDesc", { entry: TABLE_ENTRY, prize: TABLE_PRIZE })}</p>
      <div className="tables">
        {TABLES.map((tb) => {
          if (tb.vip && tb.id !== vipTables[0].id) return null;
          if (tb.vip) tb = vipTables.find((x) => x.id === vipId) ?? tb;
          const afford = w.balance >= tb.entry;
          if (tb.vip) {
            const isVip = wallet.isVip();
            return (
              <div key="vip" className="table-card tc-vip2">
                <div className="tc-name">👑 {t("table_vip2")}</div>
                <div className="vip-chat-tag">💬 {t("vipChatGame")}</div>
                <div className="muted small">{t("vipTableDesc")}</div>
                <div className="muted small vip-stake-label">{t("vipStake")}</div>
                <div className="vip-stake" role="radiogroup" aria-label={t("vipStake")}>
                  {vipTables.map((v) => (
                    <button key={v.id} type="button" role="radio" aria-checked={v.id === tb.id}
                      className={v.id === tb.id ? "on" : ""} onClick={() => setVipId(v.id)}>
                      <span><Chips amount={v.entry} /></span>
                      <span className="vip-stake-arrow">→ <Chips amount={winnerPrize(v)} /></span>
                    </button>
                  ))}
                </div>
                {!w.ready ? (
                  <button type="button" disabled aria-busy>…</button>
                ) : !isVip ? (
                  <>
                    <div className="vip-guest-note">🤝 {t("vipGuestShort")}</div>
                    <button type="button" className="vip-buy" onClick={() => setVipOpen(true)}>👑 {t("vipBecome")}</button>
                  </>
                ) : afford ? (
                  <>
                    <div className="vip-search-row">
                      <button type="button" className="primary vip-search-btn vip-f" onClick={() => search(tb, "kadin")}>👩 {t("vipSearchF")}</button>
                      <button type="button" className="primary vip-search-btn vip-m" onClick={() => search(tb, "erkek")}>👨 {t("vipSearchM")}</button>
                    </div>
                    <TwoPlayerChoices onRandom={() => onTwo(tb, "random")} onFriend={() => onTwo(tb, "friend")} onBot={() => onTwo(tb, "bot")} />
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
              ) : afford && (tb.players ?? 4) === 2 ? (
                <TwoPlayerChoices onRandom={() => onTwo(tb, "random")} onFriend={() => onTwo(tb, "friend")} onBot={() => onTwo(tb, "bot")} />
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
      {askFor && (
        <GenderModal onClose={() => setAskFor(null)} onPick={(g) => { onGender(g); const a = askFor; setAskFor(null); onPick(a.tb, a.want); }} />
      )}
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
