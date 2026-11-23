import { useState } from "react";
import { VIP_BONUS_CHIPS, VIP_ENTRY, VIP_ORTA_ENTRY, VIP_ORTA_PRIZE, VIP_PRIZE, VIP_USTA_ENTRY, VIP_USTA_PRIZE } from "../economy/config";
import { TEST_MODE, VIP_PRODUCT, buyVip, purchasesAvailable } from "../economy/store";
import { useWallet } from "../economy/useWallet";
import { wallet } from "../economy/wallet";
import { errorText, formatNumber, t } from "../i18n";
import type { Gender } from "../storage";

/** VIP abonelik penceresi: avantajlar, haftalık ücret, hediye çip ve abonelik süresi. */
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
          <li className="vip-perk-hl">👩👨 {t("vipPerkGender")}</li>
          <li>💬 {t("vipPerkChat")}</li>
          <li>⏳ {t("vipPerkNoTimer")}</li>
          <li className="vip-perk-hl">🪙 {t("vipPerkTable", { entry: VIP_ENTRY, prize: VIP_PRIZE, entry2: VIP_ORTA_ENTRY, prize2: VIP_ORTA_PRIZE, entry3: formatNumber(VIP_USTA_ENTRY), prize3: formatNumber(VIP_USTA_PRIZE) })}</li>
          <li>🎁 {t("vipPerkGift", { n: formatNumber(VIP_BONUS_CHIPS) })}</li>
        </ul>
        <div className="vip-buy-bar">
        <div className="vip-price">{VIP_PRODUCT.testPrice} <small>/ {t("vipMonth")}</small></div>
        {active && <p className="vip-active">✅ {t("vipActiveUntil", { date: new Date(w.vipUntil!).toLocaleDateString() })}</p>}
        {TEST_MODE && <div className="test-banner">{t("testMode")}</div>}
        {msg && <p className={msg.error ? "error" : "toast"}>{msg.text}</p>}
        <button type="button" className="vip-buy" disabled={busy || !purchasesAvailable()} onClick={() => void subscribe()}>
          {busy ? "…" : !purchasesAvailable() ? t("soon") : active ? t("vipExtend") : t("vipSubscribe")}
        </button>
        </div>
        <p className="muted small">{t("vipNote")}</p>
      </div>
    </div>
  );
}

/** Cinsiyet seçimi (VIP odada bayan/erkek oyuncu eşleşmesi için, bir kez sorulur). */
export function GenderModal({ onPick, onClose }: { onPick: (g: Gender) => void; onClose: () => void }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal gender-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t("genderAsk")}>
        <h3>{t("genderAsk")}</h3>
        <p className="muted small">{t("genderWhy")}</p>
        <div className="gender-row">
          <button type="button" className="gender-btn" onClick={() => onPick("kadin")}><span>👩</span>{t("genderF")}</button>
          <button type="button" className="gender-btn" onClick={() => onPick("erkek")}><span>👨</span>{t("genderM")}</button>
        </div>
        <button type="button" className="link" onClick={onClose}>{t("cancel")}</button>
      </div>
    </div>
  );
}
