import { GiftShop } from "./Gifts";
import { VipModal } from "./Vip";
import { VIP_PRODUCT } from "../economy/store";
import { VIP_BONUS_CHIPS } from "../economy/config";
import { useState } from "react";
import { CHIP_PACKS, TEST_MODE, adsAvailable, buyPack, packSaving, purchasesAvailable, restorePurchases, showRewardedAd } from "../economy/store";
import { PurchaseConsent } from "./Terms";
import { salesConsented } from "../terms";
import { useWallet } from "../economy/useWallet";
import { AD_REWARD, DAILY_BONUS, wallet } from "../economy/wallet";
import { errorText, formatNumber, t } from "../i18n";
import { KumbaraIcon } from "./Kumbara";
import { Chips } from "./Chips";

export function Shop({ onBack, notice }: { onBack: () => void; notice?: string | null }) {
  const [vipOpen, setVipOpen] = useState(false);
  const w = useWallet();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const adsLeft = wallet.adsLeftToday();
  const [consent, setConsent] = useState(salesConsented);
  const restore = async () => {
    setBusy("restore");
    setMsg(null);
    try {
      const r = await restorePurchases();
      setMsg(r.vip || r.autoPer ? t("restoreDone") : t("restoreNone"));
    } catch (e) {
      setMsg(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  const buy = async (productId: string) => {
    const pack = CHIP_PACKS.find((p) => p.productId === productId)!;
    setBusy(productId);
    setMsg(null);
    try {
      const chips = await buyPack(pack);
      await wallet.purchase(chips, productId);
      setMsg(t("purchased", { n: chips }));
    } catch (e) {
      setMsg(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  const watchAd = async () => {
    setBusy("ad");
    setMsg(null);
    try {
      if (await showRewardedAd()) {
        await wallet.rewardAd();
        setMsg(t("adRewarded", { n: AD_REWARD }));
      }
    } catch (e) {
      setMsg(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <button type="button" className="link" onClick={onBack}>{t("back")}</button>
        <span className="balance small-balance"><Chips amount={w.balance} loading={!w.ready} icon={<KumbaraIcon />} /></span>
      </div>
      <h1>{t("shop")}</h1>
      {notice && <div className="shop-notice" role="alert">⚠️ {notice}</div>}
      {TEST_MODE && <div className="test-banner">{t("testMode")}</div>}
      {msg && <div className="toast">{msg}</div>}

      <button type="button" className="vip-banner" onClick={() => setVipOpen(true)}>
        <span className="vip-banner-crown" aria-hidden>👑</span>
        <span className="vip-banner-text"><b>{t("vipTitle")}</b><small>{t("vipBannerSub", { n: formatNumber(VIP_BONUS_CHIPS) })}</small></span>
        <span className="vip-banner-price">{VIP_PRODUCT.testPrice}<small>/{t("vipMonth")}</small></span>
      </button>
      <p className="muted small sub-note">{t("vipAutoRenew", { price: VIP_PRODUCT.testPrice })}</p>
      {vipOpen && <VipModal onClose={() => setVipOpen(false)} />}
      <PurchaseConsent onChange={setConsent} />

      <div className="packs">
        {CHIP_PACKS.map((p) => (
          <div key={p.productId} className="pack">
            {(p.badge || packSaving(p) > 0) && (
              <span className={`pack-badge ${p.badge === "badge_best" ? "best" : ""}`}>
                {p.badge ? t(p.badge) : ""}{p.badge && packSaving(p) > 0 && p.badge !== "badge_popular" ? " · " : ""}{packSaving(p) > 0 && p.badge !== "badge_popular" ? t("badge_save", { n: packSaving(p) }) : ""}
              </span>
            )}
            <Chips amount={p.chips} big />
            <button type="button" className="primary" disabled={!purchasesAvailable() || !!busy || !consent}
              title={!consent ? t("consentNeeded") : undefined} onClick={() => buy(p.productId)}>
              {busy === p.productId ? "…" : purchasesAvailable() ? p.testPrice : t("soon")}
            </button>
          </div>
        ))}
      </div>

      <button type="button" className="link restore-btn" disabled={!!busy} onClick={() => void restore()}>
        {busy === "restore" ? "…" : `↺ ${t("restorePurchases")}`}
      </button>

      <GiftShop />

      <h2>{t("freeChips")}</h2>
      <div className="free">
        <div className="free-row">
          <div>
            <b>{t("watchAd")}</b>
            <div className="muted small">{t("adDesc", { n: AD_REWARD, left: Math.max(0, adsLeft) })}</div>
          </div>
          <button type="button" disabled={!adsAvailable() || adsLeft <= 0 || !!busy} onClick={watchAd}>
            {busy === "ad" ? t("adPlaying") : adsAvailable() ? t("watch") : t("soon")}
          </button>
        </div>
        <div className="free-row">
          <div>
            <b>{t("dailyReward")}</b>
            <div className="muted small">{t("dailyDesc", { n: DAILY_BONUS })}</div>
          </div>
          <button type="button" disabled={!wallet.canClaimDaily()}
            onClick={() => wallet.claimDaily().then(() => setMsg(t("dailyToast", { n: DAILY_BONUS })), (e) => setMsg(errorText(e)))}>
            {wallet.canClaimDaily() ? t("claim") : t("tomorrow")}
          </button>
        </div>
      </div>
      <p className="muted small legal">{t("legalLong")}</p>
    </div>
  );
}
