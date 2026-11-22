import { giftById } from "../economy/gifts";

/** İnce belli cam çay bardağı, demli çay ve kırmızı desenli tabak. */
function TeaGlass({ size }: { size: string }) {
  const glass = "M17 7 C17 17 23 21 23 27 C23 33 18 37 18 44 C18 50 24 52.5 32 52.5 C40 52.5 46 50 46 44 C46 37 41 33 41 27 C41 21 47 17 47 7 Z";
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden className="tea-glass">
      <defs>
        <linearGradient id="teaFill" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#4a0500" />
          <stop offset="0.35" stopColor="#8f1505" />
          <stop offset="0.6" stopColor="#b8320a" />
          <stop offset="1" stopColor="#5a0800" />
        </linearGradient>
        <linearGradient id="teaTop" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c9500e" />
          <stop offset="1" stopColor="#8a1a04" />
        </linearGradient>
        <clipPath id="teaClip"><path d={glass} /></clipPath>
      </defs>
      {/* tabak */}
      <ellipse cx="32" cy="55" rx="29" ry="7.5" fill="#f4f1ec" stroke="#cfc8bd" strokeWidth="1" />
      <ellipse cx="32" cy="54.3" rx="20" ry="4.6" fill="#ffffff" stroke="#e6e0d6" strokeWidth="0.8" />
      {[-24, -13, 13, 24].map((dx) => (
        <ellipse key={dx} cx={32 + dx} cy={55.6 + Math.abs(dx) / 14} rx="3.2" ry="1.6" fill="#d62828" transform={`rotate(${dx > 0 ? 18 : -18} ${32 + dx} 56)`} />
      ))}
      <ellipse cx="32" cy="61.2" rx="3.4" ry="1.3" fill="#d62828" />
      {[-19, 19, -6, 6].map((dx) => (
        <circle key={dx} cx={32 + dx} cy={dx === -6 || dx === 6 ? 60.6 : 51.4} r="0.9" fill="#c9a227" />
      ))}
      {/* çay */}
      <g clipPath="url(#teaClip)">
        <rect x="10" y="13" width="44" height="42" fill="url(#teaFill)" />
        <ellipse cx="32" cy="13.2" rx="14.4" ry="2.2" fill="url(#teaTop)" />
        <rect x="21" y="40" width="6" height="11" rx="3" fill="#f08c3a" opacity="0.35" />
      </g>
      {/* cam */}
      <path d={glass} fill="rgba(255,255,255,0.12)" stroke="#9aa3a8" strokeWidth="1.1" />
      <ellipse cx="32" cy="7" rx="15" ry="2.4" fill="rgba(255,255,255,0.35)" stroke="#9aa3a8" strokeWidth="1" />
      <path d="M21 11 C21.5 17 25 21 25.5 26" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.75" />
      <path d="M21 40 C20.5 44 21.5 48 24 50" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" fill="none" opacity="0.55" />
      <path d="M43 10 C42.5 15 40.5 19 39.5 22" stroke="#fff" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.5" />
    </svg>
  );
}

/** Hediye simgesi: çizilmiş özel simge varsa o, yoksa emoji. */
export function GiftIcon({ id, size = "1em" }: { id: string; size?: string }) {
  if (id === "cay") return <TeaGlass size={size} />;
  return <span className="gift-emoji-inline">{giftById(id)?.emoji ?? "🎁"}</span>;
}
