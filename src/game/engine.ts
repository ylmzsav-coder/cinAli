import { Dictionary } from "./dictionary";
import {
  ALPHABET,
  Color,
  LETTER_VALUE,
  Letter,
  Tile,
  createTileSet,
  makeRng,
  shuffle,
  tilePenalty,
} from "./tiles";

// ---- Kurallar ----------------------------------------------------------
export const RULES = {
  handSize: 14,
  /** Eli yere açmak için gereken en düşük toplam harf değeri. */
  openThreshold: 76,
  /** Normal bitiren oyuncunun puan tablosuna yazılan değer. */
  winScore: -100,
  /** Tüm taşları tek renk bitiren oyuncunun puanı (Renk Bitirme). */
  colorWinScore: -200,
  /** El açamamış oyuncunun cezası. */
  unopenedPenalty: 200,
};

// ---- Tipler ------------------------------------------------------------
export interface PlacedTile {
  tile: Tile;
  /** Taşın kelimede temsil ettiği harf (joker için seçilen harf). */
  letter: Letter;
}

export interface TableWord {
  id: number;
  owner: number;
  tiles: PlacedTile[];
}

export interface Player {
  name: string;
  isBot: boolean;
  rack: Tile[];
  opened: boolean;
  /** Bu elde oyuncunun yere koyduğu taşlar (Renk Bitirme kontrolü için). */
  laid: Tile[];
}

export type Phase = "draw" | "play" | "handOver" | "gameOver";

export interface HandResult {
  winner: number | null;
  colorWin: Color | null;
  scores: number[];
  reason: "finished" | "deckEmpty";
}

export interface GameState {
  seed: number;
  players: Player[];
  deck: Tile[];
  /** discards[i]: i. oyuncunun attığı taşlar (son eleman en üstte). */
  discards: Tile[][];
  table: TableWord[];
  nextWordId: number;
  current: number;
  phase: Phase;
  /** Bu turda yapılan açma/koyma/işleme sayısı. */
  turnPlays: number;
  handNo: number;
  totalHands: number;
  dealer: number;
  /** Her elin puanları: history[el][oyuncu]. */
  history: number[][];
  lastResult: HandResult | null;
  log: string[];
}

/** Bir kelime için oyuncunun ıstakasından seçtiği taşlar, sırasıyla. */
export interface WordSpec {
  tileIds: number[];
  /** Kelimedeki jokerlerin (soldan sağa) temsil edeceği harfler. */
  jokerLetters?: Letter[];
}

export class GameError extends Error {}

// ---- Yardımcılar -------------------------------------------------------
const clone = (s: GameState): GameState => structuredClone(s);

export function wordString(tiles: PlacedTile[]): string {
  return tiles.map((t) => t.letter).join("");
}

export function placedValue(tiles: PlacedTile[]): number {
  return tiles.reduce((s, t) => s + LETTER_VALUE[t.letter], 0);
}

export function nextIndex(state: GameState, i: number): number {
  return (i + 1) % state.players.length;
}

export function prevIndex(state: GameState, i: number): number {
  return (i - 1 + state.players.length) % state.players.length;
}

/** Sıradaki oyuncunun alabileceği, soldaki oyuncunun attığı en üst taş. */
export function takeableDiscard(state: GameState): Tile | null {
  const pile = state.discards[prevIndex(state, state.current)];
  return pile.length ? pile[pile.length - 1] : null;
}

/**
 * Jokerli bir harf dizisi için geçerli kelimeleri bulur.
 * pattern'deki null değerler joker yerine geçer.
 */
export function jokerOptions(dict: Dictionary, pattern: (Letter | null)[]): Letter[][] {
  const holes: number[] = [];
  pattern.forEach((p, i) => p === null && holes.push(i));
  const results: Letter[][] = [];
  const cur = pattern.slice() as Letter[];
  const rec = (h: number) => {
    if (h === holes.length) {
      if (dict.has(cur.join(""))) results.push(holes.map((i) => cur[i]));
      return;
    }
    for (const l of ALPHABET) {
      cur[holes[h]] = l;
      rec(h + 1);
    }
  };
  rec(0);
  return results;
}

function takeTilesFromRack(rack: Tile[], ids: number[]): Tile[] {
  if (new Set(ids).size !== ids.length) throw new GameError("Aynı taş iki kez seçilemez.");
  return ids.map((id) => {
    const t = rack.find((r) => r.id === id);
    if (!t) throw new GameError("Seçilen taş ıstakada yok.");
    return t;
  });
}

function placeTiles(tiles: Tile[], jokerLetters: Letter[] = []): PlacedTile[] {
  const jokers = tiles.filter((t) => t.letter === null).length;
  if (jokerLetters.length !== jokers) throw new GameError("Jokerin hangi harf olacağını seçin.");
  let j = 0;
  return tiles.map((t) => ({ tile: t, letter: t.letter ?? jokerLetters[j++] }));
}

function removeFromRack(p: Player, ids: Set<number>) {
  p.rack = p.rack.filter((t) => !ids.has(t.id));
}

function assertTurn(state: GameState, phase: Phase) {
  if (state.phase !== phase) {
    if (phase === "draw") throw new GameError("Bu tur zaten taş çektiniz.");
    throw new GameError(state.phase === "draw" ? "Önce taş çekin." : "Şu an bu hamle yapılamaz.");
  }
}

// ---- Oyun kurulumu -----------------------------------------------------
export function newGame(names: string[], bots: boolean[], totalHands: number, seed: number): GameState {
  const state: GameState = {
    seed,
    players: names.map((name, i) => ({ name, isBot: bots[i], rack: [], opened: false, laid: [] })),
    deck: [],
    discards: names.map(() => []),
    table: [],
    nextWordId: 1,
    current: 0,
    phase: "play",
    turnPlays: 0,
    handNo: 0,
    totalHands,
    dealer: names.length - 1,
    history: [],
    lastResult: null,
    log: [],
  };
  return dealHand(state);
}

/** Yeni bir el dağıtır. Dağıtanın sağındaki oyuncu 15 taşla başlar. */
export function dealHand(prev: GameState): GameState {
  const state = clone(prev);
  state.handNo += 1;
  state.dealer = nextIndex(state, state.dealer);
  const rng = makeRng(state.seed * 1000 + state.handNo);
  const tiles = shuffle(createTileSet(), rng);
  const starter = nextIndex(state, state.dealer);
  state.players.forEach((p, i) => {
    const n = RULES.handSize + (i === starter ? 1 : 0);
    p.rack = tiles.splice(0, n);
    p.opened = false;
    p.laid = [];
  });
  state.deck = tiles;
  state.discards = state.players.map(() => []);
  state.table = [];
  state.current = starter;
  state.phase = "play";
  state.turnPlays = 0;
  state.lastResult = null;
  state.log = [`${state.handNo}. el başladı. ${state.players[starter].name} 15 taşla başlıyor.`];
  return state;
}

// ---- Hamleler ----------------------------------------------------------
export function drawFromDeck(prev: GameState): GameState {
  assertTurn(prev, "draw");
  const state = clone(prev);
  const tile = state.deck.pop();
  if (!tile) return endHand(state, null);
  const p = state.players[state.current];
  p.rack.push(tile);
  state.phase = "play";
  state.log.push(`${p.name} desteden taş çekti.`);
  return state;
}

export function drawFromDiscard(prev: GameState): GameState {
  assertTurn(prev, "draw");
  const state = clone(prev);
  const pile = state.discards[prevIndex(state, state.current)];
  const tile = pile.pop();
  if (!tile) throw new GameError("Alınacak taş yok.");
  const p = state.players[state.current];
  p.rack.push(tile);
  state.phase = "play";
  state.log.push(`${p.name} yandan ${tile.letter ?? "joker"} aldı.`);
  return state;
}

/** Bir kelime tanımını doğrular ve yerleştirilmiş taşları döndürür. */
export function buildWord(dict: Dictionary, rack: Tile[], spec: WordSpec): PlacedTile[] {
  if (spec.tileIds.length < 3) throw new GameError("Kelime en az 3 harfli olmalı.");
  const placed = placeTiles(takeTilesFromRack(rack, spec.tileIds), spec.jokerLetters);
  const w = wordString(placed);
  if (!dict.has(w)) throw new GameError(`"${w}" sözlükte yok.`);
  return placed;
}

/** İlk açılış: kelimelerin toplam değeri en az 76 olmalı. */
export function openHand(dict: Dictionary, prev: GameState, specs: WordSpec[]): GameState {
  assertTurn(prev, "play");
  const state = clone(prev);
  const p = state.players[state.current];
  if (p.opened) throw new GameError("Eliniz zaten açık.");
  if (!specs.length) throw new GameError("Açmak için kelime seçin.");
  const allIds = specs.flatMap((s) => s.tileIds);
  if (new Set(allIds).size !== allIds.length) throw new GameError("Bir taş iki kelimede kullanılamaz.");
  const words = specs.map((s) => buildWord(dict, p.rack, s));
  const total = words.reduce((s, w) => s + placedValue(w), 0);
  if (total < RULES.openThreshold) {
    throw new GameError(`Açmak için en az ${RULES.openThreshold} gerekli, seçtikleriniz ${total}.`);
  }
  if (p.rack.length - allIds.length < 1) throw new GameError("Atmak için elinizde bir taş kalmalı.");
  removeFromRack(p, new Set(allIds));
  for (const w of words) {
    state.table.push({ id: state.nextWordId++, owner: state.current, tiles: w });
    p.laid.push(...w.map((x) => x.tile));
  }
  p.opened = true;
  state.turnPlays++;
  state.log.push(`${p.name} elini ${total} ile açtı: ${words.map(wordString).join(", ")}.`);
  return state;
}

/** Açılmış oyuncu yere yeni kelime koyar. */
export function layWord(dict: Dictionary, prev: GameState, spec: WordSpec): GameState {
  assertTurn(prev, "play");
  const state = clone(prev);
  const p = state.players[state.current];
  if (!p.opened) throw new GameError(`Önce ${RULES.openThreshold} ile elinizi açmalısınız.`);
  const word = buildWord(dict, p.rack, spec);
  if (p.rack.length - word.length < 1) throw new GameError("Atmak için elinizde bir taş kalmalı.");
  removeFromRack(p, new Set(spec.tileIds));
  state.table.push({ id: state.nextWordId++, owner: state.current, tiles: word });
  p.laid.push(...word.map((x) => x.tile));
  state.turnPlays++;
  state.log.push(`${p.name} yere ${wordString(word)} koydu.`);
  return state;
}

/** Yerdeki bir kelimenin başına veya sonuna harf ekler (işleme). */
export function extendWord(
  dict: Dictionary,
  prev: GameState,
  wordId: number,
  side: "start" | "end",
  spec: WordSpec,
): GameState {
  assertTurn(prev, "play");
  const state = clone(prev);
  const p = state.players[state.current];
  if (!p.opened) throw new GameError(`Önce ${RULES.openThreshold} ile elinizi açmalısınız.`);
  const target = state.table.find((w) => w.id === wordId);
  if (!target) throw new GameError("Kelime bulunamadı.");
  if (!spec.tileIds.length) throw new GameError("Eklenecek taşı seçin.");
  const added = placeTiles(takeTilesFromRack(p.rack, spec.tileIds), spec.jokerLetters);
  const tiles = side === "start" ? [...added, ...target.tiles] : [...target.tiles, ...added];
  const w = wordString(tiles);
  if (!dict.has(w)) throw new GameError(`"${w}" sözlükte yok.`);
  if (p.rack.length - added.length < 1) throw new GameError("Atmak için elinizde bir taş kalmalı.");
  removeFromRack(p, new Set(spec.tileIds));
  const before = wordString(target.tiles);
  target.tiles = tiles;
  p.laid.push(...added.map((x) => x.tile));
  state.turnPlays++;
  state.log.push(`${p.name} ${before} kelimesini ${w} yaptı.`);
  return state;
}

/** Taş atar; son taşı atan eli bitirir. */
export function discardTile(prev: GameState, tileId: number): GameState {
  assertTurn(prev, "play");
  const state = clone(prev);
  const p = state.players[state.current];
  const tile = p.rack.find((t) => t.id === tileId);
  if (!tile) throw new GameError("Atılacak taşı seçin.");
  p.rack = p.rack.filter((t) => t.id !== tileId);
  state.discards[state.current].push(tile);
  state.log.push(`${p.name} ${tile.letter ?? "joker"} attı.`);
  if (p.rack.length === 0) return endHand(state, state.current);
  if (state.deck.length === 0) return endHand(state, null);
  state.current = nextIndex(state, state.current);
  state.phase = "draw";
  state.turnPlays = 0;
  return state;
}

// ---- Puanlama ----------------------------------------------------------
/** Kazananın yere koyduğu taşların hepsi aynı renkteyse o rengi döndürür. Joker her renge uyar. */
export function colorWinOf(p: Player): Color | null {
  const colored = p.laid.filter((t) => t.letter !== null);
  if (!colored.length) return null;
  const c = colored[0].color;
  return colored.every((t) => t.color === c) ? c : null;
}

export function penaltyFor(p: Player): number {
  if (!p.opened) return RULES.unopenedPenalty;
  return p.rack.reduce((s, t) => s + tilePenalty(t), 0);
}

function endHand(state: GameState, winner: number | null): GameState {
  const colorWin = winner !== null ? colorWinOf(state.players[winner]) : null;
  const scores = state.players.map((p, i) => {
    if (i === winner) return colorWin ? RULES.colorWinScore : RULES.winScore;
    return penaltyFor(p);
  });
  state.history.push(scores);
  state.lastResult = { winner, colorWin, scores, reason: winner === null ? "deckEmpty" : "finished" };
  state.phase = state.handNo >= state.totalHands ? "gameOver" : "handOver";
  if (winner === null) state.log.push("Deste bitti, el kazanansız sona erdi.");
  else
    state.log.push(
      `${state.players[winner].name} eli bitirdi${colorWin ? " — RENK BİTİRME!" : "."}`,
    );
  return state;
}

export function totals(state: GameState): number[] {
  return state.players.map((_, i) => state.history.reduce((s, h) => s + h[i], 0));
}
