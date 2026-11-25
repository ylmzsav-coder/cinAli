import { useEffect, useRef } from "react";

/**
 * Kazanana çip yağmuru: kaybeden oyuncuların yerinden kazananın ödül yazısına doğru
 * altın çipler kavis çizerek uçar. Hareket azaltma tercihi açıksa gösterilmez.
 */
export function ChipShower({ target, onDone }: { target: string; onDone?: () => void }) {
  const layer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = layer.current;
    if (!el) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      onDone?.();
      return;
    }
    let raf = 0;
    let finished = false;
    const timers: number[] = [];
    // Hedef (ödül yazısı) modalla aynı anda çizilir: bir kare sonra konumları ölçülür
    raf = requestAnimationFrame(() => {
      const center = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
      const tEl = document.querySelector(target) ?? document.querySelector(".topbar-me");
      const tr = tEl?.getBoundingClientRect();
      // Hedef Kumbara simgesiyse çipler üstteki para deliğine düşer
      const to = tr ? (tEl?.classList.contains("kumbara-icon") ? { x: tr.left + tr.width / 2, y: tr.top + tr.height * 0.32 } : center(tr)) : { x: innerWidth / 2, y: innerHeight / 2 };
      const srcEls = [...document.querySelectorAll(".opp, .topbar-center .name-btn")];
      const sources = srcEls.length ? srcEls.map((e) => center(e.getBoundingClientRect())) : [{ x: innerWidth / 2, y: 0 }];
      const PER = Math.max(8, Math.round(30 / sources.length));
      let last = 0;
      sources.forEach((from, si) => {
        for (let i = 0; i < PER; i++) {
          const coin = document.createElement("span");
          coin.className = "fly-chip";
          el.appendChild(coin);
          const jx = (Math.random() - 0.5) * 40, jy = (Math.random() - 0.5) * 30;
          const lift = 90 + Math.random() * 90;
          const sx = from.x + jx, sy = from.y + jy;
          const mx = (sx + to.x) / 2 + (Math.random() - 0.5) * 80, my = Math.max(24, Math.min(sy, to.y) - lift);
          const delay = si * 160 + i * 85 + Math.random() * 60;
          const dur = 900 + Math.random() * 350;
          last = Math.max(last, delay + dur);
          const spin = (Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 360);
          const anim = coin.animate(
            [
              { transform: `translate(${sx}px, ${sy}px) scale(0.6) rotateY(0deg)`, opacity: 0 },
              { transform: `translate(${sx}px, ${sy}px) scale(0.9) rotateY(0deg)`, opacity: 1, offset: 0.08 },
              { transform: `translate(${mx}px, ${my}px) scale(1.15) rotateY(${spin / 2}deg)`, opacity: 1, offset: 0.5 },
              { transform: `translate(${to.x + (Math.random() - 0.5) * 24}px, ${to.y}px) scale(0.55) rotateY(${spin}deg)`, opacity: 0.9 },
            ],
            { duration: dur, delay, easing: "cubic-bezier(0.25, 0.6, 0.35, 1)", fill: "both" },
          );
          anim.onfinish = () => coin.remove();
        }
      });
      // Çipler hedefe varınca ödül yazısı parlar
      const popEl = tEl?.closest(".win-target") ?? tEl;
      if (popEl) timers.push(window.setTimeout(() => popEl.classList.add("win-pop"), 600));
      timers.push(window.setTimeout(() => {
        finished = true;
        onDone?.();
      }, last + 100));
    });
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      el.replaceChildren();
      if (!finished) onDone?.();
    };
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div ref={layer} className="chip-shower" aria-hidden />;
}
