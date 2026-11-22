import { LangCode, LangPack, TWO_LETTER_WORDS, VOWELS, gameLang } from "./lang";

export const MIN_WORD_LENGTH = 3;
/** Oynanabilen en kısa kelime: iki harfli kural (biri sesli, biri sessiz). */
export const MIN_PLAY_LENGTH = 2;

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
  private readonly alphabetSet: Set<string>;

  constructor(list: Iterable<string>, pack: LangPack = gameLang()) {
    this.lang = pack.code;
    this.alphabetSet = new Set(pack.alphabet);
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

  /** Geçerli kelime mi: sözlükte olan (3+ harf) ya da iki harfli kural. */
  has(word: string): boolean {
    return this.words.has(word) || this.isTwoLetter(word);
  }

  /**
   * İki harfli kelimeler: dilin listesi varsa yalnızca listedekiler (Türkçe: AK,
   * EL, ON, Lİ…); yoksa biri sesli, biri sessiz harf olan her ikili. Oyuncu elinde
   * son taşlarla kalınca bitirebilsin diye.
   */
  isTwoLetter(word: string): boolean {
    const ch = [...word];
    if (ch.length !== 2 || !ch.every((c) => this.alphabetSet.has(c))) return false;
    const list = TWO_LETTER_WORDS[this.lang];
    if (list) return list.includes(word);
    const v = VOWELS[this.lang];
    return v.includes(ch[0]) !== v.includes(ch[1]);
  }

  static fromText(text: string, pack?: LangPack): Dictionary {
    return new Dictionary(text.split("\n"), pack);
  }
}
