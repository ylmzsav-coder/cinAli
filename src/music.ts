/**
 * Word Okey giriş müziği: kod içinde üretilen özgün bir piyano parçası
 * (telif sorunu yok, ses dosyası gerekmez).
 * Piyano sesi: her nota için hafif kaymalı üst sesler (gerçek tel gibi),
 * çekiç vuruşu, notaya göre sönümlenme ve oda yankısı. Sol el akorları
 * arpej hâlinde, sağ el neşeli bir melodi çalar; 8 ölçülük döngü, 100 vuruş/dakika.
 */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let bus: GainNode | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let nextTime = 0;
let step = 0;

const BPM = 100;
const STEP = 60 / BPM / 2; // sekizlik
/** Ana ses seviyesi (yüksek); sınırlayıcı patlamayı önler. */
const VOLUME = 0.9;

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
// Nota adı → MIDI
const NOTE: Record<string, number> = {
  C3: 48, D3: 50, E3: 52, F3: 53, G3: 55, A3: 57, B3: 59,
  C4: 60, D4: 62, E4: 64, F4: 65, G4: 67, A4: 69, B4: 71,
  C5: 72, D5: 74, E5: 76, F5: 77, G5: 79, A5: 81, B5: 83,
  C6: 84, D6: 86, E6: 88,
};

// Sağ el: 8 ölçü × 8 sekizlik ("-" = önceki nota uzar, "." = sus)
const MELODY = [
  "E5", "-", "G5", "-", "C6", "-", "B5", "A5",
  "G5", "-", "-", "D5", "G5", "-", "F5", "E5",
  "E5", "-", "A5", "-", "C6", "-", "B5", "A5",
  "A5", "-", "-", "G5", "F5", "E5", "D5", "C5",
  "E5", "G5", "C6", "-", "E6", "-", "D6", "C6",
  "B5", "-", "D6", "-", "G5", "-", "A5", "B5",
  "C6", "-", "A5", "-", "F5", "-", "A5", "C6",
  "D6", "-", "-", "-", "B5", "-", "G5", ".",
];
// Akorlar (ölçü başına): kök, üçlü, beşli (sol el arpeji)
const CHORDS: [string, string, string][] = [
  ["C3", "E3", "G3"], ["G3", "B3", "D4"], ["A3", "C4", "E4"], ["F3", "A3", "C4"],
  ["C3", "E3", "G3"], ["G3", "B3", "D4"], ["F3", "A3", "C4"], ["G3", "B3", "D4"],
];
// Arpej deseni: akorun hangi sesi (0 kök, 1 üçlü, 2 beşli, 3 kökün oktavı)
const ARP = [0, 2, 3, 1, 2, 3, 1, 2];

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
function reverbImpulse(a: AudioContext, seconds = 1.8): AudioBuffer {
  const len = Math.floor(a.sampleRate * seconds);
  const buf = a.createBuffer(2, len, a.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
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
  // Pes notalar daha uzun çınlar
  const decay = 1.2 + Math.max(0, (84 - midi) / 24) * 2.2;
  const end = t + Math.max(hold, 0.12) + 0.35; // tuş bırakılınca çabuk söner
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vel, t + 0.006);
  g.gain.setTargetAtTime(vel * 0.45, t + 0.006, 0.08); // ilk parlak vuruş
  g.gain.setTargetAtTime(0.0001, t + 0.1, decay / 3);
  g.gain.setTargetAtTime(0.0001, t + Math.max(hold, 0.12), 0.09);
  // Parlaklık zamanla azalır
  const lp = a.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(Math.min(9000, f0 * 9), t);
  lp.frequency.exponentialRampToValueAtTime(Math.max(600, f0 * 2.5), t + decay);
  g.connect(lp).connect(out);
  // Üst sesler: tel sertliği yüzünden hafifçe yukarı kayar
  const partials = [1, 0.55, 0.32, 0.22, 0.12, 0.08, 0.05];
  partials.forEach((amp, k) => {
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
  // Çekiç vuruşu
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

function schedule() {
  const a = ctx;
  if (!a || !bus) return;
  while (nextTime < a.currentTime + 0.3) {
    const i = step % MELODY.length;
    const bar = Math.floor(i / 8);
    const beat = i % 8;
    // Sağ el
    const note = MELODY[i];
    if (note !== "-" && note !== ".") {
      let len = 1;
      while (MELODY[(i + len) % MELODY.length] === "-") len++;
      const accent = beat === 0 || beat === 4 ? 1 : 0.85;
      piano(a, bus, NOTE[note], nextTime, STEP * len * 0.95, 0.32 * accent);
    }
    // Sol el: arpej, ölçü başında kök oktavla kalın bas
    const [r, third, fifth] = CHORDS[bar].map((n) => NOTE[n]);
    const pick = [r, third, fifth, r + 12][ARP[beat]];
    piano(a, bus, pick, nextTime, STEP * 1.6, beat === 0 ? 0.2 : 0.14);
    if (beat === 0) piano(a, bus, r - 12, nextTime, STEP * 7, 0.22);
    nextTime += STEP;
    step++;
  }
}

/** Müziği başlatır (yalnızca bir kullanıcı dokunuşundan sonra çalabilir). */
export function startMusic() {
  const a = audio();
  if (!a || timer) return;
  // Sınırlayıcı: yüksek seste patlama olmasın
  const comp = a.createDynamicsCompressor();
  comp.threshold.value = -8;
  comp.knee.value = 6;
  comp.ratio.value = 10;
  comp.attack.value = 0.003;
  comp.release.value = 0.25;
  master = a.createGain();
  master.gain.setValueAtTime(0.0001, a.currentTime);
  master.gain.exponentialRampToValueAtTime(VOLUME, a.currentTime + 1);
  master.connect(comp).connect(a.destination);
  // Kuru ses + yankı
  bus = a.createGain();
  bus.gain.value = 1;
  const verb = a.createConvolver();
  verb.buffer = reverbImpulse(a);
  const wet = a.createGain();
  wet.gain.value = 0.28;
  bus.connect(master);
  bus.connect(verb).connect(wet).connect(master);
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
  bus = null;
}

export const isMusicPlaying = () => timer !== null;
