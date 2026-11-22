import { useEffect, useState } from "react";
import { GIFTS, GIFT_CONVERT_RATE, type Gift, type GiftCategory, convertValue, giftById } from "../economy/gifts";
import { useWallet } from "../economy/useWallet";
import { errorText, formatNumber, t } from "../i18n";
import { CLOUD } from "../online/cloud";
import { type ReceivedGift, convertGift, myGifts, sendGiftTo } from "../online/gifts";
import { type FriendStatus, friendsStatus } from "../online/social";
import { Avatar } from "./Profile";
import { Chips } from "./Chips";

const CATS: GiftCategory[] = ["erkek", "kadin", "herkes"];
const CAT_ICON: Record<GiftCategory, string> = { erkek: "🤵", kadin: "👩", herkes: "🎁" };

/** Hediye kataloğu: Erkeklere / Kadınlara / Herkese sekmeleri. */
export function GiftCatalog({ onPick, selected }: { onPick: (g: Gift) => void; selected?: string }) {
  const [cat, setCat] = useState<GiftCategory>("erkek");
  return (
    <div className="gift-catalog">
      <div className="gift-tabs" role="tablist">
        {CATS.map((c) => (
          <button key={c} type="button" role="tab" aria-selected={cat === c} className={cat === c ? "on" : ""} onClick={() => setCat(c)}>
            {CAT_ICON[c]} {t(`giftCat_${c}` as "giftCat_erkek")}
          </button>
        ))}
      </div>
      <div className="gift-grid">
        {GIFTS.filter((g) => g.category === cat).map((g) => (
          <button key={g.id} type="button" className={`gift-item ${selected === g.id ? "on" : ""}`} onClick={() => onPick(g)}>
            <span className="gift-emoji" aria-hidden>{g.emoji}</span>
            <span className="gift-name">{t(`gift_${g.id}` as "gift_gul")}</span>
            <Chips amount={g.value} />
          </button>
        ))}
      </div>
    </div>
  );
}

/** Belirli bir oyuncuya hediye seç ve gönder (oyundan). */
export function GiftSendModal({ toName, onSend, onClose }: { toName: string; onSend: (g: Gift) => Promise<void>; onClose: () => void }) {
  const w = useWallet();
  const [pick, setPick] = useState<Gift | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const send = async () => {
    if (!pick) return;
    setBusy(true);
    setMsg(null);
    try {
      await onSend(pick);
      setMsg({ text: t("giftSent", { gift: t(`gift_${pick.id}` as "gift_gul"), name: toName }) });
      setTimeout(onClose, 1200);
    } catch (e) {
      setMsg({ text: errorText(e), error: true });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal gift-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t("giftSendTitle", { name: toName })}>
        <button type="button" className="profile-close" onClick={onClose} aria-label={t("close")}>✕</button>
        <h3>🎁 {t("giftSendTitle", { name: toName })}</h3>
        <div className="muted small">{t("yourBalance")} <Chips amount={w.balance} /></div>
        <GiftCatalog onPick={setPick} selected={pick?.id} />
        {msg && <p className={msg.error ? "error" : "toast"}>{msg.text}</p>}
        <button type="button" className="primary gift-send-btn" disabled={!pick || busy || (!!pick && w.balance < pick.value)} onClick={() => void send()}>
          {pick ? t("giftSendBtn", { gift: `${pick.emoji} ${t(`gift_${pick.id}` as "gift_gul")}`, n: formatNumber(pick.value) }) : t("giftChoose")}
        </button>
        <p className="muted small">{t("giftNote", { pct: Math.round(GIFT_CONVERT_RATE * 100) })}</p>
      </div>
    </div>
  );
}

/** Mağazadan hediye: önce hediye, sonra arkadaş seçilir. */
export function GiftShop() {
  const [pick, setPick] = useState<Gift | null>(null);
  const [friends, setFriends] = useState<FriendStatus[] | null>(null);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  useEffect(() => {
    if (CLOUD) friendsStatus().then((r) => setFriends(r.friends), () => setFriends([]));
  }, []);
  const send = async (f: FriendStatus) => {
    if (!pick) return;
    try {
      await sendGiftTo(f.uid, pick.id);
      setMsg({ text: t("giftSent", { gift: t(`gift_${pick.id}` as "gift_gul"), name: f.name }) });
      setPick(null);
    } catch (e) {
      setMsg({ text: errorText(e), error: true });
    }
  };
  return (
    <section className="gift-shop">
      <h2>🎁 {t("giftShop")}</h2>
      <p className="muted small">{t("giftShopDesc", { pct: Math.round(GIFT_CONVERT_RATE * 100) })}</p>
      <GiftCatalog onPick={(g) => { setPick(g); setMsg(null); }} selected={pick?.id} />
      {msg && <div className={msg.error ? "error" : "toast"}>{msg.text}</div>}
      {pick && (
        <div className="modal-bg" onClick={() => setPick(null)}>
          <div className="modal gift-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="profile-close" onClick={() => setPick(null)} aria-label={t("close")}>✕</button>
            <div className="gift-big" aria-hidden>{pick.emoji}</div>
            <h3>{t(`gift_${pick.id}` as "gift_gul")} · <Chips amount={pick.value} /></h3>
            {!CLOUD ? (
              <p className="muted">{t("giftShopOffline")}</p>
            ) : friends === null ? (
              <p className="muted">…</p>
            ) : friends.length === 0 ? (
              <p className="muted">{t("giftNoFriends")}</p>
            ) : (
              <div className="friend-list">
                <div className="stat-label">{t("giftToWhom")}</div>
                {friends.map((f) => (
                  <div key={f.uid} className="friend-row">
                    <Avatar name={f.name} seat={1} size="sm" />
                    <span className="friend-name">{f.name}</span>
                    <button type="button" className="primary small-btn" onClick={() => void send(f)}>🎁 {t("giftSendShort")}</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/** Profilde gelen hediyeler: sakla ya da çipe dönüştür. */
export function MyGiftsPanel() {
  const [list, setList] = useState<ReceivedGift[] | null>(null);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const load = () => {
    if (CLOUD) myGifts().then(setList, (e) => setMsg({ text: errorText(e), error: true }));
  };
  useEffect(load, []);
  if (!CLOUD) return <div className="friends-panel"><p className="muted">{t("giftsSoon")}</p></div>;
  const conv = async (g: ReceivedGift) => {
    try {
      const r = await convertGift(g.id);
      setMsg({ text: t("giftConverted", { n: formatNumber(r.chips) }) });
      load();
    } catch (e) {
      setMsg({ text: errorText(e), error: true });
    }
  };
  return (
    <div className="friends-panel">
      {msg && <p className={msg.error ? "error" : "toast"}>{msg.text}</p>}
      {list === null ? (
        <p className="muted">…</p>
      ) : list.length === 0 ? (
        <p className="muted">{t("giftsEmpty")}</p>
      ) : (
        <div className="friend-list">
          {list.map((g) => {
            const def = giftById(g.giftId);
            return (
              <div key={g.id} className={`friend-row ${g.converted ? "dim" : ""}`}>
                <span className="gift-row-emoji" aria-hidden>{def?.emoji ?? "🎁"}</span>
                <span className="friend-name">
                  {def ? t(`gift_${def.id}` as "gift_gul") : g.giftId}
                  <small className="muted">{t("giftFrom", { name: g.fromName })} · {new Date(g.at).toLocaleDateString()}</small>
                </span>
                {g.converted ? (
                  <span className="muted small">{t("giftWasConverted")}</span>
                ) : (
                  <button type="button" className="primary small-btn" onClick={() => void conv(g)}>
                    {t("giftConvertBtn", { n: formatNumber(convertValue(g)) })}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
