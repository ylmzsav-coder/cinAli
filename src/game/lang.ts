/**
 * Oyun dilleri: alfabe (harf değeri = alfabedeki sıra), taş dağılımı ve
 * sözlük dosyası. Taş dağılımları her dilde toplam 104 harf taşıdır (+2 joker = 106 taş, okeydeki gibi) ve harf
 * sıklığından türetilip bot simülasyonuyla dengelenmiştir.  Türkçede A ve E 4'er
 * adettir; sesli harf taşı toplamı alfabedeki harf sayısı kadardır (29); O 6 adettir.
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

/**
 * İki harfli geçerli kelimeler: her dilde yalnızca listedekiler geçerlidir
 * (Türkçe: oyun sahibinin belirlediği liste; diğer diller: o dilin anlamlı iki
 * harfli kelimeleri, aksanlar oyun alfabesine göre sadeleştirilmiş). Liste
 * olmayan bir dilde biri sesli biri sessiz harf olan her ikili geçerlidir.
 */
export const TWO_LETTER_WORDS: Partial<Record<LangCode, readonly string[]>> = {
  tr: ["AR", "AT", "AY", "AĞ", "AS", "AD", "AF", "AH", "AK", "AL", "AŞ", "AZ", "AN", "AÇ", "RA", "TA", "YA", "DA", "HA", "KA", "LA", "NA", "MA", "ER", "ET", "EY", "EK", "EL", "EŞ", "EZ", "EN", "EM", "RE", "TE", "YE", "PE", "SE", "FE", "HE", "KE", "LE", "ŞE", "ZE", "CE", "VE", "BE", "NE", "ME", "ÇE", "OL", "OY", "OK", "İZ", "ON", "LO", "KO", "MO", "NO", "TO", "RO", "İT", "İS", "İP", "İR", "İŞ", "İL", "İN", "İM", "Tİ", "Pİ", "Sİ", "Dİ", "Kİ", "Lİ", "Cİ", "Mİ", "ÖZ", "ÖN", "ÖL", "ÖP", "ÖT", "ÖD", "ÜN", "ÜÇ", "ÜS", "BU", "UN", "UT", "US", "UÇ", "UZ", "UR", "İÇ", "AB", "AV", "EH", "EV", "ES", "HU", "IR", "OD", "OH", "OT", "ÖÇ", "ÖF", "ÖR", "ŞU", "UF", "UY", "ÜT"],
  en: ["AD", "AH", "AM", "AN", "AS", "AT", "AW", "AX", "AY", "BE", "BY", "DO", "GO", "HA", "HE", "HI", "IF", "IN", "IS", "IT", "ME", "MY", "NO", "OF", "OH", "OK", "ON", "OR", "OW", "OX", "PA", "PI", "SO", "TO", "UP", "US", "WE", "YE", "YO"],
  de: ["AB", "AH", "AN", "AU", "DA", "DU", "EI", "ER", "ES", "IM", "IN", "JA", "JE", "NA", "OB", "OH", "SO", "UM", "WO", "ZU", "ÖL"],
  fr: ["AH", "AI", "AN", "AU", "BU", "CA", "CE", "CI", "DE", "DO", "DU", "EH", "EN", "ES", "ET", "EU", "FA", "HA", "HE", "IL", "IN", "JE", "LA", "LE", "LI", "LU", "MA", "ME", "MI", "MU", "NE", "NI", "NU", "OH", "ON", "OR", "OS", "OU", "PU", "RE", "RU", "SA", "SE", "SI", "SU", "TA", "TE", "TU", "UN", "VA", "VU"],
  es: ["AH", "AL", "AY", "DA", "DE", "DI", "DO", "EH", "EL", "EN", "ES", "FA", "HA", "HE", "IR", "JA", "LA", "LE", "LO", "ME", "MI", "NI", "NO", "OH", "OS", "SE", "SI", "SU", "TE", "TI", "TU", "UN", "VA", "VE", "VI", "YA", "YO"],
  it: ["AH", "AI", "AL", "CE", "CI", "DA", "DI", "DO", "EH", "FA", "FU", "HA", "HO", "IL", "IN", "LA", "LE", "LI", "LO", "MA", "ME", "MI", "NE", "NO", "OH", "RE", "SE", "SI", "SO", "SU", "TE", "TI", "TU", "UN", "VA", "VI"],
  pt: ["AH", "AI", "AO", "AS", "DA", "DE", "DO", "EH", "EI", "EM", "ES", "EU", "HA", "JA", "LA", "LE", "ME", "NA", "NO", "NU", "OH", "OI", "OS", "OU", "PE", "PO", "SE", "SI", "SO", "TE", "TU", "UM", "VA", "VE", "VI", "VO", "XI"],
};

/** Her dilin sesli harfleri (iki harfli kelime kuralı için). */
export const VOWELS: Record<LangCode, string> = {
  tr: "AEIİOÖUÜ",
  en: "AEIOU",
  de: "AEIOUÄÖÜ",
  fr: "AEIOU",
  es: "AEIOU",
  it: "AEIOU",
  pt: "AEIOU",
};

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
    counts: counts("ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ", [7, 4, 2, 2, 5, 5, 1, 2, 1, 2, 4, 6, 1, 8, 6, 5, 5, 3, 1, 2, 6, 5, 2, 6, 3, 2, 2, 4, 2]),
  },
  en: {
    code: "en", name: "English", locale: "en-US", playable: true,
    alphabet: split(LATIN),
    //               A B C D E F G H I J K L M N O P Q R S T U V W X Y Z
    counts: counts(LATIN, [4, 3, 5, 5, 4, 3, 4, 4, 4, 2, 3, 6, 4, 8, 4, 4, 2, 8, 6, 8, 3, 2, 2, 2, 2, 2]),
  },
  fr: {
    code: "fr", name: "Français", locale: "fr-FR", playable: true,
    alphabet: split(LATIN),
    counts: counts(LATIN, [4, 3, 7, 4, 4, 3, 3, 2, 4, 2, 2, 5, 5, 8, 4, 4, 2, 9, 6, 8, 4, 3, 2, 2, 2, 2]),
  },
  es: {
    code: "es", name: "Español", locale: "es-ES", playable: true,
    alphabet: split("ABCDEFGHIJKLMNÑOPQRSTUVWXYZ"),
    //                         A B C D E F G H I J K L M N Ñ O P Q R S T U V W X Y Z
    counts: counts("ABCDEFGHIJKLMNÑOPQRSTUVWXYZ", [8, 3, 5, 4, 8, 3, 3, 2, 5, 2, 2, 4, 4, 7, 2, 6, 4, 2, 8, 5, 5, 3, 3, 2, 2, 1, 1]),
  },
  pt: {
    code: "pt", name: "Português", locale: "pt-BR", playable: true,
    alphabet: split(LATIN),
    counts: counts(LATIN, [8, 3, 5, 4, 8, 3, 3, 3, 5, 2, 2, 5, 4, 5, 7, 4, 2, 8, 5, 5, 3, 3, 2, 2, 2, 1]),
  },
  de: {
    code: "de", name: "Deutsch", locale: "de-DE", playable: true,
    // 26 harf + Ä Ö Ü alfabenin sonunda (27-29); ß, SS olarak yazılır
    alphabet: split("ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ"),
    //                               A B C D E F G H I J K L M N O P Q R S T U V W X Y Z Ä Ö Ü
    counts: counts("ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ", [4, 3, 4, 3, 9, 3, 4, 5, 4, 2, 3, 5, 3, 9, 3, 2, 2, 6, 6, 5, 3, 2, 2, 2, 2, 2, 2, 2, 2]),
  },
  it: {
    code: "it", name: "Italiano", locale: "it-IT", playable: true,
    // 21 harflik İtalyan alfabesi (J K W X Y yalnızca yabancı kelimelerde)
    alphabet: split("ABCDEFGHILMNOPQRSTUVZ"),
    //                       A B C D E F G H I L M N O P Q R S T U V Z
    counts: counts("ABCDEFGHILMNOPQRSTUVZ", [8, 3, 6, 3, 8, 3, 3, 2, 6, 5, 4, 8, 8, 4, 2, 9, 6, 9, 3, 2, 2]),
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
