/**
 * Çevrimiçi masa görünümü: sunucunun tam oyun durumundan herkese açık kısım
 * (ıstakalar ve deste gizli) ve istemcide oyuncunun kendi koltuğunu 0'a
 * döndüren görünüm. Hem sunucu (functions/) hem istemci kullanır.
 */
import type { GameState, Player, WordSpec } from "../game/engine";
import type { Tile } from "../game/tiles";

/** Oyuncunun sunucuya gönderdiği hamle. */
export type Action =
  | { type: "drawDeck" }
  | { type: "drawDiscard" }
  | { type: "open"; specs: WordSpec[] }
  | { type: "lay"; spec: WordSpec }
  | { type: "openPairs"; specs: WordSpec[] }
  | { type: "layPair"; spec: WordSpec }
  | { type: "extend"; wordId: number; side: "start" | "end"; spec: WordSpec }
  | { type: "discard"; tileId: number };

export interface SeatInfo {
  uid: string | null;
  name: string;
  bot: boolean;
  /** VIP odaya davetle gelen misafir (abonelik ve giriş ücreti yok). */
  guest?: boolean;
  /** VIP üyeliğin bittiği an: rozet bu ana kadar gösterilir. */
  vipUntil?: number;
  /** Oyuncunun kendi eliyle tamamladığı hamle (sıra) sayısı. */
  manual?: number;
  /** Süre dolunca otomatik oynanan hamle (sıra) sayısı. */
  auto?: number;
}

export interface PublicView extends Omit<GameState, "players" | "deck"> {
  players: (Omit<Player, "rack"> & { rackCount: number })[];
  deckCount: number;
}

export function publicView(state: GameState, _seats: SeatInfo[]): PublicView {
  const { players, deck, ...rest } = state;
  return {
    ...rest,
    players: players.map(({ rack, ...p }) => ({ ...p, rackCount: rack.length })),
    deckCount: deck.length,
    // Oyun kaydının son kısmı yeterli
    log: state.log.slice(-30),
  };
}

const hidden = (n: number, seed: number): Tile[] =>
  Array.from({ length: n }, (_, i) => ({ id: -(seed * 100 + i + 1), letter: "?", color: "siyah" }));

/**
 * İstemci görünümü: kendi koltuğumuz 0. sırada olacak şekilde döndürülmüş,
 * oyun arayüzünün (Game) beklediği GameState biçiminde. Rakip ıstakaları
 * yalnızca sayı olarak bilinir (yer tutucu taşlar).
 */
export function rotatedState(view: PublicView, mySeat: number, myRack: Tile[]): GameState {
  const n = view.players.length;
  const r = (i: number) => (i - mySeat + n) % n;
  const rot = <T,>(arr: T[]) => arr.map((_, i) => arr[(i + mySeat) % n]);
  const { players, deckCount, ...rest } = view;
  return {
    ...rest,
    players: rot(players).map(({ rackCount, ...p }, i) => ({
      ...p,
      rack: i === 0 ? myRack : hidden(rackCount, i),
    })),
    deck: hidden(deckCount, 9),
    discards: rot(view.discards),
    table: view.table.map((w) => ({ ...w, owner: r(w.owner) })),
    current: r(view.current),
    dealer: r(view.dealer),
    history: view.history.map((h) => rot(h)),
    lastResult: view.lastResult
      ? {
          ...view.lastResult,
          winner: view.lastResult.winner === null ? null : r(view.lastResult.winner),
          scores: rot(view.lastResult.scores),
        }
      : null,
  };
}
