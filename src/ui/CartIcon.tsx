/** Kırmızı telli alışveriş sepeti, ahşap tutma kolu (Satın al / Mağaza düğmeleri). */
export function CartIcon() {
  return (
    <svg className="cart-ico" viewBox="0 0 64 64" aria-hidden>
      {/* ahşap tutma kolu */}
      <rect x="45" y="5" width="15" height="7" rx="3" transform="rotate(-12 52 8)" fill="#9c6630" stroke="#5d3a17" strokeWidth="1.5" />
      <path d="M47 7.5 L58 5.2" stroke="#d9a066" strokeWidth="1.6" strokeLinecap="round" transform="rotate(-2 52 8)" />
      {/* kırmızı çerçeve */}
      <path d="M47 11 L40 42 H13" fill="none" stroke="#b71c1c" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {/* telli sepet */}
      <path d="M6 16 H45 L40 37 H11 Z" fill="#e53935" stroke="#b71c1c" strokeWidth="2.5" strokeLinejoin="round" />
      <g stroke="#ff9e94" strokeWidth="1.6">
        <path d="M7.5 22.5 H43.5 M9 29.5 H42 M10.5 34 H40.8" />
        <path d="M14 16.5 L16 36.5 M21 16.5 L22.2 36.5 M28 16.5 L28.4 36.5 M35 16.5 L34.6 36.5 M41.5 16.5 L39.5 33" />
      </g>
      {/* tekerlekler */}
      <circle cx="16" cy="52" r="5" fill="#424242" stroke="#212121" strokeWidth="1.5" />
      <circle cx="37" cy="52" r="5" fill="#424242" stroke="#212121" strokeWidth="1.5" />
      <path d="M16 42 V47 M37 42 V47" stroke="#b71c1c" strokeWidth="3" />
    </svg>
  );
}
