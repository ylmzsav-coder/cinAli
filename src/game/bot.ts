import { DictWord, Dictionary } from "./dictionary";
import {
  GameState,
  RULES,
  WordSpec,
  discardTile,
  drawFromDeck,
  drawFromDiscard,
  extendWord,
  layWord,
  openHand,
  takeableDiscard,
  wordString,
} from "./engine";
import { Letter, Tile, alphabet, letterIndex, letterValue, tilePenalty } from "./tiles";

export type BotLevel = "kolay" | "orta" | "zor";

export interface BotProfile {
  /** Botun bildiği yaygın kelime sayısı. */
  vocabulary: number;
  /** Açılışta en fazla kaç kelime kullanır. */
  maxOpenWords: number;
  /** Bir turda en fazla kaç açma/koyma/işleme yapar. */
  playsPerTurn: number;
  /** "az": açılış eşiğine en az taşla ulaşır; "cok": açılışta olabildiğince çok taş indirir. */
  openStyle: "az" | "cok";
  /** Bilgisayarın kendine koyduğu açma eşiği (kuraldaki eşikten yüksek olabilir; oyuncular için kural değişmez). */
  openThreshold?: number;
  /** Bilgisayar en erken kaçıncı turda elini açar (1 = ilk tur). */
  openFromRound?: number;
}

export const BOT_PROFILES: Record<BotLevel, BotProfile> = {
  // Bilgisayar elini hemen açmasın diye bekler: oyunlar çok çabuk bitmesin, oyuncu da kelime arayabilsin.
  // (Ölçüm: orta seviyede 4. turdan önce açmamak bir eli 4,7 turdan 7,5 tura uzatır.)
  kolay: { vocabulary: 1500, maxOpenWords: 2, playsPerTurn: 1, openStyle: "az", openFromRound: 5 },
  orta: { vocabulary: 4000, maxOpenWords: 3, playsPerTurn: 1, openStyle: "az", openFromRound: 4 },
  zor: { vocabulary: 10000, maxOpenWords: 3, playsPerTurn: 2, openStyle: "az", openFromRound: 3 },
};

const vocabCache = new WeakMap<Dictionary, Map<BotLevel, DictWord[]>>();

export function vocabularyFor(dict: Dictionary, level: BotLevel): DictWord[] {
  let m = vocabCache.get(dict);
  if (!m) vocabCache.set(dict, (m = new Map()));
  let v = m.get(level);
  if (!v) m.set(level, (v = dict.entries.slice(0, BOT_PROFILES[level].vocabulary)));
  return v;
}

interface Pool {
  counts: Uint8Array;
  jokers: number;
  size: number;
}

function poolOf(tiles: Tile[]): Pool {
  const counts = new Uint8Array(alphabet().length);
  let jokers = 0;
  for (const t of tiles) {
    if (t.letter === null) jokers++;
    else counts[letterIndex(t.letter)]++;
  }
  return { counts, jokers, size: tiles.length };
}

/** Kelimeyi havuzdan kurmak için gereken joker sayısı; kurulamıyorsa -1. */
function jokersNeeded(w: DictWord, counts: Uint8Array, jokers: number): number {
  let need = 0;
  for (let i = 0; i < counts.length; i++) {
    const d = w.counts[i] - counts[i];
    if (d > 0) {
      need += d;
      if (need > jokers) return -1;
    }
  }
  return need;
}

/** Istakadaki taşlarla kurulabilecek tüm sözlük kelimeleri. */
export function candidateWords(vocab: DictWord[], tiles: Tile[]): DictWord[] {
  const pool = poolOf(tiles);
  const out: DictWord[] = [];
  for (const w of vocab) {
    if (w.len > pool.size) continue;
    if (jokersNeeded(w, pool.counts, pool.jokers) >= 0) out.push(w);
  }
  return out;
}

/** Bir kelimeyi ıstakadaki somut taşlarla eşleştirir (gerekirse joker kullanır). */
export function specFor(word: string, tiles: Tile[]): WordSpec | null {
  const used = new Set<number>();
  const ids: number[] = [];
  const jokerLetters: Letter[] = [];
  const pending: number[] = [];
  const letters: Letter[] = [...word];
  letters.forEach((l, i) => {
    const t = tiles.find((x) => x.letter === l && !used.has(x.id));
    if (t) {
      used.add(t.id);
      ids[i] = t.id;
    } else pending.push(i);
  });
  for (const i of pending) {
    const j = tiles.find((x) => x.letter === null && !used.has(x.id));
    if (!j) return null;
    used.add(j.id);
    ids[i] = j.id;
  }
  // jokerLetters soldan sağa jokerlerin sırasına göre olmalı
  ids.forEach((id, i) => {
    if (tiles.find((t) => t.id === id)?.letter === null) jokerLetters.push(letters[i]);
  });
  return { tileIds: ids, jokerLetters };
}

/** El açmak için açılış eşiğine ulaşan, birbirinden bağımsız kelimeler arar. */
export function planOpening(
  vocab: DictWord[],
  rack: Tile[],
  maxWords = 4,
  style: "az" | "cok" = "cok",
  threshold = RULES.openThreshold,
): string[] | null {
  const list = candidateWords(vocab, rack)
    .slice()
    .sort((a, b) => b.value - a.value)
    .slice(0, 300);
  const pool = poolOf(rack);
  let best: { words: string[]; used: number; value: number } | null = null;
  let budget = 6000;
  const chosen: DictWord[] = [];

  const rec = (start: number, counts: Uint8Array, jokers: number, used: number, value: number) => {
    if (--budget < 0) return;
    if (value >= threshold) {
      const better = !best || (style === "cok" ? used > best.used : used < best.used);
      if (better) best = { words: chosen.map((c) => c.word), used, value };
      if (style === "az") return; // daha fazla kelime eklemeye gerek yok
    }
    if (chosen.length >= maxWords) return;
    for (let i = start; i < list.length; i++) {
      const w = list[i];
      if (used + w.len > pool.size - 1) continue;
      const need = jokersNeeded(w, counts, jokers);
      if (need < 0) continue;
      const next = counts.slice();
      for (let k = 0; k < next.length; k++) next[k] = Math.max(0, next[k] - w.counts[k]);
      chosen.push(w);
      rec(i + 1, next, jokers - need, used + w.len, value + w.value);
      chosen.pop();
      if (budget < 0) return;
    }
  };
  rec(0, pool.counts, pool.jokers, 0, 0);
  return best ? (best as { words: string[] }).words : null;
}

/** Elin ne kadar "iyi" olduğuna dair kaba bir tahmin: açgözlü bağımsız kelime değerleri. */
function handStrength(rack: Tile[], cands: DictWord[]): number {
  const pool = poolOf(rack);
  const usable = cands
    .filter((w) => w.len <= pool.size && jokersNeeded(w, pool.counts, pool.jokers) >= 0)
    .sort((a, b) => b.value + b.len * 4 - (a.value + a.len * 4));
  let counts = pool.counts;
  let jokers = pool.jokers;
  let score = 0;
  for (const w of usable) {
    const need = jokersNeeded(w, counts, jokers);
    if (need < 0) continue;
    counts = counts.map((c, k) => Math.max(0, c - w.counts[k]));
    jokers -= need;
    score += w.value + w.len * 4;
  }
  return score;
}

function chooseDiscard(state: GameState, vocab: DictWord[]): Tile {
  const p = state.players[state.current];
  const cands = candidateWords(vocab, p.rack);
  const nonJokers = p.rack.filter((t) => t.letter !== null);
  const options = nonJokers.length ? nonJokers : p.rack;
  let best = options[0];
  let bestScore = -Infinity;
  for (const t of options) {
    const rest = p.rack.filter((x) => x.id !== t.id);
    let s = handStrength(rest, cands);
    if (p.opened) s += tilePenalty(t) * 0.5;
    if (s > bestScore) {
      bestScore = s;
      best = t;
    }
  }
  return best;
}

/** Bu elde kaçıncı tur (0'dan): atılan taş sayısı / oyuncu sayısı. */
function roundOf(state: GameState): number {
  const thrown = state.discards.reduce((n, d) => n + d.length, 0);
  return Math.floor(thrown / state.players.length);
}

/** Bilgisayar oyuncusunun tek bir hamlesini yapar (çek, aç/koy/işle veya at). */
export function botStep(dict: Dictionary, state: GameState, level: BotLevel = "orta"): GameState {
  const vocab = vocabularyFor(dict, level);
  const profile = BOT_PROFILES[level];
  const p = state.players[state.current];

  if (state.phase === "draw") {
    const top = takeableDiscard(state);
    if (top) {
      if (top.letter === null) return drawFromDiscard(state);
      const cands = candidateWords(vocab, [...p.rack, top]);
      const gain = handStrength([...p.rack, top], cands) - handStrength(p.rack, cands);
      if (gain >= 15) return drawFromDiscard(state);
    }
    return drawFromDeck(state);
  }

  if (state.turnPlays >= profile.playsPerTurn) {
    // Bu turluk hamle hakkı bitti
  } else if (!p.opened && roundOf(state) + 1 >= (profile.openFromRound ?? 1)) {
    const plan = planOpening(vocab, p.rack, profile.maxOpenWords, profile.openStyle, Math.max(RULES.openThreshold, profile.openThreshold ?? 0));
    if (plan) {
      const specs: WordSpec[] = [];
      let remaining = p.rack;
      for (const w of plan) {
        const spec = specFor(w, remaining);
        if (!spec) break;
        specs.push(spec);
        remaining = remaining.filter((t) => !spec.tileIds.includes(t.id));
      }
      if (specs.length === plan.length) {
        try {
          return openHand(dict, state, specs);
        } catch {
          /* plan geçersizse atmaya geç */
        }
      }
    }
  } else {
    // Yeni kelime koy (en uzun önce)
    const cands = candidateWords(vocab, p.rack)
      .filter((w) => w.len <= p.rack.length - 1)
      .sort((a, b) => b.len - a.len || b.value - a.value);
    for (const w of cands.slice(0, 20)) {
      const spec = specFor(w.word, p.rack);
      if (!spec) continue;
      try {
        return layWord(dict, state, spec);
      } catch {
        /* sıradakini dene */
      }
    }
    // Yerdeki kelimelere tek harf işle
    if (p.rack.length > 1) {
      for (const tw of state.table) {
        if (tw.pair) continue; // çiftler işlenmez
        const base = wordString(tw.tiles);
        for (const t of p.rack) {
          const letters = t.letter ? [t.letter] : alphabet().slice().sort((a, b) => letterValue(b) - letterValue(a));
          for (const l of letters) {
            for (const side of ["end", "start"] as const) {
              const w = side === "end" ? base + l : l + base;
              if (!dict.has(w) || !knows(vocab, w)) continue;
              return extendWord(dict, state, tw.id, side, {
                tileIds: [t.id],
                jokerLetters: t.letter ? [] : [l],
              });
            }
          }
        }
      }
    }
  }

  return discardTile(state, chooseDiscard(state, vocab).id);
}

const knownSets = new WeakMap<DictWord[], Set<string>>();
function knows(vocab: DictWord[], w: string): boolean {
  let set = knownSets.get(vocab);
  if (!set) knownSets.set(vocab, (set = new Set(vocab.map((v) => v.word))));
  return set.has(w);
}

/**
 * Otomatik per: ıstakadaki taşlarla kurulabilecek, birbiriyle çakışmayan ve
 * toplam değeri en yüksek kelime setini bulur (tüm sözlük). Eşit değerde daha
 * çok taş kullanan tercih edilir. Kelimeler ve joker harfleri döner.
 */
export function bestArrangement(
  dict: Dictionary,
  rack: Tile[],
  maxWords = 5,
): { word: string; spec: WordSpec }[] {
  const list = candidateWords(dict.entries, rack)
    .slice()
    .sort((a, b) => b.value - a.value || b.len - a.len)
    .slice(0, 400);
  const pool = poolOf(rack);
  let best: { words: DictWord[]; value: number; used: number } = { words: [], value: 0, used: 0 };
  let budget = 30000;
  const chosen: DictWord[] = [];
  const rec = (start: number, counts: Uint8Array, jokers: number, used: number, value: number) => {
    if (--budget < 0) return;
    if (value > best.value || (value === best.value && used > best.used)) best = { words: chosen.slice(), value, used };
    if (chosen.length >= maxWords) return;
    for (let i = start; i < list.length; i++) {
      const w = list[i];
      if (used + w.len > pool.size) continue;
      const need = jokersNeeded(w, counts, jokers);
      if (need < 0) continue;
      const next = counts.slice();
      for (let k = 0; k < next.length; k++) next[k] = Math.max(0, next[k] - w.counts[k]);
      chosen.push(w);
      rec(i + 1, next, jokers - need, used + w.len, value + w.value);
      chosen.pop();
      if (budget < 0) return;
    }
  };
  rec(0, pool.counts, pool.jokers, 0, 0);
  // Kelimeleri somut taşlara eşle
  const out: { word: string; spec: WordSpec }[] = [];
  let remaining = rack;
  for (const w of best.words) {
    const spec = specFor(w.word, remaining);
    if (!spec) break;
    out.push({ word: w.word, spec });
    remaining = remaining.filter((t) => !spec.tileIds.includes(t.id));
  }
  return out;
}
