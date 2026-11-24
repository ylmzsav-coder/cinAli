/**
 * Oyuncu istatistikleri (cihazda saklanır). El ve oyun sonuçları App'teki
 * durum güncellemesinden bir kez işlenir; aynı el iki kez sayılmaz.
 */
import type { GameState } from "./game/engine";
import { gameWinners, placedValue, totals, wordString } from "./game/engine";
import { wordValue } from "./game/tiles";

export interface PlayerStats {
  /** Biten oyun (sonuna kadar oynanan). */
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  /** Birinciliği başka oyuncuyla paylaşılan oyun. */
  gamesDrawn: number;
  /** Bitmeden bırakılan oyun (teslim olma). */
  quits: number;
  /** En yüksek oyun puanı (oyun sonu toplamı). */
  bestGame: number;
  /** Hamle sayısı, hamle puanları toplamı ve en yüksek puanlı hamle. */
  moves: number;
  movePoints: number;
  bestMove: number;
  handsPlayed: number;
  handsWon: number;
  colorWins: number;
  pairWins: number;
  /** Bütün ellerin puan toplamı. */
  totalPoints: number;
  /** Tek eldeki en yüksek puan. */
  bestHand: number;
  /** Yere açılan kelime sayısı. */
  wordsLaid: number;
  /** En değerli kelime. */
  bestWord: { word: string; value: number } | null;
  /** En uzun kelime. */
  longestWord: string | null;
  /** Çipli masada kazanılan çip. */
  chipsWon: number;
  /** İlk kayıt tarihi (ms). */
  since: number;
}

const KEY = "wordokey.stats";
const DONE_KEY = "wordokey.stats.done";

export const emptyStats = (): PlayerStats => ({
  gamesPlayed: 0,
  gamesWon: 0,
  gamesLost: 0,
  gamesDrawn: 0,
  quits: 0,
  bestGame: 0,
  moves: 0,
  movePoints: 0,
  bestMove: 0,
  handsPlayed: 0,
  handsWon: 0,
  colorWins: 0,
  pairWins: 0,
  totalPoints: 0,
  bestHand: 0,
  wordsLaid: 0,
  bestWord: null,
  longestWord: null,
  chipsWon: 0,
  since: Date.now(),
});

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* depolama yoksa yok say */
  }
}

export function loadStats(): PlayerStats {
  const s = { ...emptyStats(), ...(read<Partial<PlayerStats>>(KEY) ?? {}) };
  // Eski "teslim olma" kayıtları artık yenilgi sayılır (bir kez taşınır)
  // En uzun kelime, en yüksek puanlı kelimeden daha değerliyse o da rekor puanlı kelimedir
  // (aynı kelime iki rekorda birden görünür)
  if (s.longestWord) {
    try {
      const v = wordValue(s.longestWord);
      if (v > 0 && (!s.bestWord || v > s.bestWord.value)) s.bestWord = { word: s.longestWord, value: v };
    } catch {
      /* başka dilin harfleri: atla */
    }
  }
  // Eski beraberlikler artık galibiyet sayılır (bir kez taşınır)
  if (s.quits > 0 || s.gamesDrawn > 0) {
    s.gamesPlayed += s.quits;
    s.gamesLost += s.quits;
    s.quits = 0;
    s.gamesWon += s.gamesDrawn;
    s.gamesDrawn = 0;
    write(KEY, s);
  }
  return s;
}

/** İşlenmiş el ve oyunlar: "seed:el" ve "seed:oyun". */
function loadDone(): string[] {
  return read<string[]>(DONE_KEY) ?? [];
}

/**
 * Yeni biten elleri ve oyunu istatistiğe işler (yalnızca oyuncu 0 = siz).
 * Bir eli bitirmeden önce yerdeki sizin kelimeleriniz sayılır.
 */
export function recordProgress(state: GameState, payout?: number) {
  const results = state.results ?? [];
  const done = new Set(loadDone());
  const s = loadStats();
  let changed = false;
  results.forEach((r, i) => {
    const key = `${state.seed}:${i}`;
    if (done.has(key)) return;
    done.add(key);
    changed = true;
    const score = state.history[i]?.[0] ?? 0;
    s.handsPlayed++;
    s.totalPoints += score;
    s.bestHand = Math.max(s.bestHand, score);
    const me = state.players[0];
    s.moves += me.plays ?? 0;
    s.movePoints += me.points ?? 0;
    s.bestMove = Math.max(s.bestMove, me.bestPlay ?? 0);
    if (r.winner === 0) {
      s.handsWon++;
      if (r.colorWin) s.colorWins++;
      if (r.pairWin) s.pairWins++;
    }
    // Son elin kelimeleri hâlâ yerde: sizin açtıklarınız
    if (i === results.length - 1) {
      for (const w of state.table.filter((x) => x.owner === 0 && !x.pair)) {
        s.wordsLaid++;
        const word = wordString(w.tiles);
        const value = placedValue(w.tiles);
        if (!s.bestWord || value > s.bestWord.value) s.bestWord = { word, value };
        if (!s.longestWord || [...word].length > [...s.longestWord].length) s.longestWord = word;
      }
    }
  });
  const gameKey = `${state.seed}:oyun`;
  // Kimse bitiremedi (deste bitti): kazanan ya da kaybeden sayılmaz
  if (state.phase === "gameOver" && state.lastResult?.reason === "deckEmpty") {
    if (!done.has(gameKey)) { done.add(gameKey); changed = true; }
  } else if (state.phase === "gameOver" && !done.has(gameKey)) {
    done.add(gameKey);
    changed = true;
    s.gamesPlayed++;
    const winners = gameWinners(state);
    if (!winners.includes(0)) s.gamesLost++;
    else s.gamesWon++; // berabere biten oyun da kazanılmış sayılır
    s.bestGame = Math.max(s.bestGame, totals(state)[0]);
    if (payout && payout > 0) s.chipsWon += payout;
  }
  if (!changed) return;
  write(KEY, s);
  write(DONE_KEY, [...done].slice(-400));
}

/** Oyun bitmeden bırakıldı: oyundan çıkan oyuncu yenilmiş sayılır. Aynı oyun bir kez sayılır. */
export function recordQuit(state: GameState) {
  const done = new Set(loadDone());
  const key = `${state.seed}:oyun`;
  if (done.has(key) || state.phase === "gameOver") return;
  done.add(key);
  const s = loadStats();
  s.gamesPlayed++;
  s.gamesLost++;
  write(KEY, s);
  write(DONE_KEY, [...done].slice(-400));
}

/** Ortalama hamle puanı (iki ondalık). */
export const avgMove = (s: PlayerStats) => (s.moves ? s.movePoints / s.moves : 0);

/** Kazanma oranı (yüzde, tam sayı). */
export const winRate = (won: number, played: number) => (played ? Math.round((won / played) * 100) : 0);

/** Çevrimiçi modda sunucudaki oyun sayıları (Sosyete şartı sunucuda bunlarla denetlenir). */
let serverCounts: { played: number; won: number } | null = null;
export function setServerCounts(played: number, won: number) {
  serverCounts = { played, won };
}

/**
 * Oyuncunun başarı oranı (yüzde), kazanılan ve oynanan oyun sayısı. Çevrimiçi modda
 * sunucudaki sayılar, değilse bu cihazdaki istatistik kullanılır.
 */
export function myRate(): { rate: number; won: number; played: number } {
  if (serverCounts) return { rate: winRate(serverCounts.won, serverCounts.played), won: serverCounts.won, played: serverCounts.played };
  const s = loadStats();
  return { rate: winRate(s.gamesWon, s.gamesPlayed), won: s.gamesWon, played: s.gamesPlayed };
}
