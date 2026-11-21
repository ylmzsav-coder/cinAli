import { useState } from "react";
import { CHIP_PACKS, TEST_MODE, adsAvailable, buyPack, purchasesAvailable, showRewardedAd } from "../economy/store";
import { useWallet } from "../economy/useWallet";
import { AD_REWARD, DAILY_BONUS, wallet } from "../economy/wallet";
import { errorText, t } from "../i18n";
import { Chips } from "./Chips";

export function Shop({ onBack }: { onBack: () => void }) {
  const w = useWallet();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const adsLeft = wallet.adsLeftToday();

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
        <span className="balance small-balance"><Chips amount={w.balance} loading={!w.ready} /></span>
      </div>
      <h1>{t("shop")}</h1>
      {TEST_MODE && <div className="test-banner">{t("testMode")}</div>}
      {msg && <div className="toast">{msg}</div>}

      <div className="packs">
        {CHIP_PACKS.map((p) => (
          <div key={p.productId} className="pack">
            {p.badge && <span className="pack-badge">{t(p.badge)}</span>}
            <Chips amount={p.chips} big />
            <button type="button" className="primary" disabled={!purchasesAvailable() || !!busy}
              onClick={() => buy(p.productId)}>
              {busy === p.productId ? "…" : purchasesAvailable() ? p.testPrice : t("soon")}
            </button>
          </div>
        ))}
      </div>

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
