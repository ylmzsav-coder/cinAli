/**
 * El/oyun sonu müzikleri: kazanan için alkış ve "O-le!" tezahüratı eşliğinde
 * neşeli bir fanfar, kaybeden için hüzünlü, inen bir melodi. Tamamen kodla
 * üretilir (ses dosyası ve telif sorunu yok).
 */
let ctx: AudioContext | null = null;
let current: GainNode | null = null;

function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

/** Çalan müziği yumuşakça keser. */
export function stopJingle() {
  if (!ctx || !current) return;
  const g = current;
  current = null;
  const t = ctx.currentTime;
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(g.gain.value, t);
  g.gain.linearRampToValueAtTime(0, t + 0.3);
  setTimeout(() => g.disconnect(), 500);
}

function begin(vol: number): { a: AudioContext; out: GainNode; t0: number } | null {
  const a = audio();
  if (!a) return null;
  stopJingle();
  // Sınırlayıcı: üst üste binen sesler patlamasın
  const comp = a.createDynamicsCompressor();
  comp.threshold.value = -10;
  comp.knee.value = 6;
  comp.ratio.value = 12;
  comp.attack.value = 0.003;
  comp.release.value = 0.2;
  comp.connect(a.destination);
  const out = a.createGain();
  out.gain.value = vol;
  out.connect(comp);
  current = out;
  return { a, out, t0: a.currentTime + 0.05 };
}

let noiseBuf: AudioBuffer | null = null;
function noise(a: AudioContext): AudioBuffer {
  if (noiseBuf && noiseBuf.sampleRate === a.sampleRate) return noiseBuf;
  const len = a.sampleRate * 2;
  noiseBuf = a.createBuffer(1, len, a.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

/** Bakır nefesli benzeri nota (fanfar / trombon). */
function brass(a: AudioContext, out: AudioNode, freq: number, t: number, dur: number, vol: number, opts: { bend?: number; vibrato?: number; bright?: number } = {}) {
  const o = a.createOscillator();
  const o2 = a.createOscillator();
  o.type = "sawtooth";
  o2.type = "square";
  o.frequency.setValueAtTime(freq, t);
  o2.frequency.setValueAtTime(freq * 1.004, t);
  if (opts.bend) {
    o.frequency.exponentialRampToValueAtTime(freq * opts.bend, t + dur);
    o2.frequency.exponentialRampToValueAtTime(freq * opts.bend * 1.004, t + dur);
  }
  if (opts.vibrato) {
    const lfo = a.createOscillator();
    const lg = a.createGain();
    lfo.frequency.value = 5.2;
    lg.gain.value = freq * opts.vibrato;
    lfo.connect(lg);
    lg.connect(o.frequency);
    lg.connect(o2.frequency);
    lfo.start(t);
    lfo.stop(t + dur + 0.1);
  }
  const f = a.createBiquadFilter();
  f.type = "lowpass";
  const bright = opts.bright ?? 2600;
  f.frequency.setValueAtTime(400, t);
  f.frequency.linearRampToValueAtTime(bright, t + 0.06);
  f.frequency.linearRampToValueAtTime(bright * 0.6, t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.04);
  g.gain.setValueAtTime(vol * 0.85, t + Math.max(0.05, dur - 0.08));
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  const mix = a.createGain();
  mix.gain.value = 0.5;
  o2.connect(mix).connect(f);
  o.connect(f);
  f.connect(g).connect(out);
  o.start(t);
  o2.start(t);
  o.stop(t + dur + 0.05);
  o2.stop(t + dur + 0.05);
}

/** Tek bir el çırpması. */
function clap(a: AudioContext, out: AudioNode, t: number, vol: number) {
  const src = a.createBufferSource();
  src.buffer = noise(a);
  const bp = a.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 900 + Math.random() * 1400;
  bp.Q.value = 0.8 + Math.random();
  const g = a.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07 + Math.random() * 0.05);
  src.connect(bp).connect(g).connect(out);
  src.start(t, Math.random() * 1.5, 0.15);
}

/** Kalabalık alkışı: kabaran, sonra azalan yüzlerce el çırpması. */
function applause(a: AudioContext, out: AudioNode, t: number, dur: number) {
  const n = Math.floor(dur * 55);
  for (let i = 0; i < n; i++) {
    const x = Math.random();
    const at = t + x * dur;
    const env = Math.min(1, x * 5) * Math.min(1, (1 - x) * 2.5);
    clap(a, out, at, 0.16 * env * (0.5 + Math.random() * 0.5));
  }
  // alttaki uğultu
  const src = a.createBufferSource();
  src.buffer = noise(a);
  src.loop = true;
  const bp = a.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 1500;
  bp.Q.value = 0.5;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.05, t + dur * 0.2);
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  src.connect(bp).connect(g).connect(out);
  src.start(t);
  src.stop(t + dur + 0.1);
}

// Ünlü formantları (Hz): kalabalığın "O-le!" tezahüratı için
const VOWEL: Record<string, [number, number, number]> = { o: [450, 800, 2830], e: [530, 1840, 2480], ey: [400, 2000, 2550] };

/** Kalabalığın sesi: birkaç kaymalı ses, formant süzgecinden geçer. */
function chant(a: AudioContext, out: AudioNode, t: number, dur: number, freq: number, vowel: string, vol: number, glideTo?: string) {
  const voices = 7;
  for (let v = 0; v < voices; v++) {
    const o = a.createOscillator();
    o.type = "sawtooth";
    const f0 = freq * (v % 2 ? 0.5 : 1) * (1 + (Math.random() - 0.5) * 0.03);
    o.frequency.setValueAtTime(f0 * 0.94, t);
    o.frequency.linearRampToValueAtTime(f0, t + 0.06);
    const g = a.createGain();
    const st = t + Math.random() * 0.04;
    g.gain.setValueAtTime(0.0001, st);
    g.gain.linearRampToValueAtTime(vol / voices, st + 0.05);
    g.gain.setValueAtTime(vol / voices, t + dur * 0.7);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    VOWEL[vowel].forEach((fr, k) => {
      const bp = a.createBiquadFilter();
      bp.type = "bandpass";
      bp.Q.value = 9;
      bp.frequency.setValueAtTime(fr, t);
      if (glideTo) bp.frequency.linearRampToValueAtTime(VOWEL[glideTo][k], t + dur * 0.6);
      const kg = a.createGain();
      kg.gain.value = [1, 0.6, 0.25][k] * 1.4;
      g.connect(bp).connect(kg).connect(out);
    });
    o.start(t);
    o.stop(t + dur + 0.05);
  }
}

/** Basit davul vuruşu (fanfara tempo verir). */
function boom(a: AudioContext, out: AudioNode, t: number, vol: number) {
  const o = a.createOscillator();
  const g = a.createGain();
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(50, t + 0.2);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.35);
}

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

/** Kazanan: fanfar + alkış + "O-le, o-le!" tezahüratı (~6 sn). */
export function playWin() {
  const s = begin(0.6);
  if (!s) return;
  const { a, out, t0 } = s;
  const q = 0.16; // on altılık
  // Do majör fanfar: ta-ta-ta-taaa, ta-ta-taaaa
  const fan: [number, number][] = [
    [60, 1], [64, 1], [67, 1], [72, 3], [67, 1], [72, 4],
    [69, 1], [71, 1], [72, 1], [76, 2], [74, 1], [76, 1], [79, 6],
  ];
  let t = t0;
  for (const [m, len] of fan) {
    brass(a, out, hz(m), t, len * q * 0.95, 0.16);
    brass(a, out, hz(m - 12), t, len * q * 0.95, 0.07, { bright: 1400 });
    t += len * q;
  }
  // akorlarla davul
  for (let i = 0; i < 12; i++) boom(a, out, t0 + i * q * 2, i % 4 === 0 ? 0.45 : 0.25);
  const fanEnd = t;
  // son akor
  [60, 64, 67, 72].forEach((m) => brass(a, out, hz(m), fanEnd - 6 * q, 6 * q + 0.6, 0.06, { vibrato: 0.006 }));
  // alkış fanfarın ortasından başlar
  applause(a, out, t0 + 0.9, 5.2);
  // "O-le! O-le!" (iki kez)
  let c = fanEnd + 0.15;
  for (let r = 0; r < 2; r++) {
    chant(a, out, c, 0.28, 330, "o", 0.5);
    chant(a, out, c + 0.3, 0.55, 392, "e", 0.55, "ey");
    boom(a, out, c, 0.4);
    boom(a, out, c + 0.3, 0.4);
    c += 1.0;
  }
}

/** Kaybeden: hüzünlü, inen trombon "vah vah vah vaaah" ve minör kapanış (~4 sn). */
export function playLose() {
  const s = begin(2.2);
  if (!s) return;
  const { a, out, t0 } = s;
  // Inen yarım tonlar: Sol, Fa#, Fa, Mi (uzun, titreşimli, sonda düşüş)
  const notes = [55, 54, 53];
  let t = t0;
  for (const m of notes) {
    brass(a, out, hz(m), t, 0.5, 0.17, { bright: 1100, bend: 0.985 });
    t += 0.6;
  }
  brass(a, out, hz(52), t, 1.7, 0.18, { bright: 1000, vibrato: 0.018, bend: 0.94 });
  // altta yumuşak la minör akor (hüzün)
  const pad = t + 0.2;
  [45, 48, 52].forEach((m) => {
    const o = a.createOscillator();
    o.type = "triangle";
    o.frequency.value = hz(m);
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, pad);
    g.gain.linearRampToValueAtTime(0.06, pad + 0.4);
    g.gain.linearRampToValueAtTime(0.0001, pad + 2.2);
    o.connect(g).connect(out);
    o.start(pad);
    o.stop(pad + 2.3);
  });
}
