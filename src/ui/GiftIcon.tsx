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

/** Gülen sarı kahve fincanı: iki eliyle sarılıyor (oyun için çizilmiş özgün simge). */
function HappyCoffee({ size }: { size: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden className="gift-svg">
      <defs>
        <linearGradient id="hcCup" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe066" />
          <stop offset="1" stopColor="#f6b40e" />
        </linearGradient>
        <radialGradient id="hcCoffee" cx="0.45" cy="0.4" r="0.7">
          <stop offset="0" stopColor="#6b3a1f" />
          <stop offset="1" stopColor="#3b1d0c" />
        </radialGradient>
      </defs>
      {/* kulp */}
      <path d="M49 22 C60 22 60 40 48 41" fill="none" stroke="#e09a08" strokeWidth="6" strokeLinecap="round" />
      <path d="M49 22 C60 22 60 40 48 41" fill="none" stroke="#ffd23f" strokeWidth="3" strokeLinecap="round" />
      {/* fincan gövdesi */}
      <path d="M8 16 H52 C52 38 46 54 30 54 C14 54 8 38 8 16 Z" fill="url(#hcCup)" stroke="#d68a00" strokeWidth="1.5" />
      {/* kahve ve köpük */}
      <ellipse cx="30" cy="16.5" rx="21" ry="5" fill="url(#hcCoffee)" stroke="#d68a00" strokeWidth="1.5" />
      <circle cx="40" cy="15" r="1.1" fill="#c98b5a" /><circle cx="43" cy="16.5" r="0.8" fill="#c98b5a" /><circle cx="37.5" cy="17.5" r="0.7" fill="#c98b5a" />
      {/* gülen gözler */}
      <path d="M18 29 Q22 24 26 29" fill="none" stroke="#5a3a10" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M34 29 Q38 24 42 29" fill="none" stroke="#5a3a10" strokeWidth="2.4" strokeLinecap="round" />
      {/* gülümseme */}
      <path d="M21 36 Q30 46 39 36 Q30 40 21 36 Z" fill="#5a3a10" />
      {/* yanaklar */}
      <ellipse cx="17" cy="35" rx="3" ry="1.8" fill="#ff9a62" opacity="0.6" />
      <ellipse cx="43" cy="35" rx="3" ry="1.8" fill="#ff9a62" opacity="0.6" />
      {/* sarılan eller */}
      <g fill="#ffd23f" stroke="#d68a00" strokeWidth="1.2" strokeLinejoin="round">
        <path d="M14 46 C8 44 3 41 2 38 C4 37 7 39 9 40 C6 36 4 33 5 31 C7 31 9 34 11 37 C10 33 10 30 12 30 C14 31 14 35 15 38 C15 35 16 33 18 34 C19 37 19 42 18 46 Z" />
        <path d="M46 46 C52 44 57 41 58 38 C56 37 53 39 51 40 C54 36 56 33 55 31 C53 31 51 34 49 37 C50 33 50 30 48 30 C46 31 46 35 45 38 C45 35 44 33 42 34 C41 37 41 42 42 46 Z" />
      </g>
    </svg>
  );
}

/** Hediye simgesi: çizilmiş özel simge varsa o, yoksa emoji. */
export function GiftIcon({ id, size = "1em" }: { id: string; size?: string }) {
  if (id === "parfum_e") return <PerfumeBottle size={size} />;
  if (id === "gul") return <HappyCoffee size={size} />;
  return <span className="gift-emoji-inline" style={{ fontSize: size }}>{giftById(id)?.emoji ?? "🎁"}</span>;
}
