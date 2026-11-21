import { Dictionary } from "./dictionary";
import { LangCode, alphabet, gameLang, letterValue } from "./lang";
import { Color, Letter, Tile, createTileSet, makeRng, shuffle, tilePenalty } from "./tiles";

// ---- Kurallar ----------------------------------------------------------
export const RULES = {
  handSize: 14,
  /** Eli yere açmak için gereken en düşük toplam harf değeri. */
  openThreshold: 86,
  /** Normal bitiren oyuncunun puan tablosuna yazılan değer. */
  winScore: -100,
  /** Tüm taşları tek renk bitiren oyuncunun puanı (Renk Bitirme). */
  colorWinScore: -200,
  /** El açamamış oyuncunun cezası. */
  unopenedPenalty: 200,
  /** Çifte giden oyuncunun açmak için gereken çift sayısı (değer şartı yok). */
  pairsToOpen: 5,
  /** Çiftle (karışık renk) bitiren oyuncunun puanı. */
  pairWinScore: -200,
  /** Çiftle, tüm taşları tek renk bitiren oyuncunun puanı. */
  pairColorWinScore: -400,
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
  /** Çift (AA, SS…): kelime değildir, işlenemez. */
  pair?: boolean;
}

export interface Player {
  name: string;
  isBot: boolean;
  rack: Tile[];
  opened: boolean;
  /** Bu elde oyuncunun yere koyduğu taşlar (Renk Bitirme kontrolü için). */
  laid: Tile[];
  /** Oyuncu bu elde çifte gitti (çiftle açtı): yalnızca çift koyabilir, işleyemez. */
  pairs?: boolean;
}

export type Phase = "draw" | "play" | "handOver" | "gameOver";

export interface HandResult {
  winner: number | null;
  colorWin: Color | null;
  /** Kazanan çiftle mi bitirdi. */
  pairWin?: boolean;
  scores: number[];
  reason: "finished" | "deckEmpty";
}

/** Çevrilebilir mesaj parametreleri. */
export type MsgParams = Record<string, string | number>;

/** Oyun kaydı girdisi: çeviri anahtarı + parametreler. */
export interface LogEntry {
  k: string;
  p?: MsgParams;
}

export interface GameState {
  /** Oyunun oynandığı dil (alfabe, taşlar, sözlük). */
  lang: LangCode;
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
  log: LogEntry[];
}

/** Bir kelime için oyuncunun ıstakasından seçtiği taşlar, sırasıyla. */
export interface WordSpec {
  tileIds: number[];
  /** Kelimedeki jokerlerin (soldan sağa) temsil edeceği harfler. */
  jokerLetters?: Letter[];
}

/** Kural ihlali; code bir çeviri anahtarıdır (err.*). */
export class GameError extends Error {
  constructor(
    readonly code: string,
    readonly params: MsgParams = {},
  ) {
    super(code);
  }
}

const tileLabel = (t: Tile) => t.letter ?? "★";

// ---- Yardımcılar -------------------------------------------------------
const clone = (s: GameState): GameState => structuredClone(s);

export function wordString(tiles: PlacedTile[]): string {
  return tiles.map((t) => t.letter).join("");
}

export function placedValue(tiles: PlacedTile[]): number {
  return tiles.reduce((s, t) => s + letterValue(t.letter), 0);
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
    for (const l of alphabet()) {
      cur[holes[h]] = l;
      rec(h + 1);
    }
  };
  rec(0);
  return results;
}

function takeTilesFromRack(rack: Tile[], ids: number[]): Tile[] {
  if (new Set(ids).size !== ids.length) throw new GameError("sameTileTwice");
  return ids.map((id) => {
    const t = rack.find((r) => r.id === id);
    if (!t) throw new GameError("tileNotInRack");
    return t;
  });
}

function placeTiles(tiles: Tile[], jokerLetters: Letter[] = []): PlacedTile[] {
  const jokers = tiles.filter((t) => t.letter === null).length;
  if (jokerLetters.length !== jokers) throw new GameError("chooseJoker");
  let j = 0;
  return tiles.map((t) => ({ tile: t, letter: t.letter ?? jokerLetters[j++] }));
}

function removeFromRack(p: Player, ids: Set<number>) {
  p.rack = p.rack.filter((t) => !ids.has(t.id));
}

function assertTurn(state: GameState, phase: Phase) {
  if (state.phase !== phase) {
    if (phase === "draw") throw new GameError("alreadyDrew");
    throw new GameError(state.phase === "draw" ? "drawFirst" : "notNow");
  }
}

// ---- Oyun kurulumu -----------------------------------------------------
/** Etkin oyun dilinde (setGameLang) yeni oyun başlatır. */
export function newGame(names: string[], bots: boolean[], totalHands: number, seed: number): GameState {
  const state: GameState = {
    lang: gameLang().code,
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
    p.pairs = false;
  });
  state.deck = tiles;
  state.discards = state.players.map(() => []);
  state.table = [];
  state.current = starter;
  state.phase = "play";
  state.turnPlays = 0;
  state.lastResult = null;
  state.log = [{ k: "handStart", p: { n: state.handNo, name: state.players[starter].name } }];
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
  state.log.push({ k: "drewDeck", p: { name: p.name } });
  return state;
}

export function drawFromDiscard(prev: GameState): GameState {
  assertTurn(prev, "draw");
  const state = clone(prev);
  const pile = state.discards[prevIndex(state, state.current)];
  const tile = pile.pop();
  if (!tile) throw new GameError("noTileToTake");
  const p = state.players[state.current];
  p.rack.push(tile);
  state.phase = "play";
  state.log.push({ k: "tookDiscard", p: { name: p.name, letter: tileLabel(tile) } });
  return state;
}

/** Bir kelime tanımını doğrular ve yerleştirilmiş taşları döndürür. */
export function buildWord(dict: Dictionary, rack: Tile[], spec: WordSpec): PlacedTile[] {
  if (spec.tileIds.length < 3) throw new GameError("minLength", { n: 3 });
  const placed = placeTiles(takeTilesFromRack(rack, spec.tileIds), spec.jokerLetters);
  const w = wordString(placed);
  if (!dict.has(w)) throw new GameError("notInDict", { word: w });
  return placed;
}

/** İlk açılış: kelimelerin toplam değeri en az RULES.openThreshold olmalı. */
export function openHand(dict: Dictionary, prev: GameState, specs: WordSpec[]): GameState {
  assertTurn(prev, "play");
  const state = clone(prev);
  const p = state.players[state.current];
  if (p.opened) throw new GameError("alreadyOpened");
  if (!specs.length) throw new GameError("chooseWords");
  const allIds = specs.flatMap((s) => s.tileIds);
  if (new Set(allIds).size !== allIds.length) throw new GameError("tileInTwoWords");
  const words = specs.map((s) => buildWord(dict, p.rack, s));
  const total = words.reduce((s, w) => s + placedValue(w), 0);
  if (total < RULES.openThreshold) {
    throw new GameError("openNeeds", { need: RULES.openThreshold, total });
  }
  if (p.rack.length - allIds.length < 1) throw new GameError("keepOne");
  removeFromRack(p, new Set(allIds));
  for (const w of words) {
    state.table.push({ id: state.nextWordId++, owner: state.current, tiles: w });
    p.laid.push(...w.map((x) => x.tile));
  }
  p.opened = true;
  state.turnPlays++;
  state.log.push({ k: "opened", p: { name: p.name, total, words: words.map(wordString).join(", ") } });
  return state;
}

/** Açılmış oyuncu yere yeni kelime koyar. */
export function layWord(dict: Dictionary, prev: GameState, spec: WordSpec): GameState {
  assertTurn(prev, "play");
  const state = clone(prev);
  const p = state.players[state.current];
  if (!p.opened) throw new GameError("mustOpenFirst", { need: RULES.openThreshold });
  if (p.pairs) throw new GameError("pairsOnly");
  const word = buildWord(dict, p.rack, spec);
  if (p.rack.length - word.length < 1) throw new GameError("keepOne");
  removeFromRack(p, new Set(spec.tileIds));
  state.table.push({ id: state.nextWordId++, owner: state.current, tiles: word });
  p.laid.push(...word.map((x) => x.tile));
  state.turnPlays++;
  state.log.push({ k: "laid", p: { name: p.name, word: wordString(word) } });
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
  if (!p.opened) throw new GameError("mustOpenFirst", { need: RULES.openThreshold });
  if (p.pairs) throw new GameError("pairsNoExtend");
  const target = state.table.find((w) => w.id === wordId);
  if (!target) throw new GameError("wordNotFound");
  if (target.pair) throw new GameError("cantExtendPair");
  if (!spec.tileIds.length) throw new GameError("chooseTileToAdd");
  const added = placeTiles(takeTilesFromRack(p.rack, spec.tileIds), spec.jokerLetters);
  const tiles = side === "start" ? [...added, ...target.tiles] : [...target.tiles, ...added];
  const w = wordString(tiles);
  if (!dict.has(w)) throw new GameError("notInDict", { word: w });
  if (p.rack.length - added.length < 1) throw new GameError("keepOne");
  removeFromRack(p, new Set(spec.tileIds));
  const before = wordString(target.tiles);
  target.tiles = tiles;
  p.laid.push(...added.map((x) => x.tile));
  state.turnPlays++;
  state.log.push({ k: "extended", p: { name: p.name, from: before, to: w } });
  return state;
}

// ---- Çifte gitme --------------------------------------------------------
/** İki taş aynı harf mi (joker her harfin eşi olur)? Yerleştirilmiş çifti döndürür. */
export function buildPair(rack: Tile[], spec: WordSpec): PlacedTile[] {
  if (spec.tileIds.length !== 2) throw new GameError("pairTwo");
  const [a, b] = takeTilesFromRack(rack, spec.tileIds);
  if (a.letter === null && b.letter === null) throw new GameError("notAPair");
  const letter = (a.letter ?? b.letter)!;
  if (a.letter !== null && b.letter !== null && a.letter !== b.letter) throw new GameError("notAPair");
  return [a, b].map((t) => ({ tile: t, letter }));
}

/** Çifte gitme: en az RULES.pairsToOpen çiftle açılır (değer şartı yok). */
export function openPairs(prev: GameState, specs: WordSpec[]): GameState {
  assertTurn(prev, "play");
  const state = clone(prev);
  const p = state.players[state.current];
  if (p.opened) throw new GameError("alreadyOpened");
  if (specs.length < RULES.pairsToOpen) throw new GameError("pairsNeed", { need: RULES.pairsToOpen, n: specs.length });
  const allIds = specs.flatMap((s) => s.tileIds);
  if (new Set(allIds).size !== allIds.length) throw new GameError("tileInTwoWords");
  const pairs = specs.map((s) => buildPair(p.rack, s));
  if (p.rack.length - allIds.length < 1) throw new GameError("keepOne");
  removeFromRack(p, new Set(allIds));
  for (const w of pairs) {
    state.table.push({ id: state.nextWordId++, owner: state.current, tiles: w, pair: true });
    p.laid.push(...w.map((x) => x.tile));
  }
  p.opened = true;
  p.pairs = true;
  state.turnPlays++;
  state.log.push({ k: "openedPairs", p: { name: p.name, n: pairs.length, words: pairs.map(wordString).join(" ") } });
  return state;
}

/** Çifte giden oyuncu yere yeni bir çift koyar. */
export function layPair(prev: GameState, spec: WordSpec): GameState {
  assertTurn(prev, "play");
  const state = clone(prev);
  const p = state.players[state.current];
  if (!p.opened || !p.pairs) throw new GameError("notPairPlayer");
  const pair = buildPair(p.rack, spec);
  if (p.rack.length - 2 < 1) throw new GameError("keepOne");
  removeFromRack(p, new Set(spec.tileIds));
  state.table.push({ id: state.nextWordId++, owner: state.current, tiles: pair, pair: true });
  p.laid.push(...pair.map((x) => x.tile));
  state.turnPlays++;
  state.log.push({ k: "laid", p: { name: p.name, word: wordString(pair) } });
  return state;
}

/** Taş atar; son taşı atan eli bitirir. */
export function discardTile(prev: GameState, tileId: number): GameState {
  assertTurn(prev, "play");
  const state = clone(prev);
  const p = state.players[state.current];
  const tile = p.rack.find((t) => t.id === tileId);
  if (!tile) throw new GameError("chooseDiscard");
  p.rack = p.rack.filter((t) => t.id !== tileId);
  state.discards[state.current].push(tile);
  state.log.push({ k: "discarded", p: { name: p.name, letter: tileLabel(tile) } });
  if (p.rack.length === 0) return endHand(state, state.current);
  if (state.deck.length === 0) return endHand(state, null);
  state.current = nextIndex(state, state.current);
  state.phase = "draw";
  state.turnPlays = 0;
  return state;
}

/**
 * Hamle süresi dolduğunda otomatik hamle: taş çekilmediyse desteden çeker,
 * sonra bir taş atar. Atılacak taş: en son çekilen taş (joker değilse);
 * yoksa korunmayan (keep) ilk joker olmayan taş; o da yoksa herhangi bir taş.
 */
export function timeoutMove(prev: GameState, keep: Iterable<number> = []): GameState {
  if (prev.phase !== "draw" && prev.phase !== "play") return prev;
  const name = prev.players[prev.current].name;
  let state = clone(prev);
  state.log.push({ k: "timeout", p: { name } });
  if (state.phase === "draw") {
    state = drawFromDeck(state);
    if (state.phase !== "play") return state; // deste bitti, el sona erdi
  }
  const kept = new Set(keep);
  const rack = state.players[state.current].rack;
  const free = rack.filter((t) => !kept.has(t.id));
  const last = rack[rack.length - 1];
  const pick =
    (last && last.letter !== null && !kept.has(last.id) ? last : undefined) ??
    free.find((t) => t.letter !== null) ??
    rack.find((t) => t.letter !== null) ??
    rack[0];
  return discardTile(state, pick.id);
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
  const pairWin = winner !== null && !!state.players[winner].pairs;
  const scores = state.players.map((p, i) => {
    if (i === winner) {
      if (pairWin) return colorWin ? RULES.pairColorWinScore : RULES.pairWinScore;
      return colorWin ? RULES.colorWinScore : RULES.winScore;
    }
    return penaltyFor(p);
  });
  state.history.push(scores);
  state.lastResult = { winner, colorWin, pairWin, scores, reason: winner === null ? "deckEmpty" : "finished" };
  state.phase = state.handNo >= state.totalHands ? "gameOver" : "handOver";
  if (winner === null) state.log.push({ k: "deckEmpty" });
  else state.log.push({ k: pairWin ? (colorWin ? "pairColorFinished" : "pairFinished") : colorWin ? "colorFinished" : "finished", p: { name: state.players[winner].name } });
  return state;
}

export function totals(state: GameState): number[] {
  return state.players.map((_, i) => state.history.reduce((s, h) => s + h[i], 0));
}
