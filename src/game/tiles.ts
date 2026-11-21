import { gameLang, letterValue } from "./lang";

export { alphabet, letterIndex, letterValue } from "./lang";

/** Bir harf (etkin dilin alfabesinden). */
export type Letter = string;

export const COLORS = ["kirmizi", "mavi", "sari", "siyah"] as const;
export type Color = (typeof COLORS)[number];

export interface Tile {
  id: number;
  /** null ise joker. */
  letter: Letter | null;
  color: Color;
}

export const JOKER_COUNT = 2;
/** Oyun sonunda elde kalan jokerin ceza değeri. */
export const JOKER_PENALTY = 30;

export const letterTileTotal = () => Object.values(gameLang().counts).reduce((a, b) => a + b, 0);

/** Etkin dilin taş setini üretir. Renkler sırayla dağıtılır, böylece dengeli olur. */
export function createTileSet(): Tile[] {
  const { alphabet, counts } = gameLang();
  const tiles: Tile[] = [];
  let id = 0;
  let colorCursor = 0;
  for (const letter of alphabet) {
    for (let i = 0; i < counts[letter]; i++) {
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
  return t.letter === null ? JOKER_PENALTY : letterValue(t.letter);
}

export function wordValue(word: string): number {
  let sum = 0;
  for (const ch of word) sum += Math.max(0, letterValue(ch));
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
