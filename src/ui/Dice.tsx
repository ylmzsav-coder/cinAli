import { useId } from "react";

/** Tek zar: 4 noktalı yüz (özgün çizim). */
function Die({ x, rot, grad }: { x: number; rot: number; grad: string }) {
  return (
    <g transform={`translate(${x} 4) rotate(${rot} 14 14)`}>
      <rect x="0" y="0" width="28" height="28" rx="6" fill={`url(#${grad})`} stroke="#9aa0a6" strokeWidth="1" />
      {[[8, 8], [20, 8], [8, 20], [20, 20]].map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.9" fill="#1b1b1b" />)}
    </g>
  );
}

/** Çarli düğmesindeki iki zar: ikisi de 4 gösterir (dört dört). */
export function DiceIcon({ size = "1.6em" }: { size?: string }) {
  const grad = `dice-${useId().replace(/:/g, "")}`;
  return (
    <svg className="dice-icon" viewBox="0 0 68 38" width={`calc(${size} * 1.8)`} height={size} aria-hidden focusable="false">
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#dfe3e6" />
        </linearGradient>
      </defs>
      <Die x={3} rot={-10} grad={grad} />
      <Die x={36} rot={8} grad={grad} />
    </svg>
  );
}
