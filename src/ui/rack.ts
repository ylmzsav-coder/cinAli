/**
 * Okey ıstakası: 2 sıra × 16 yuva. Taşlar yuvalara istenildiği gibi yerleşir;
 * aynı sırada yan yana duran taşlar bir grup (kelime adayı) oluşturur, boş
 * yuvalar grupları ayırır. Saf fonksiyonlar (test edilebilir).
 */
export const RACK_COLS = 16;
export const RACK_ROWS = 2;
export const RACK_SLOTS = RACK_COLS * RACK_ROWS;

/** Yuva dizisi: her yuvada taş kimliği ya da null. */
export type Slots = (number | null)[];

export const emptySlots = (): Slots => Array(RACK_SLOTS).fill(null);

/** Yeni elin taşlarını yerleştirir: üst sıradan başlayarak soldan sağa. */
export function initialSlots(ids: number[]): Slots {
  const s = emptySlots();
  ids.slice(0, RACK_SLOTS).forEach((id, i) => (s[i] = id));
  return s;
}

/**
 * Istakayı oyun durumuyla eşitler: artık elde olmayan taşları kaldırır, yeni
 * gelen taşları yerleştirir. Yeni taş tercihen `preferred` yuvaya (sürükleyip
 * bırakılan), yoksa alt sıranın en sağındaki boş yuvaya (okeydeki gibi) konur.
 */
export function syncSlots(slots: Slots, rackIds: number[], preferred: number | null = null): Slots {
  const have = new Set(rackIds);
  const next = slots.map((id) => (id !== null && have.has(id) ? id : null));
  const placed = new Set(next.filter((x): x is number => x !== null));
  for (const id of rackIds) {
    if (placed.has(id)) continue;
    let at = preferred !== null && preferred >= 0 && preferred < RACK_SLOTS && next[preferred] === null ? preferred : -1;
    preferred = null;
    if (at < 0) {
      for (let i = RACK_SLOTS - 1; i >= 0; i--) {
        if (next[i] === null) {
          at = i;
          break;
        }
      }
    }
    if (at < 0) break; // yer yok (olmamalı: 32 yuva > en fazla 16 taş)
    next[at] = id;
    placed.add(id);
  }
  return next;
}

/** Taşı yuvaya taşır; yuva doluysa iki taş yer değiştirir. */
export function moveTile(slots: Slots, id: number, to: number): Slots {
  const from = slots.indexOf(id);
  if (from < 0 || to < 0 || to >= RACK_SLOTS || from === to) return slots;
  const next = slots.slice();
  next[from] = next[to];
  next[to] = id;
  return next;
}

export interface RackGroup {
  /** Gruptaki taşların yuva numaraları (soldan sağa). */
  slots: number[];
  ids: number[];
}

/** Aynı sırada yan yana duran taş grupları (soldan sağa, üst sıra önce). */
export function groupsOf(slots: Slots): RackGroup[] {
  const out: RackGroup[] = [];
  for (let r = 0; r < RACK_ROWS; r++) {
    let cur: RackGroup | null = null;
    for (let c = 0; c < RACK_COLS; c++) {
      const i = r * RACK_COLS + c;
      const id = slots[i];
      if (id === null) {
        cur = null;
        continue;
      }
      if (!cur) {
        cur = { slots: [], ids: [] };
        out.push(cur);
      }
      cur.slots.push(i);
      cur.ids.push(id);
    }
  }
  return out;
}

/** Taşları verilen sırayla, aralarında boşluk bırakmadan baştan dizer (Harfe/Renge Diz). */
export function packSlots(ids: number[]): Slots {
  return initialSlots(ids);
}
