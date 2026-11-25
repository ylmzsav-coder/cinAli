/** El sallayan gülen yüz ("Hello" hazır mesajlarının sonunda): özgün çizim. */
export function HelloFace({ size = "1.7em" }: { size?: string }) {
  return (
    <svg className="hello-face" viewBox="0 0 64 56" width={size} height={size} aria-hidden focusable="false">
      <defs>
        <radialGradient id="hf-face" cx="0.38" cy="0.32" r="0.75">
          <stop offset="0" stopColor="#fff59d" />
          <stop offset="0.55" stopColor="#ffd23f" />
          <stop offset="1" stopColor="#e09100" />
        </radialGradient>
      </defs>
      {/* Yüz */}
      <circle cx="26" cy="31" r="22" fill="url(#hf-face)" stroke="#b86e00" strokeWidth="1.6" />
      {/* Gözler: beyaz, mavi bebek, parıltı */}
      <ellipse cx="18" cy="25" rx="5" ry="6.5" fill="#fff" stroke="#5d3a00" strokeWidth="1" />
      <ellipse cx="32" cy="25" rx="5" ry="6.5" fill="#fff" stroke="#5d3a00" strokeWidth="1" />
      <circle cx="19" cy="26.5" r="3" fill="#2f7fd6" />
      <circle cx="31" cy="26.5" r="3" fill="#2f7fd6" />
      <circle cx="19" cy="26.5" r="1.4" fill="#111" />
      <circle cx="31" cy="26.5" r="1.4" fill="#111" />
      <circle cx="20" cy="25.3" r="0.8" fill="#fff" />
      <circle cx="32" cy="25.3" r="0.8" fill="#fff" />
      {/* Kaşlar */}
      <path d="M13 17 Q18 14 22 17" stroke="#5d3a00" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <path d="M28 17 Q33 14 37 17" stroke="#5d3a00" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      {/* Kocaman açık gülüş, dil */}
      <path d="M13 36 Q26 52 40 36 Z" fill="#7a1f1f" stroke="#5d3a00" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M19 44 Q26 40 33 44 Q26 49 19 44 Z" fill="#ff6b6b" />
      <path d="M14 36.5 H39" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      {/* El sallayan beyaz eldivenli el */}
      <g transform="rotate(14 52 20)">
        <path d="M44 30 Q42 22 45 14 Q46 11 48 12 L49 20 L50 8 Q51 5 53 6 Q54.5 7 54 10 L53.5 19 L56 9 Q57 6.5 59 7.5 Q60.5 8.5 60 11 L57.5 21 L60 14 Q61.5 12 63 13 Q64 14.5 63 17 L59 29 Q57 35 50 35 Q46 35 44 30 Z"
          fill="#fff" stroke="#333" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M46 31 Q49 33 53 32" stroke="#333" strokeWidth="1" fill="none" />
      </g>
      {/* Sallama çizgileri */}
      <path d="M41 6 Q39 9 40 12" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.9" />
      <path d="M37 9 Q36 11 37 13" stroke="#fff" strokeWidth="1.3" fill="none" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}
