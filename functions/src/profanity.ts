/**
 * Küfür filtresi (sunucu tarafı). Listeler: tools/build_profanity.py (LDNOOBW, CC BY 4.0 + ekler).
 *
 * Kandırma denemelerine karşı metin normalleştirilir:
 *  - dile göre küçük harf (Türkçede I->ı, İ->i; "sık" ile "sik" ayrı kalır)
 *  - rakam/simge ile yazım: s1k, 4mk, $ik, @ -> a ...
 *  - harf tekrarı: siiiiik -> sik
 *  - araya konan boşluk/nokta: "a.m.k", "s i k" -> amk, sik
 *  - Türkçe olmayan şapkalar: ö/ü/ş/ç/ğ -> o/u/s/c/g ikinci bir varyant olarak (ı/i dokunulmaz)
 */
import LISTS from "./profanity_lists.json";

type Lang = keyof typeof LISTS;

const LEET: Record<string, string> = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "@": "a", "$": "s", "€": "e", "!": "i",
};
const FOLD: Record<string, string> = { ö: "o", ü: "u", ş: "s", ç: "c", ğ: "g", ä: "a", é: "e", è: "e", ê: "e", à: "a", á: "a", í: "i", ó: "o", ú: "u", ñ: "n", ã: "a", õ: "o", â: "a", ô: "o" };

const fold = (s: string) => [...s].map((c) => FOLD[c] ?? c).join("");
const squeeze = (s: string) => s.replace(/(.)\1+/gu, "$1");

interface Prepared {
  words: Set<string>;
  phrases: string[];
  stems: string[];
  allow: Set<string>;
}

const prepared = new Map<Lang, Prepared>();
function listFor(lang: Lang): Prepared {
  let p = prepared.get(lang);
  if (!p) {
    const l = LISTS[lang];
    const words = new Set<string>();
    const phrases: string[] = [];
    for (const w of l.words) {
      for (const v of new Set([w, fold(w), squeeze(w), squeeze(fold(w))])) {
        if (v.includes(" ")) phrases.push(v);
        else words.add(v);
      }
    }
    const stems = [...new Set(l.stems.flatMap((s) => [s, fold(s)]))];
    p = { words, phrases, stems, allow: new Set(l.allow.flatMap((a) => [a, fold(a)])) };
    prepared.set(lang, p);
  }
  return p;
}

function lower(text: string, lang: string): string {
  return text.toLocaleLowerCase(lang === "tr" ? "tr-TR" : "en-US");
}

/** Metni karşılaştırılabilir kelimelere ayırır (tek harflik dizileri birleştirir: "a.m.k" -> "amk"). */
export function tokens(text: string, lang: string): string[] {
  const s = [...lower(text, lang).normalize("NFC")].map((c) => LEET[c] ?? c).join("");
  const raw = s.split(/[^\p{L}]+/u).filter(Boolean);
  const out: string[] = [];
  let run = "";
  for (const tk of raw) {
    if ([...tk].length === 1) run += tk;
    else {
      if (run.length > 1) out.push(run);
      else if (run) out.push(run);
      run = "";
      out.push(tk);
    }
  }
  if (run) out.push(run);
  return out;
}

/**
 * Türkçede ı ile yazılarak kaçırılmaya çalışılan kökler ("sıktır", "sıkeyim").
 * Bu kökler gerçek Türkçe kelimelerle çakışmadığı için ı->i katlanarak da aranır
 * ("sıktı", "sıkıldım", "sıkışık" gibi masum kelimeler bu listede yok).
 */
const TR_DOTLESS_STEMS = ["siktir", "sikeyim", "sikerim", "sikiyim", "sktr", "orospu", "amına", "amina"];

/** Metin kontrol edilen dillerden herhangi birinde küfür içeriyor mu. */
export function containsProfanity(text: string, langs: string[]): boolean {
  for (const lang of new Set(langs)) {
    if (!(lang in LISTS)) continue;
    const l = listFor(lang as Lang);
    const toks = tokens(text, lang);
    const variants = toks.map((t) => [...new Set([t, fold(t), squeeze(t), squeeze(fold(t))])]);
    for (const vs of variants) {
      if (vs.some((v) => l.allow.has(v))) continue;
      if (lang === "tr") {
        const dotted = vs.map((v) => v.replace(/ı/g, "i"));
        if (dotted.some((v) => TR_DOTLESS_STEMS.some((st) => v.startsWith(st)))) return true;
      }
      if (vs.some((v) => l.words.has(v))) return true;
      if (vs.some((v) => l.stems.some((st) => v.startsWith(st)))) return true;
    }
    // Çok kelimeli ifadeler
    const joined = " " + variants.map((v) => v[0]).join(" ") + " ";
    const joinedFold = " " + variants.map((v) => squeeze(fold(v[0]))).join(" ") + " ";
    if (l.phrases.some((ph) => joined.includes(` ${ph} `) || joinedFold.includes(` ${ph} `))) return true;
  }
  return false;
}

/** Bağlantı / reklam engeli. */
export function containsLink(text: string): boolean {
  return /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|me|tr|de|ru|xyz|app|gg|ly)\b)/i.test(text);
}

const GUEST: Record<string, string> = {
  tr: "Misafir", en: "Guest", de: "Gast", fr: "Invité", es: "Invitado", it: "Ospite", pt: "Convidado",
};
const ALL_LANGS = Object.keys(LISTS);

/**
 * Masada herkesin göreceği oyuncu adını temizler: en fazla 12 karakter;
 * boşsa, küfür ya da bağlantı içeriyorsa masanın dilinde "Misafir 1234" gibi bir ad verilir.
 */
export function cleanName(raw: unknown, uid: string, lang: string): string {
  const name = String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, 12);
  if (name && !containsProfanity(name, ALL_LANGS) && !containsLink(name)) return name;
  const n = String(parseInt(uid.slice(0, 6), 36) % 10000).padStart(4, "0");
  return `${GUEST[lang] ?? GUEST.en} ${n}`;
}
