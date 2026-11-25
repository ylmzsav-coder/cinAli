/**
 * Kazanma sesi: bir avuç altın/çipin metal bir bardağa dökülmesi. Tamamen kodla sentezlenir
 * (ses dosyası ve telif yok). Her çip; uyumsuz (metalik) kısmi tonlardan oluşan kısa bir çınlama,
 * küçük bir çarpma gürültüsü ve bazılarında bardağın gövdesinden gelen daha pes bir yankıdır.
 * Ses önceden (çevrimdışı) işlenir, sonra tek parça çalınır: takılma/cızırtı olmaz.
 */
let ctx: AudioContext | null = null;

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

/** Tekrarlanabilir rastgele sayı (her kazanışta aynı güzel dökülüş). */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Tek bir çipin metale çarpması. */
function clink(a: BaseAudioContext, out: AudioNode, noise: AudioBuffer, t: number, f: number, vol: number, cup: boolean) {
  // Metalik kısmi tonlar (oranlar tam katlar değil: zil/para sesi)
  const parts: [number, number, number][] = [[1, 1, 0.22], [1.59, 0.55, 0.16], [2.43, 0.38, 0.11], [3.31, 0.22, 0.07], [4.17, 0.12, 0.05]];
  for (const [r, amp, dec] of parts) {
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(f * r, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol * amp, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dec * 1.6);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dec * 1.6 + 0.02);
  }
  // Çarpma anı: çok kısa, tiz bir gürültü
  const n = a.createBufferSource();
  n.buffer = noise;
  const hp = a.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 5000;
  const ng = a.createGain();
  ng.gain.setValueAtTime(vol * 0.5, t);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.012);
  n.connect(hp).connect(ng).connect(out);
  n.start(t, Math.random() * 0.5, 0.02);
  // Metal bardağın gövdesi: daha pes ve uzun bir "dınnn"
  if (cup) {
    for (const [fr, amp, dec] of [[1180, 0.22, 0.45], [1870, 0.12, 0.35], [2950, 0.07, 0.25]] as const) {
      const o = a.createOscillator();
      const g = a.createGain();
      o.frequency.setValueAtTime(fr * (0.98 + Math.random() * 0.04), t);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol * amp, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + dec + 0.02);
    }
  }
}

const LENGTH = 3.2;
let rendered: Promise<AudioBuffer | null> | null = null;

/** Dökülüşü bir kez işler: yoğunlaşan bir sağanak, ardından yerine oturan son çipler. */
export function renderChipRain(sampleRate: number): Promise<AudioBuffer | null> {
  const OAC = window.OfflineAudioContext ?? (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  if (!OAC) return Promise.resolve(null);
  const a = new OAC(2, Math.ceil(LENGTH * sampleRate), sampleRate);
  const noise = a.createBuffer(1, Math.ceil(sampleRate), sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const master = a.createGain();
  master.gain.value = 0.9;
  // Hafif bir yankı: metal bardağın içi
  const delay = a.createDelay(0.2);
  delay.delayTime.value = 0.045;
  const fb = a.createGain();
  fb.gain.value = 0.28;
  const pan = [a.createStereoPanner(), a.createStereoPanner(), a.createStereoPanner()];
  pan[0].pan.value = -0.35;
  pan[1].pan.value = 0;
  pan[2].pan.value = 0.35;
  pan.forEach((p) => p.connect(master));
  master.connect(a.destination);
  master.connect(delay);
  delay.connect(fb).connect(delay);
  delay.connect(a.destination);
  const r = rng(20261125);
  // Sağanak: 70 çip ~1,7 saniyede (ortada en yoğun)
  const N = 70;
  for (let i = 0; i < N; i++) {
    const x = (i + r()) / N;
    const t = 0.05 + 1.7 * (x < 0.5 ? 2 * x * x : 1 - 2 * (1 - x) * (1 - x)) * 0.9 + r() * 0.05;
    const f = 2600 + r() * 2600;
    const vol = 0.05 + r() * 0.06;
    clink(a, pan[Math.floor(r() * 3)], noise, t, f, vol, r() < 0.4);
  }
  // Yerine oturan son çipler (seyrekleşerek)
  let t = 1.85;
  for (let i = 0; i < 9; i++) {
    t += 0.07 + i * 0.03 + r() * 0.05;
    clink(a, pan[1], noise, t, 2400 + r() * 2000, 0.06 * (1 - i / 11), i % 2 === 0);
  }
  return a.startRendering().catch(() => null);
}

/** Kazanan oyuncuya: çiplerin metal bardağa dökülme sesi. */
export function playChipRain(delay = 0) {
  const a = audio();
  if (!a) return;
  rendered ??= renderChipRain(a.sampleRate);
  void rendered.then((buf) => {
    if (!buf) return;
    const src = a.createBufferSource();
    src.buffer = buf;
    const g = a.createGain();
    g.gain.value = 1.4;
    src.connect(g).connect(a.destination);
    src.start(a.currentTime + delay);
  });
}

/** Sesin süresi (animasyonla eşlemek için, saniye). */
export const CHIP_RAIN_SECONDS = 2.0;
