import { LangCode, LangPack, gameLang } from "./lang";

export const MIN_WORD_LENGTH = 3;

export interface DictWord {
  word: string;
  value: number;
  /** Her harften kaç adet (alfabe sırasıyla). */
  counts: Uint8Array;
  len: number;
}

/** Bir dilin sözlüğü (varsayılan: etkin oyun dili). */
export class Dictionary {
  readonly lang: LangCode;
  readonly words: Set<string>;
  readonly entries: DictWord[];

  constructor(list: Iterable<string>, pack: LangPack = gameLang()) {
    this.lang = pack.code;
    const size = pack.alphabet.length;
    const index = new Map(pack.alphabet.map((l, i) => [l, i]));
    this.words = new Set();
    this.entries = [];
    for (const raw of list) {
      const w = raw.trim();
      if (w.length < MIN_WORD_LENGTH || this.words.has(w)) continue;
      const counts = new Uint8Array(size);
      let value = 0;
      let len = 0;
      let ok = true;
      for (const ch of w) {
        const idx = index.get(ch);
        if (idx === undefined) {
          ok = false;
          break;
        }
        counts[idx]++;
        value += idx + 1;
        len++;
      }
      if (!ok) continue;
      this.words.add(w);
      this.entries.push({ word: w, value, counts, len });
    }
  }

  has(word: string): boolean {
    return this.words.has(word);
  }

  static fromText(text: string, pack?: LangPack): Dictionary {
    return new Dictionary(text.split("\n"), pack);
  }
}
