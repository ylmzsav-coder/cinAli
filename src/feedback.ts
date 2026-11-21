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

/**
 * Gerçekçi taş sesleri (kod içinde üretilir): kısa gürültü "tık" + taşın kendi
 * tınısı (rezonans) + masaya değdiğinde boğuk vuruş. Her seferinde hafif farklı
 * ton, böylece mekanik değil doğal duyulur.
 *  - pick: taşı tutma (hafif)
 *  - drop: ıstakaya bırakma
 *  - discard: yere atma (daha dolgun, kayma sesiyle)
 *  - open: el açma / kelime koyma (art arda birkaç taş)
 */
export type TileSound = "pick" | "drop" | "discard" | "open";

function clack(a: AudioContext, t: number, strength: number, pitch: number) {
  // 1) tık: filtrelenmiş kısa gürültü
  const len = Math.floor(a.sampleRate * 0.035);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (a.sampleRate * 0.004));
  const noise = a.createBufferSource();
  noise.buffer = buf;
  const bp = a.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 2400 * pitch;
  bp.Q.value = 2.5;
  const ng = a.createGain();
  ng.gain.value = 0.9 * strength;
  noise.connect(bp).connect(ng).connect(a.destination);
  noise.start(t);
  // 2) taşın tınısı (sert plastik/kemik)
  const body = a.createOscillator();
  body.type = "sine";
  body.frequency.setValueAtTime(1350 * pitch, t);
  body.frequency.exponentialRampToValueAtTime(1050 * pitch, t + 0.05);
  const bg = a.createGain();
  bg.gain.setValueAtTime(0.18 * strength, t);
  bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  body.connect(bg).connect(a.destination);
  body.start(t);
  body.stop(t + 0.07);
  // 3) masaya değme: boğuk vuruş
  const thud = a.createOscillator();
  thud.type = "sine";
  thud.frequency.setValueAtTime(190, t);
  thud.frequency.exponentialRampToValueAtTime(90, t + 0.06);
  const tg = a.createGain();
  tg.gain.setValueAtTime(0.35 * strength, t);
  tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
  thud.connect(tg).connect(a.destination);
  thud.start(t);
  thud.stop(t + 0.09);
}

function slide(a: AudioContext, t: number) {
  const len = Math.floor(a.sampleRate * 0.12);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.sin((Math.PI * i) / len) * 0.5;
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = 1200;
  f.Q.value = 0.8;
  const g = a.createGain();
  g.gain.value = 0.25;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}

export function tileSound(kind: TileSound) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + 0.005;
  const v = () => 0.92 + Math.random() * 0.16;
  switch (kind) {
    case "pick":
      clack(a, t, 0.35, 1.15 * v());
      break;
    case "drop":
      clack(a, t, 0.8, v());
      break;
    case "discard":
      slide(a, t);
      clack(a, t + 0.11, 1, 0.9 * v());
      break;
    case "open":
      for (let i = 0; i < 4; i++) clack(a, t + i * 0.07 + Math.random() * 0.02, 0.7 + Math.random() * 0.3, v());
      break;
  }
}
