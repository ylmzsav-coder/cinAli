/**
 * Word Okey giriş müziği: tamamen bu uygulama için, kod içinde üretilen
 * özgün bir döngü (telif sorunu yok, ses dosyası gerekmez).
 * Hicaz makamında (Re hicaz: Re Mi♭ Fa♯ Sol La Si♭ Do Re), mızrap benzeri tel
 * sesi ve darbuka (maksum) ritmi; 108 vuruş/dakika, 4 ölçülük döngü.
 */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let nextTime = 0;
let step = 0;

const BPM = 108;
const STEP = 60 / BPM / 2; // sekizlik
// Nota frekansları
const N: Record<string, number> = {
  D3: 146.83, A3: 220, D4: 293.66, Eb4: 311.13, Fs4: 369.99, G4: 392, A4: 440, Bb4: 466.16, C5: 523.25, D5: 587.33,
};
// 4 ölçü × 8 sekizlik ("-" = bir önceki nota uzar)
const MELODY = [
  "D5", "C5", "Bb4", "A4", "G4", "A4", "Bb4", "A4",
  "G4", "Fs4", "Eb4", "Fs4", "G4", "A4", "G4", "Fs4",
  "D4", "Eb4", "Fs4", "G4", "A4", "Bb4", "A4", "G4",
  "Fs4", "G4", "A4", "Bb4", "A4", "-", "D4", "-",
];
// Maksum: dum tek - tek dum - tek -
const DRUM = ["dum", "tek", "", "tek", "dum", "", "tek", ""];

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

function pluck(a: AudioContext, out: AudioNode, freq: number, t: number, dur: number, vol = 0.22) {
  const o1 = a.createOscillator();
  const o2 = a.createOscillator();
  o1.type = "sawtooth";
  o2.type = "triangle";
  o1.frequency.value = freq;
  o2.frequency.value = freq * 2.003;
  const f = a.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.setValueAtTime(3200, t);
  f.frequency.exponentialRampToValueAtTime(700, t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o1.connect(f);
  o2.connect(f);
  f.connect(g).connect(out);
  o1.start(t);
  o2.start(t);
  o1.stop(t + dur + 0.05);
  o2.stop(t + dur + 0.05);
}

function drum(a: AudioContext, out: AudioNode, kind: string, t: number) {
  if (kind === "dum") {
    const o = a.createOscillator();
    const g = a.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.18);
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.3);
  } else if (kind === "tek") {
    const len = Math.floor(a.sampleRate * 0.05);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    const src = a.createBufferSource();
    src.buffer = buf;
    const f = a.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 3500;
    f.Q.value = 1.2;
    const g = a.createGain();
    g.gain.value = 0.35;
    src.connect(f).connect(g).connect(out);
    src.start(t);
  }
}

function schedule() {
  const a = ctx;
  if (!a || !master) return;
  while (nextTime < a.currentTime + 0.25) {
    const i = step % MELODY.length;
    const note = MELODY[i];
    if (note !== "-") {
      let len = 1;
      while (MELODY[(i + len) % MELODY.length] === "-") len++;
      pluck(a, master, N[note], nextTime, STEP * len * 0.95);
    }
    // Bas: her ölçü başında Re, ortasında La
    if (i % 8 === 0) pluck(a, master, N.D3, nextTime, STEP * 3.5, 0.16);
    if (i % 8 === 4) pluck(a, master, N.A3, nextTime, STEP * 3.5, 0.12);
    drum(a, master, DRUM[i % 8], nextTime);
    nextTime += STEP;
    step++;
  }
}

/** Müziği başlatır (yalnızca bir kullanıcı dokunuşundan sonra çalabilir). */
export function startMusic() {
  const a = audio();
  if (!a || timer) return;
  master = a.createGain();
  master.gain.setValueAtTime(0.0001, a.currentTime);
  master.gain.exponentialRampToValueAtTime(0.35, a.currentTime + 1.2);
  master.connect(a.destination);
  nextTime = a.currentTime + 0.05;
  step = 0;
  timer = setInterval(schedule, 60);
  schedule();
}

/** Müziği yavaşça kısarak durdurur. */
export function stopMusic(fadeSec = 0.8) {
  if (!timer || !ctx || !master) return;
  clearInterval(timer);
  timer = null;
  const g = master;
  g.gain.cancelScheduledValues(ctx.currentTime);
  g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + fadeSec);
  setTimeout(() => g.disconnect(), fadeSec * 1000 + 100);
  master = null;
}

export const isMusicPlaying = () => timer !== null;
