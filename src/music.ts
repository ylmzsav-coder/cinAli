/**
 * Word Okey giriş müziği: "Ah! vous dirai-je, maman" ezgisinin (1761, kamu malı;
 * "Daha Dün Annemizin" okul şarkısının ezgisi) kod içinde çalınan piyano versiyonu.
 * Piyano sesi: hafif kaymalı üst sesler, çekiç vuruşu ve oda yankısı; melodi
 * oktav katlamalı, kalın ve dolgun bir tınıyla çalınır. Sol el "pam-pa" eşlik eder.
 * Toplam 19 saniye: 8 ölçü bir kez çalar (18 sn), kapanış akoruyla biter;
 * son 5 saniyede ses kademeli olarak azalır.
 */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let bus: GainNode | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let nextTime = 0;
let step = 0;
let ended = false;

/** Müziğin toplam süresi (saniye). */
export const MUSIC_SECONDS = 19;
/** Son kaç saniyede ses kademeli azalır. */
const FADE_SECONDS = 5;
/** Ezgi 18 saniyede biter; son 1 saniye kapanış akoru. */
const STEP_COUNT = 96;
const STEP = (MUSIC_SECONDS - 1) / STEP_COUNT;
/** Ana ses seviyesi (yüksek); sınırlayıcı patlamayı önler. */
const VOLUME = 0.9;

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
const NOTE: Record<string, number> = {
  C2: 36, D2: 38, E2: 40, F2: 41, G2: 43, A2: 45, B2: 47,
  C3: 48, D3: 50, E3: 52, F3: 53, G3: 55, A3: 57, B3: 59,
  C4: 60, D4: 62, E4: 64, F4: 65, G4: 67, A4: 69, B4: 71,
  C5: 72, D5: 74, E5: 76, F5: 77, G5: 79, A5: 81, B5: 83,
  C6: 84, D6: 86, E6: 88, F6: 89,
};

// Ezgi: "Ah! vous dirai-je, maman" (Fransız halk ezgisi, 1761; Mozart'ın varyasyonlarıyla
// tanınır; Türkiye'de "Daha Dün Annemizin" okul şarkısının ezgisi). Kamu malıdır; sözler kullanılmaz.
// Dörtlük notalar ("-" = önceki nota uzar); her satır 8 dörtlük.
const LINES = [
  ["C5", "C5", "G5", "G5", "A5", "A5", "G5", "-"],
  ["F5", "F5", "E5", "E5", "D5", "D5", "C5", "-"],
  ["G5", "G5", "F5", "F5", "E5", "E5", "D5", "-"],
  ["G5", "G5", "F5", "F5", "E5", "E5", "D5", "-"],
  ["C5", "C5", "G5", "G5", "A5", "A5", "G5", "-"],
  ["F5", "F5", "E5", "E5", "D5", "D5", "C5", "-"],
];
/** Sekizlik adımlar: her dörtlük iki adım. */
const MELODY: string[] = LINES.flat().flatMap((n) => [n, "-"]);
const C: [string, string, string] = ["C3", "E3", "G3"];
const F: [string, string, string] = ["F2", "A2", "C3"];
const G: [string, string, string] = ["G2", "B2", "D3"];
// Sol el akorları: her iki dörtlükte bir (4 adım)
const CHORDS: [string, string, string][] = [
  C, C, F, C, F, C, G, C,
  C, F, C, G, C, F, C, G,
  C, C, F, C, F, C, G, C,
];

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

/** Kısa oda yankısı için yapay dürtü yanıtı. */
function reverbImpulse(a: AudioContext, seconds = 1.6): AudioBuffer {
  const len = Math.floor(a.sampleRate * seconds);
  const buf = a.createBuffer(2, len, a.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.8);
  }
  return buf;
}

let noiseBuf: AudioBuffer | null = null;
function noise(a: AudioContext): AudioBuffer {
  if (noiseBuf && noiseBuf.sampleRate === a.sampleRate) return noiseBuf;
  const len = Math.floor(a.sampleRate * 0.05);
  noiseBuf = a.createBuffer(1, len, a.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  return noiseBuf;
}

/** Tek bir piyano notası. */
function piano(a: AudioContext, out: AudioNode, midi: number, t: number, hold: number, vel: number) {
  const f0 = hz(midi);
  const decay = 1.2 + Math.max(0, (84 - midi) / 24) * 2.2;
  const end = t + Math.max(hold, 0.1) + 0.3;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vel, t + 0.005);
  g.gain.setTargetAtTime(vel * 0.45, t + 0.005, 0.07);
  g.gain.setTargetAtTime(0.0001, t + 0.09, decay / 3);
  g.gain.setTargetAtTime(0.0001, t + Math.max(hold, 0.1), 0.07);
  const lp = a.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(Math.min(9000, f0 * 9), t);
  lp.frequency.exponentialRampToValueAtTime(Math.max(600, f0 * 2.5), t + decay);
  g.connect(lp).connect(out);
  [1, 0.55, 0.32, 0.22, 0.12, 0.08, 0.05].forEach((amp, k) => {
    const n = k + 1;
    const o = a.createOscillator();
    o.type = "sine";
    o.frequency.value = f0 * n * Math.sqrt(1 + 0.0004 * n * n);
    const pg = a.createGain();
    pg.gain.value = amp / (1 + k * 0.15);
    o.connect(pg).connect(g);
    o.start(t);
    o.stop(end + 0.1);
  });
  const src = a.createBufferSource();
  src.buffer = noise(a);
  const bp = a.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = Math.min(6000, f0 * 4);
  bp.Q.value = 0.8;
  const hg = a.createGain();
  hg.gain.value = vel * 0.25;
  src.connect(bp).connect(hg).connect(out);
  src.start(t);
}

/** Kapanış: Do majör akor ve zil; müzik 19. saniyede susar. */
function finale(a: AudioContext, out: GainNode, t: number) {
  ["C2", "C3", "G3", "C4", "E4", "G4"].forEach((n, k) => piano(a, out, NOTE[n], t + k * 0.012, 0.9, 0.22));
  const m = master;
  const ms = Math.max(0, (t + 1.05 - a.currentTime) * 1000);
  setTimeout(() => {
    if (master === m) {
      if (timer) clearInterval(timer);
      timer = null;
      m?.disconnect();
      master = null;
      bus = null;
    }
  }, ms);
}

function schedule() {
  const a = ctx;
  if (!a || !bus) return;
  while (!ended && nextTime < a.currentTime + 0.3) {
    if (step >= MELODY.length) {
      ended = true;
      finale(a, bus, nextTime);
      break;
    }
    const i = step;
    // Sağ el: ezgi, kalın ve dolgun (bir oktav aşağıda, oktav katlamalı)
    const note = MELODY[i];
    if (note !== "-" && note !== ".") {
      let len = 1;
      while (MELODY[i + len] === "-") len++;
      const accent = i % 8 === 0 ? 1 : 0.85;
      const m = NOTE[note] - 12;
      piano(a, bus, m, nextTime, STEP * len * 0.92, 0.32 * accent);
      piano(a, bus, m - 12, nextTime, STEP * len * 0.92, 0.14 * accent);
    }
    // Sol el: "pam-pa" (vuruşta bas, ara vuruşta akor)
    const [r, third, fifth] = CHORDS[Math.floor(i / 4)].map((n) => NOTE[n]);
    if (i % 4 === 0) piano(a, bus, r - 12, nextTime, STEP * 1.6, 0.22);
    if (i % 4 === 2) [r, third, fifth].forEach((m) => piano(a, bus!, m, nextTime, STEP * 0.8, 0.11));
    nextTime += STEP;
    step++;
  }
}

/** Müziği başlatır (yalnızca bir kullanıcı dokunuşundan sonra çalabilir). */
export function startMusic() {
  const a = audio();
  if (!a || timer) return;
  const comp = a.createDynamicsCompressor();
  comp.threshold.value = -8;
  comp.knee.value = 6;
  comp.ratio.value = 10;
  comp.attack.value = 0.003;
  comp.release.value = 0.25;
  const t0 = a.currentTime;
  master = a.createGain();
  master.gain.setValueAtTime(0.0001, t0);
  master.gain.exponentialRampToValueAtTime(VOLUME, t0 + 0.6);
  // Son 5 saniyede kademeli azalma
  master.gain.setValueAtTime(VOLUME, t0 + 0.05 + MUSIC_SECONDS - FADE_SECONDS);
  master.gain.linearRampToValueAtTime(0.0001, t0 + 0.05 + MUSIC_SECONDS);
  master.connect(comp).connect(a.destination);
  bus = a.createGain();
  const verb = a.createConvolver();
  verb.buffer = reverbImpulse(a);
  const wet = a.createGain();
  wet.gain.value = 0.25;
  bus.connect(master);
  bus.connect(verb).connect(wet).connect(master);
  nextTime = t0 + 0.05;
  step = 0;
  ended = false;
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
  bus = null;
}

export const isMusicPlaying = () => timer !== null;
