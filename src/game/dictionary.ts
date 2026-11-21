import { ALPHABET, LETTER_INDEX } from "./tiles";

export const MIN_WORD_LENGTH = 3;

export interface DictWord {
  word: string;
  value: number;
  /** Her harften kaç adet (ALPHABET sırasıyla). */
  counts: Uint8Array;
  len: number;
}

export class Dictionary {
  readonly words: Set<string>;
  readonly entries: DictWord[];

  constructor(list: Iterable<string>) {
    this.words = new Set();
    this.entries = [];
    for (const raw of list) {
      const w = raw.trim();
      if (w.length < MIN_WORD_LENGTH || this.words.has(w)) continue;
      const counts = new Uint8Array(ALPHABET.length);
      let value = 0;
      let ok = true;
      for (const ch of w) {
        const idx = LETTER_INDEX[ch];
        if (idx === undefined) {
          ok = false;
          break;
        }
        counts[idx]++;
        value += idx + 1;
      }
      if (!ok) continue;
      this.words.add(w);
      this.entries.push({ word: w, value, counts, len: [...w].length });
    }
  }

  has(word: string): boolean {
    return this.words.has(word);
  }

  static fromText(text: string): Dictionary {
    return new Dictionary(text.split("\n"));
  }
}

/** Türkçe büyük harfe çevirir (i → İ, ı → I). */
export function toTurkishUpper(s: string): string {
  return s.toLocaleUpperCase("tr-TR");
}
