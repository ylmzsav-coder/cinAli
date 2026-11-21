/**
 * Oyun dilleri: alfabe (harf değeri = alfabedeki sıra), taş dağılımı ve
 * sözlük dosyası. Taş dağılımları her dilde toplam 117 harf taşıdır (+2 joker = 119 taş) ve harf
 * sıklığından türetilip bot simülasyonuyla dengelenmiştir. Türkçede A ve E 5'er
 * adettir; İ, K, O, T ile diğer sık harfler eser sahibinin isteğiyle artırılmıştır.
 */

export type LangCode = "tr" | "en" | "de" | "fr" | "es" | "it" | "pt";

export interface LangPack {
  code: LangCode;
  /** Dilin kendi adıyla. */
  name: string;
  /** BCP 47 yerel ayarı (büyük harf dönüşümü ve sayı biçimi için). */
  locale: string;
  alphabet: string[];
  counts: Record<string, number>;
  /** Kelime oyunu bu dilde oynanabilir mi (sözlük hazır mı). */
  playable: boolean;
}

const split = (s: string) => [...s];

function counts(alphabet: string, list: number[]): Record<string, number> {
  const a = split(alphabet);
  if (a.length !== list.length) throw new Error("taş dağılımı alfabeyle uyuşmuyor");
  return Object.fromEntries(a.map((l, i) => [l, list[i]]));
}

const LATIN = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const LANGS: Record<LangCode, LangPack> = {
  tr: {
    code: "tr", name: "Türkçe", locale: "tr-TR", playable: true,
    alphabet: split("ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ"),
    //               A B C Ç D E F G Ğ H I İ J K L M N O Ö P R S Ş T U Ü V Y Z
    counts: counts("ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ", [5, 4, 2, 2, 5, 5, 1, 3, 1, 2, 5, 8, 1, 8, 7, 5, 7, 5, 1, 2, 7, 5, 3, 6, 5, 3, 2, 5, 2]),
  },
  en: {
    code: "en", name: "English", locale: "en-US", playable: true,
    alphabet: split(LATIN),
    //               A B C D E F G H I J K L M N O P Q R S T U V W X Y Z
    counts: counts(LATIN, [5, 3, 6, 6, 5, 3, 5, 5, 5, 1, 3, 7, 5, 9, 5, 5, 1, 9, 7, 9, 4, 3, 2, 1, 2, 1]),
  },
  fr: {
    code: "fr", name: "Français", locale: "fr-FR", playable: true,
    alphabet: split(LATIN),
    counts: counts(LATIN, [5, 4, 8, 5, 5, 4, 4, 3, 5, 1, 1, 6, 6, 9, 5, 5, 1, 11, 7, 9, 5, 4, 1, 1, 1, 1]),
  },
  es: {
    code: "es", name: "Español", locale: "es-ES", playable: true,
    alphabet: split("ABCDEFGHIJKLMNÑOPQRSTUVWXYZ"),
    //                         A B C D E F G H I J K L M N Ñ O P Q R S T U V W X Y Z
    counts: counts("ABCDEFGHIJKLMNÑOPQRSTUVWXYZ", [9, 4, 6, 5, 9, 4, 4, 3, 6, 1, 1, 5, 5, 8, 1, 7, 5, 1, 9, 6, 6, 4, 4, 1, 1, 1, 1]),
  },
  pt: {
    code: "pt", name: "Português", locale: "pt-BR", playable: true,
    alphabet: split(LATIN),
    counts: counts(LATIN, [9, 4, 6, 5, 9, 4, 4, 4, 6, 1, 1, 6, 5, 6, 8, 5, 1, 9, 6, 6, 4, 4, 1, 1, 1, 1]),
  },
  de: {
    code: "de", name: "Deutsch", locale: "de-DE", playable: true,
    // 26 harf + Ä Ö Ü alfabenin sonunda (27-29); ß, SS olarak yazılır
    alphabet: split("ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ"),
    //                               A B C D E F G H I J K L M N O P Q R S T U V W X Y Z Ä Ö Ü
    counts: counts("ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ", [5, 4, 5, 4, 10, 4, 5, 6, 5, 1, 4, 6, 4, 10, 3, 3, 1, 7, 7, 6, 4, 3, 3, 1, 1, 2, 1, 1, 1]),
  },
  it: {
    code: "it", name: "Italiano", locale: "it-IT", playable: true,
    // 21 harflik İtalyan alfabesi (J K W X Y yalnızca yabancı kelimelerde)
    alphabet: split("ABCDEFGHILMNOPQRSTUVZ"),
    //                       A B C D E F G H I L M N O P Q R S T U V Z
    counts: counts("ABCDEFGHILMNOPQRSTUVZ", [9, 3, 7, 4, 9, 3, 4, 1, 7, 6, 5, 9, 9, 5, 1, 10, 7, 10, 4, 2, 2]),
  },
};

export const LANG_ORDER: LangCode[] = ["tr", "en", "de", "fr", "es", "it", "pt"];
export const PLAYABLE_LANGS = LANG_ORDER.filter((c) => LANGS[c].playable);

/** Tarayıcı/telefon diline göre en uygun dil. */
export function detectLang(preferred: readonly string[] = []): LangCode {
  for (const p of preferred) {
    const code = p.toLowerCase().slice(0, 2) as LangCode;
    if (code in LANGS) return code;
  }
  return "en";
}

// ---- Etkin oyun dili ---------------------------------------------------
interface Active {
  pack: LangPack;
  index: Map<string, number>;
}

function activate(pack: LangPack): Active {
  return { pack, index: new Map(pack.alphabet.map((l, i) => [l, i])) };
}

let active = activate(LANGS.tr);

export function setGameLang(code: LangCode) {
  if (active.pack.code !== code) active = activate(LANGS[code]);
}

export const gameLang = (): LangPack => active.pack;
export const alphabet = (): string[] => active.pack.alphabet;
/** Harfin alfabedeki sırası (0'dan); alfabede yoksa -1. */
export const letterIndex = (l: string): number => active.index.get(l) ?? -1;
/** Harf değeri: alfabedeki sıra (1'den). */
export const letterValue = (l: string): number => (active.index.get(l) ?? -1) + 1;
