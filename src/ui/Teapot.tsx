import { useId } from "react";

/** Demlik (Çayhane): özgün çizim; gövde "Oyunu kapat" düğmesiyle aynı kırmızı tonda. */
export function TeapotIcon({ size = "1.3em" }: { size?: string }) {
  const id = useId().replace(/:/g, "");
  const g = `tp-${id}`;
  return (
    <svg className="teapot-icon" viewBox="0 0 64 52" width={size} height={size} aria-hidden focusable="false">
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ef5350" />
          <stop offset="1" stopColor="#b3261e" />
        </linearGradient>
      </defs>
      {/* Emzik ve kulp */}
      <path d="M14 26 Q5 22 3 12 Q9 16 15 20 Z" fill={`url(#${g})`} stroke="#5c0f0a" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M48 20 Q61 19 59 31 Q57 40 46 40" fill="none" stroke="#5c0f0a" strokeWidth="7" strokeLinecap="round" />
      <path d="M48 20 Q61 19 59 31 Q57 40 46 40" fill="none" stroke={`url(#${g})`} strokeWidth="4" strokeLinecap="round" />
      {/* Gövde */}
      <path d="M12 26 Q12 14 32 14 Q52 14 52 26 Q52 46 32 47 Q12 46 12 26 Z" fill={`url(#${g})`} stroke="#5c0f0a" strokeWidth="1.8" />
      {/* Kapak ve tepe */}
      <ellipse cx="32" cy="14" rx="13" ry="3.6" fill="#ef5350" stroke="#5c0f0a" strokeWidth="1.6" />
      <circle cx="32" cy="8.5" r="3.2" fill="#ef5350" stroke="#5c0f0a" strokeWidth="1.6" />
      {/* Parlama ve alt çizgi */}
      <path d="M18 24 Q18 19 24 18" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" opacity="0.7" />
      <path d="M19 40 Q32 43 45 40" fill="none" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" opacity="0.45" />
    </svg>
  );
}
