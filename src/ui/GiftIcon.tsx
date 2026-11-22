import { giftById } from "../economy/gifts";

/** Kare cam parfüm şişesi: köşeleri pahlı cam, amber parfüm, gümüş kare kapak. */
function PerfumeBottle({ size }: { size: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden className="gift-svg">
      <defs>
        <linearGradient id="pfCap" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8d8f93" />
          <stop offset="0.25" stopColor="#f4f5f6" />
          <stop offset="0.55" stopColor="#c3c6ca" />
          <stop offset="1" stopColor="#6f7276" />
        </linearGradient>
        <linearGradient id="pfJuice" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fbe27a" />
          <stop offset="0.45" stopColor="#efbf1d" />
          <stop offset="1" stopColor="#c58a06" />
        </linearGradient>
      </defs>
      {/* kapak ve boyun */}
      <rect x="21" y="3" width="22" height="13" rx="1.6" fill="url(#pfCap)" stroke="#6f7276" strokeWidth="0.8" />
      <rect x="21.5" y="3.5" width="21" height="2.2" rx="1" fill="#ffffff" opacity="0.55" />
      <rect x="26" y="16" width="12" height="4.5" fill="url(#pfCap)" stroke="#6f7276" strokeWidth="0.6" />
      {/* cam gövde (pahlı köşeler) */}
      <path d="M18 20.5 H46 L50.5 25 V56 L46 60.5 H18 L13.5 56 V25 Z" fill="rgba(235,240,242,0.55)" stroke="#b9c0c4" strokeWidth="1" />
      {/* parfüm */}
      <path d="M19.5 23 H44.5 L48 26.5 V53 L45 55.5 H19 L16 53 V26.5 Z" fill="url(#pfJuice)" />
      {/* öndeki çerçeve yansıması ve sıvı çizgisi */}
      <rect x="20" y="27" width="16" height="15" rx="0.8" fill="none" stroke="#fff5c4" strokeWidth="0.9" opacity="0.7" />
      <path d="M17 40.5 H47" stroke="#b07a05" strokeWidth="0.6" opacity="0.6" />
      {/* kalın cam taban ve parlamalar */}
      <path d="M16.5 55.8 H47.5 L45.5 58.6 H18.5 Z" fill="rgba(255,255,255,0.6)" />
      <path d="M16.2 27 V52" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />
      <path d="M47.5 28 V44" stroke="#ffffff" strokeWidth="0.9" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

/** Hediye simgesi: çizilmiş özel simge varsa o, yoksa emoji. */
export function GiftIcon({ id, size = "1em" }: { id: string; size?: string }) {
  if (id === "parfum_e") return <PerfumeBottle size={size} />;
  return <span className="gift-emoji-inline" style={{ fontSize: size }}>{giftById(id)?.emoji ?? "🎁"}</span>;
}
