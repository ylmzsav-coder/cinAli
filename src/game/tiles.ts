/** Türk alfabesi; her harfin değeri alfabedeki sırasıdır (A=1 … Z=29). */
export const ALPHABET = [
  "A", "B", "C", "Ç", "D", "E", "F", "G", "Ğ", "H", "I", "İ", "J", "K", "L",
  "M", "N", "O", "Ö", "P", "R", "S", "Ş", "T", "U", "Ü", "V", "Y", "Z",
] as const;

export type Letter = (typeof ALPHABET)[number];

export const LETTER_VALUE: Record<string, number> = Object.fromEntries(
  ALPHABET.map((l, i) => [l, i + 1]),
);

export const LETTER_INDEX: Record<string, number> = Object.fromEntries(
  ALPHABET.map((l, i) => [l, i]),
);

export const COLORS = ["kirmizi", "mavi", "sari", "siyah"] as const;
export type Color = (typeof COLORS)[number];

export const COLOR_NAMES: Record<Color, string> = {
  kirmizi: "Kırmızı",
  mavi: "Mavi",
  sari: "Sarı",
  siyah: "Siyah",
};

export interface Tile {
  id: number;
  /** null ise joker. */
  letter: Letter | null;
  color: Color;
}

/**
 * Her harften kaç taş olduğu (tüm renkler toplamı). Toplam 104 taş;
 * sık kullanılan harflerden daha fazla vardır. Renkler sırayla dağıtılır,
 * böylece her renkte tam 26 taş olur.
 */
export const LETTER_COUNTS: Record<Letter, number> = {
  A: 9, B: 3, C: 2, Ç: 2, D: 4, E: 9, F: 1, G: 2, Ğ: 1, H: 2, I: 4, İ: 6,
  J: 1, K: 6, L: 6, M: 4, N: 6, O: 3, Ö: 1, P: 2, R: 6, S: 4, Ş: 2, T: 4,
  U: 4, Ü: 2, V: 2, Y: 4, Z: 2,
};

export const JOKER_COUNT = 2;
/** Oyun sonunda elde kalan jokerin ceza değeri. */
export const JOKER_PENALTY = 30;

export function createTileSet(): Tile[] {
  const tiles: Tile[] = [];
  let id = 0;
  let colorCursor = 0;
  for (const letter of ALPHABET) {
    for (let i = 0; i < LETTER_COUNTS[letter]; i++) {
      tiles.push({ id: id++, letter, color: COLORS[colorCursor % 4] });
      colorCursor++;
    }
  }
  for (let i = 0; i < JOKER_COUNT; i++) {
    tiles.push({ id: id++, letter: null, color: COLORS[i % 4] });
  }
  return tiles;
}

export function tilePenalty(t: Tile): number {
  return t.letter === null ? JOKER_PENALTY : LETTER_VALUE[t.letter];
}

export function wordValue(word: string): number {
  let sum = 0;
  for (const ch of word) sum += LETTER_VALUE[ch] ?? 0;
  return sum;
}

/** Deterministik test için tohumlanabilir rastgele sayı üreteci (mulberry32). */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
