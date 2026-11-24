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
  /** Kelime koyma hakkı bittikten sonra aynı turda yapabileceği ek işleme sayısı. */
  extraExtends: number;
  /** Bir işlemede en fazla kaç harf ekler (1: tek harf, 2: iki harfe kadar). */
  extendMaxTiles: number;
  /**
   * Gerçek oyuncunun olduğu masada bilgisayar bu turdan önce eli bitirmez
   * (ıstakasında en az bir taş fazla tutar): oyun çabuk bitmesin, oyuncu da kelime kurabilsin.
   */
}

export const BOT_PROFILES: Record<BotLevel, BotProfile> = {
  // Bilgisayar elini hemen açmasın diye bekler: oyunlar çok çabuk bitmesin, oyuncu da kelime arayabilsin.
  // (Ölçüm: orta seviyede 4. turdan önce açmamak bir eli 4,7 turdan 7,5 tura uzatır.)
  // İşleme: bilgisayar yerdeki kelimelere harf eklemeyi yeni kelime koymaktan önce dener ve
  // kelime hakkı bitse de ek işleme yapabilir. Bitirme geciktirilmez: bilgisayar da gerçek oyuncu
  // gibi bitirebildiği an bitirir (bitirme turları eşit; simülasyon: tests/economy-sim.test.ts).
  kolay: { vocabulary: 1500, maxOpenWords: 2, playsPerTurn: 1, openStyle: "az", openFromRound: 5, extraExtends: 1, extendMaxTiles: 1 },
  orta: { vocabulary: 4000, maxOpenWords: 3, playsPerTurn: 1, openStyle: "az", openFromRound: 4, extraExtends: 1, extendMaxTiles: 2 },
  zor: { vocabulary: 10000, maxOpenWords: 3, playsPerTurn: 2, openStyle: "az", openFromRound: 3, extraExtends: 2, extendMaxTiles: 2 },
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
  // Yandan alınan taş aynı turda geri atılmaz (iki bilgisayarın aynı taşı
  // sonsuza dek birbirine atıp alması engellenir); başka seçenek yoksa atılır.
  const taken = takenThisTurn(state);
  const fresh = taken ? nonJokers.filter((t) => t.letter !== taken) : nonJokers;
  const options = fresh.length ? fresh : nonJokers.length ? nonJokers : p.rack;
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

/** Açmış oyuncu, yandan alınacak taşla bu tur kelime koyabilir ya da işleyebilir mi? */
function usableNow(dict: Dictionary, vocab: DictWord[], state: GameState, rack: Tile[], top: Tile): boolean {
  const l = top.letter;
  if (!l) return true;
  const words = candidateWords(vocab, [...rack, top]).filter((w) => w.len <= rack.length && w.word.includes(l));
  if (words.some((w) => specFor(w.word, [...rack, top]) !== null)) return true;
  if (rack.length < 1) return false;
  for (const tw of state.table) {
    if (tw.pair) continue;
    const base = wordString(tw.tiles);
    if ((dict.has(base + l) && knows(vocab, base + l)) || (dict.has(l + base) && knows(vocab, l + base))) return true;
  }
  return false;
}

/** Bu turda soldan (yandan) alınan taşın harfi; alınmadıysa null. */
function takenThisTurn(state: GameState): string | null {
  for (let i = state.log.length - 1; i >= 0; i--) {
    const e = state.log[i] as { k: string; p?: { letter?: string } };
    if (e.k === "discarded") return null;
    if (e.k === "tookDiscard") return e.p?.letter ?? null;
  }
  return null;
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
      // Açmış oyuncu yandan taşı ancak hemen kullanabilecekse alır (kelime koyma
      // ya da işleme); yoksa desteden çeker. Bu, el sonunda iki bilgisayarın
      // aynı taşları sonsuza dek birbirine atıp almasını önler.
      const usable = !p.opened || usableNow(dict, vocab, state, p.rack, top);
      if (gain >= 15 && usable) return drawFromDiscard(state);
    }
    return drawFromDeck(state);
  }

  // Istakada atılacak bir taş kalsın; bitirme geciktirilmez (oyuncu ve bilgisayar eşit şartlarda bitirir)
  const keep = 1;
  const tryExtend = () => {
    const ext = findExtension(dict, state, p.rack, profile.extendMaxTiles, keep);
    if (!ext) return null;
    try {
      return extendWord(dict, state, ext.wordId, ext.side, { tileIds: ext.tileIds, jokerLetters: [] });
    } catch {
      return null;
    }
  };

  if (state.turnPlays >= profile.playsPerTurn) {
    // Kelime hakkı bitti; işleme hevesi: birkaç ek işleme daha yapabilir
    if (p.opened && state.turnPlays < profile.playsPerTurn + profile.extraExtends) {
      const next = tryExtend();
      if (next) return next;
    }
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
  } else if (p.opened) {
    // Önce yerdeki kelimelere işle (oyunu hareketlendirir), sonra yeni kelime koy (en uzun önce)
    const next = tryExtend();
    if (next) return next;
    const cands = candidateWords(vocab, p.rack)
      .filter((w) => w.len <= p.rack.length - keep)
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
  }

  return discardTile(state, chooseDiscard(state, vocab).id);
}

/**
 * Yerdeki kelimelere eklenebilecek en iyi harf(ler)i bulur: tek harf ya da (maxTiles 2 ise)
 * iki harf, başa veya sona. Joker işlemede harcanmaz. Daha çok harf ve daha yüksek değer önce.
 * Sözlüğün tamamı kullanılır (bilgisayar, kelimenin çekimli hâllerini de tanır).
 */
function findExtension(dict: Dictionary, state: GameState, rack: Tile[], maxTiles: number, keep: number) {
  const letters = rack.filter((t) => t.letter !== null);
  let best: { wordId: number; side: "start" | "end"; tileIds: number[]; score: number } | null = null;
  const consider = (wordId: number, side: "start" | "end", tiles: Tile[], word: string) => {
    if (rack.length - tiles.length < keep || !dict.has(word)) return;
    const score = tiles.length * 100 + tiles.reduce((n, t) => n + letterValue(t.letter!), 0);
    if (!best || score > best.score) best = { wordId, side, tileIds: tiles.map((t) => t.id), score };
  };
  for (const tw of state.table) {
    if (tw.pair) continue; // çiftler işlenmez
    const base = wordString(tw.tiles);
    for (let i = 0; i < letters.length; i++) {
      const a = letters[i];
      consider(tw.id, "end", [a], base + a.letter);
      consider(tw.id, "start", [a], a.letter + base);
      if (maxTiles < 2) continue;
      for (let j = 0; j < letters.length; j++) {
        if (j === i) continue;
        const b = letters[j];
        consider(tw.id, "end", [a, b], base + a.letter + b.letter);
        consider(tw.id, "start", [a, b], a.letter! + b.letter + base);
      }
    }
  }
  return best as { wordId: number; side: "start" | "end"; tileIds: number[]; score: number } | null;
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
