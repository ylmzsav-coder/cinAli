import { useId } from "react";

/** Siyah araba (Sosyete düğmesi): özgün çizim, önden görünüş; parlak siyah gövde, gümüş farlar. */
export function BlackCarIcon({ size = "1.35em" }: { size?: string }) {
  const id = useId().replace(/:/g, "");
  const body = `car-b-${id}`, glass = `car-g-${id}`;
  return (
    <svg className="car-icon" viewBox="0 0 64 48" width={size} height={size} aria-hidden focusable="false">
      <defs>
        <linearGradient id={body} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a4f55" />
          <stop offset="0.45" stopColor="#1c1f22" />
          <stop offset="1" stopColor="#050607" />
        </linearGradient>
        <linearGradient id={glass} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9fb3c4" />
          <stop offset="1" stopColor="#4d6273" />
        </linearGradient>
      </defs>
      {/* Tekerlekler */}
      <rect x="8" y="34" width="10" height="11" rx="3" fill="#0b0c0d" />
      <rect x="46" y="34" width="10" height="11" rx="3" fill="#0b0c0d" />
      {/* Aynalar */}
      <rect x="1.5" y="18" width="7" height="5" rx="2" fill="#111" />
      <rect x="55.5" y="18" width="7" height="5" rx="2" fill="#111" />
      {/* Gövde ve tavan */}
      <path d="M14 8 Q16 4 22 4 H42 Q48 4 50 8 L55 20 Q60 22 60 28 V36 Q60 40 56 40 H8 Q4 40 4 36 V28 Q4 22 9 20 Z" fill={`url(#${body})`} stroke="#000" strokeWidth="1.2" />
      {/* Ön cam */}
      <path d="M17 9 Q18 7.5 21 7.5 H43 Q46 7.5 47 9 L51 19 H13 Z" fill={`url(#${glass})`} stroke="#000" strokeWidth="0.8" />
      <path d="M21 10 L18 17" stroke="#fff" strokeWidth="1.4" opacity="0.5" strokeLinecap="round" />
      {/* Farlar ve ızgara */}
      <rect x="7" y="25" width="11" height="6" rx="3" fill="#f4f6f8" stroke="#8d9297" strokeWidth="0.8" />
      <rect x="46" y="25" width="11" height="6" rx="3" fill="#f4f6f8" stroke="#8d9297" strokeWidth="0.8" />
      <rect x="22" y="26" width="20" height="6" rx="2" fill="#0d0e10" stroke="#9aa0a5" strokeWidth="1" />
      <path d="M24 29 H40" stroke="#6b7076" strokeWidth="0.9" />
      {/* Tampon parlaması */}
      <path d="M10 36.5 H54" stroke="#6b7076" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}
