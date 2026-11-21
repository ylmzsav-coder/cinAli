import { useState } from "react";
import { CHIP_PACKS, TEST_MODE, adsAvailable, buyPack, purchasesAvailable, showRewardedAd } from "../economy/store";
import { formatChips } from "../economy/tables";
import { useWallet } from "../economy/useWallet";
import { AD_REWARD, DAILY_BONUS, wallet } from "../economy/wallet";
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
      wallet.add(chips, "satin-alma", productId);
      setMsg(`+${formatChips(chips)} çip hesabınıza eklendi. Teşekkürler!`);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const watchAd = async () => {
    setBusy("ad");
    setMsg(null);
    try {
      if ((await showRewardedAd()) && wallet.rewardAd()) setMsg(`+${AD_REWARD} çip kazandınız!`);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <button type="button" className="link" onClick={onBack}>‹ Geri</button>
        <span className="balance small-balance"><Chips amount={w.balance} /></span>
      </div>
      <h1>Mağaza</h1>
      {TEST_MODE && <div className="test-banner">TEST MODU: gerçek ödeme alınmaz.</div>}
      {msg && <div className="toast">{msg}</div>}

      <div className="packs">
        {CHIP_PACKS.map((p) => (
          <div key={p.productId} className="pack">
            {p.badge && <span className="pack-badge">{p.badge}</span>}
            <Chips amount={p.chips} big />
            <button type="button" className="primary" disabled={!purchasesAvailable() || !!busy}
              onClick={() => buy(p.productId)}>
              {busy === p.productId ? "…" : purchasesAvailable() ? p.testPrice : "Yakında"}
            </button>
          </div>
        ))}
      </div>

      <h2>Bedava çip</h2>
      <div className="free">
        <div className="free-row">
          <div>
            <b>Reklam izle</b>
            <div className="muted small">+{AD_REWARD} çip · bugün {Math.max(0, adsLeft)} hakkınız kaldı</div>
          </div>
          <button type="button" disabled={!adsAvailable() || adsLeft <= 0 || !!busy} onClick={watchAd}>
            {busy === "ad" ? "Reklam oynuyor…" : adsAvailable() ? "İzle" : "Yakında"}
          </button>
        </div>
        <div className="free-row">
          <div>
            <b>Günlük ödül</b>
            <div className="muted small">Her gün +{formatChips(DAILY_BONUS)} çip</div>
          </div>
          <button type="button" disabled={!wallet.canClaimDaily()} onClick={() => wallet.claimDaily() && setMsg(`+${formatChips(DAILY_BONUS)} çip!`)}>
            {wallet.canClaimDaily() ? "Al" : "Yarın"}
          </button>
        </div>
      </div>
      <p className="muted small legal">
        Çipler yalnızca Cinali içinde kullanılan sanal oyun parasıdır. Gerçek paraya veya ödüle
        çevrilemez, başka kullanıcılara devredilemez.
      </p>
    </div>
  );
}
