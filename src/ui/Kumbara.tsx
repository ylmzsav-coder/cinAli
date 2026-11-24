import { useId } from "react";

/**
 * Kumbara: çiplerin biriktiği yer. Özgün çizim: krom, oval gövdeli, üstünde
 * para deliği ve taşıma sapı olan eski usul madeni kumbara (amblemsiz).
 */
export function KumbaraIcon({ size = "1.6em" }: { size?: string }) {
  const id = useId().replace(/:/g, "");
  const body = `kb-body-${id}`, top = `kb-top-${id}`, bar = `kb-bar-${id}`, coin = `kb-coin-${id}`;
  return (
    <svg className="kumbara-icon" viewBox="0 0 64 56" width={size} height={size} aria-hidden focusable="false">
      <defs>
        <linearGradient id={body} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#6f7479" />
          <stop offset="0.18" stopColor="#d9dde1" />
          <stop offset="0.32" stopColor="#ffffff" />
          <stop offset="0.5" stopColor="#b9bec3" />
          <stop offset="0.72" stopColor="#e8ebee" />
          <stop offset="0.9" stopColor="#8d9297" />
          <stop offset="1" stopColor="#5b6065" />
        </linearGradient>
        <linearGradient id={top} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#aeb3b8" />
        </linearGradient>
        <linearGradient id={bar} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f4f6f8" />
          <stop offset="0.5" stopColor="#9aa0a5" />
          <stop offset="1" stopColor="#dfe3e6" />
        </linearGradient>
        <radialGradient id={coin} cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#fff3b0" />
          <stop offset="0.55" stopColor="#f5c542" />
          <stop offset="1" stopColor="#b8860b" />
        </radialGradient>
      </defs>
      {/* Taşıma sapı ve ayakları */}
      <rect x="13" y="7" width="38" height="5" rx="2.5" fill={`url(#${bar})`} stroke="#5b6065" strokeWidth="0.8" />
      <rect x="10" y="9" width="6" height="9" rx="2.5" fill={`url(#${bar})`} stroke="#5b6065" strokeWidth="0.8" />
      <rect x="48" y="9" width="6" height="9" rx="2.5" fill={`url(#${bar})`} stroke="#5b6065" strokeWidth="0.8" />
      {/* Gövde */}
      <rect x="4" y="15" width="56" height="38" rx="13" fill={`url(#${body})`} stroke="#4f5459" strokeWidth="1.2" />
      {/* Üst yüzey ve para deliği */}
      <ellipse cx="32" cy="19.5" rx="25" ry="4.5" fill={`url(#${top})`} opacity="0.9" />
      <rect x="21" y="17.6" width="22" height="3.2" rx="1.2" fill="#2b2f33" />
      {/* Ön yüzde altın çip */}
      <circle cx="32" cy="36" r="8" fill={`url(#${coin})`} stroke="#9a6d00" strokeWidth="1" />
      <circle cx="32" cy="36" r="5.2" fill="none" stroke="#9a6d00" strokeWidth="0.9" opacity="0.7" />
      {/* Kilit perçini ve parlama */}
      <circle cx="51" cy="45" r="1.6" fill="#8d9297" stroke="#4f5459" strokeWidth="0.6" />
      <path d="M12 24 Q10 34 12 45" stroke="#ffffff" strokeWidth="2" fill="none" opacity="0.7" strokeLinecap="round" />
    </svg>
  );
}
