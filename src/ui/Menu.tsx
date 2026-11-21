import { useState } from "react";
import type { BotLevel } from "../game/bot";
import { Settings } from "../storage";

interface Props {
  settings: Settings;
  canResume: boolean;
  onStart: (s: Settings) => void;
  onResume: () => void;
  onRules: () => void;
}

export function Menu({ settings, canResume, onStart, onResume, onRules }: Props) {
  const [s, setS] = useState(settings);
  return (
    <div className="page menu">
      <div className="logo" aria-hidden>
        {[..."CİNALİ"].map((l, i) => (
          <span key={i} className={`tile tile-md c-${["kirmizi", "mavi", "sari", "siyah"][i % 4]}`}>
            <span className="tile-letter">{l}</span>
          </span>
        ))}
      </div>
      <p className="muted">Harflerle oynanan okey</p>

      {canResume && (
        <button type="button" className="primary big" onClick={onResume}>Oyuna Devam Et</button>
      )}

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
      <button type="button" className={canResume ? "big" : "primary big"} onClick={() => onStart({ ...s, name: s.name.trim() || "Sen" })}>
        Yeni Oyun
      </button>
      <button type="button" className="link" onClick={onRules}>Kurallar</button>
    </div>
  );
}
