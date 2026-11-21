/**
 * Son saniyeler için ses ve titreşim.
 * - Ses: Web Audio ile kısa "tık" (dosya gerekmez). Tarayıcılar sesi ancak bir
 *   dokunuştan sonra açar; bu yüzden ilk dokunuşta ses motoru hazırlanır.
 * - Titreşim: uygulamada (Android/iOS) Capacitor Haptics, web'de
 *   navigator.vibrate (Android tarayıcıları; iPhone Safari desteklemez).
 */
import { Capacitor } from "@capacitor/core";

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** İlk kullanıcı dokunuşunda ses motorunu açar (tarayıcı kuralı). */
export function unlockAudio() {
  const handler = () => {
    audio();
    window.removeEventListener("pointerdown", handler);
    window.removeEventListener("keydown", handler);
  };
  window.addEventListener("pointerdown", handler);
  window.addEventListener("keydown", handler);
}

/** Kısa tık sesi; son saniyede daha tiz ve uzun. */
export function tick(final = false) {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = "square";
  osc.frequency.value = final ? 1320 : 880;
  const dur = final ? 0.22 : 0.08;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.25, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** Mesaj geldiğinde yumuşak "pop" sesi. */
export function pop() {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(520, t0);
  osc.frequency.exponentialRampToValueAtTime(880, t0 + 0.09);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
  osc.connect(gain).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + 0.2);
}

/** Kısa titreşim; son saniyede daha güçlü. */
export function buzz(final = false) {
  if (Capacitor.isNativePlatform()) {
    import("@capacitor/haptics")
      .then(({ Haptics, ImpactStyle }) => Haptics.impact({ style: final ? ImpactStyle.Heavy : ImpactStyle.Light }))
      .catch(() => {});
    return;
  }
  try {
    navigator.vibrate?.(final ? 200 : 40);
  } catch {
    /* desteklenmiyor */
  }
}
