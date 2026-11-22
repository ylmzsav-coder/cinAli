import { useState } from "react";
import { VIP_BONUS_CHIPS, VIP_ENTRY, VIP_PRIZE } from "../economy/config";
import { TEST_MODE, VIP_PRODUCT, buyVip, purchasesAvailable } from "../economy/store";
import { useWallet } from "../economy/useWallet";
import { wallet } from "../economy/wallet";
import { errorText, formatNumber, t } from "../i18n";

/** VIP abonelik penceresi: avantajlar, aylık ücret, hediye çip ve abonelik süresi. */
export function VipModal({ onClose, onSubscribed }: { onClose: () => void; onSubscribed?: () => void }) {
  const w = useWallet();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const active = !!w.vipUntil && w.vipUntil > Date.now();
  const subscribe = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await buyVip();
      await wallet.subscribeVip();
      setMsg({ text: t("vipDone", { n: formatNumber(VIP_BONUS_CHIPS) }) });
      onSubscribed?.();
    } catch (e) {
      setMsg({ text: errorText(e), error: true });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal vip-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t("vipTitle")}>
        <button type="button" className="profile-close" onClick={onClose} aria-label={t("close")}>✕</button>
        <div className="vip-crown" aria-hidden>👑</div>
        <h3>{t("vipTitle")}</h3>
        <ul className="vip-perks">
          <li>🃏 {t("vipPerkRoom")}</li>
          <li className="vip-perk-hl">🤝 {t("vipPerkGuest")}</li>
          <li>💬 {t("vipPerkChat")}</li>
          <li>🚫 {t("vipPerkNoWatch")}</li>
          <li>🪙 {t("vipPerkTable", { entry: VIP_ENTRY, prize: VIP_PRIZE })}</li>
          <li>🎁 {t("vipPerkGift", { n: formatNumber(VIP_BONUS_CHIPS) })}</li>
        </ul>
        <div className="vip-price">{VIP_PRODUCT.testPrice} <small>/ {t("vipMonth")}</small></div>
        {active && <p className="vip-active">✅ {t("vipActiveUntil", { date: new Date(w.vipUntil!).toLocaleDateString() })}</p>}
        {TEST_MODE && <div className="test-banner">{t("testMode")}</div>}
        {msg && <p className={msg.error ? "error" : "toast"}>{msg.text}</p>}
        <button type="button" className="vip-buy" disabled={busy || !purchasesAvailable()} onClick={() => void subscribe()}>
          {busy ? "…" : !purchasesAvailable() ? t("soon") : active ? t("vipExtend") : t("vipSubscribe")}
        </button>
        <p className="muted small">{t("vipNote")}</p>
      </div>
    </div>
  );
}
