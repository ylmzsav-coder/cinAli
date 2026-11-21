import { useState } from "react";
import { DAILY_BONUS } from "../economy/wallet";
import { useWallet } from "../economy/useWallet";
import { wallet } from "../economy/wallet";
import type { BotLevel } from "../game/bot";
import { Settings } from "../storage";
import { Chips } from "./Chips";

interface HubProps {
  canResume: boolean;
  resumeLabel: string;
  onResume: () => void;
  onTables: () => void;
  onPractice: () => void;
  onShop: () => void;
  onRules: () => void;
}

export function Hub({ canResume, resumeLabel, onResume, onTables, onPractice, onShop, onRules }: HubProps) {
  const w = useWallet();
  const [toast, setToast] = useState<string | null>(null);
  return (
    <div className="page menu">
      <Logo />
      <p className="muted">Harflerle oynanan okey</p>
      <button type="button" className="balance" onClick={onShop} aria-label="Çip bakiyesi, mağazaya git">
        <Chips amount={w.balance} big />
        <span className="plus-chip">+</span>
      </button>
      {wallet.canClaimDaily() && (
        <button type="button" className="gift big" onClick={() => {
          if (wallet.claimDaily()) setToast(`Günlük ödül: +${DAILY_BONUS.toLocaleString("tr-TR")} çip!`);
        }}>
          🎁 Günlük ödülü al
        </button>
      )}
      {toast && <div className="toast">{toast}</div>}
      {canResume && <button type="button" className="primary big" onClick={onResume}>{resumeLabel}</button>}
      <button type="button" className={canResume ? "big" : "primary big"} onClick={onTables}>Çipli Masalar</button>
      <button type="button" className="big" onClick={onPractice}>Pratik (çipsiz)</button>
      <button type="button" className="big" onClick={onShop}>Mağaza</button>
      <button type="button" className="link" onClick={onRules}>Kurallar</button>
      <p className="muted small legal">Çipler sanal oyun parasıdır; gerçek paraya çevrilemez, devredilemez.</p>
    </div>
  );
}

export function Logo() {
  return (
    <div className="logo" aria-hidden>
      {[..."CİNALİ"].map((l, i) => (
        <span key={i} className={`tile tile-md c-${["kirmizi", "mavi", "sari", "siyah"][i % 4]}`}>
          <span className="tile-letter">{l}</span>
        </span>
      ))}
    </div>
  );
}

interface PracticeProps {
  settings: Settings;
  onStart: (s: Settings) => void;
  onBack: () => void;
}

export function Practice({ settings, onStart, onBack }: PracticeProps) {
  const [s, setS] = useState(settings);
  return (
    <div className="page menu">
      <button type="button" className="link back" onClick={onBack}>‹ Geri</button>
      <h1>Pratik</h1>
      <p className="muted">Çip harcamadan bilgisayara karşı oynayın.</p>
      <div className="form">
        <label>
          Adınız
          <input value={s.name} maxLength={12} onChange={(e) => setS({ ...s, name: e.target.value })} />
        </label>
        <label>
          El sayısı
          <select value={s.hands} onChange={(e) => setS({ ...s, hands: Number(e.target.value) })}>
            {[1, 3, 5, 7, 9].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label>
          Rakip seviyesi
          <select value={s.level} onChange={(e) => setS({ ...s, level: e.target.value as BotLevel })}>
            <option value="kolay">Kolay</option>
            <option value="orta">Orta</option>
            <option value="zor">Zor</option>
          </select>
        </label>
        <label>
          Oyun hızı
          <select value={s.speed} onChange={(e) => setS({ ...s, speed: e.target.value as Settings["speed"] })}>
            <option value="yavas">Yavaş</option>
            <option value="normal">Normal</option>
            <option value="hizli">Hızlı</option>
          </select>
        </label>
      </div>
      <button type="button" className="primary big" onClick={() => onStart({ ...s, name: s.name.trim() || "Sen" })}>
        Başla
      </button>
    </div>
  );
}
