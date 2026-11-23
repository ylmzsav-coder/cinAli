/**
 * Yasa dışı içerik filtresi (VIP odadaki serbest sohbet için).
 *
 * Engellenen konular: uyuşturucu, silah, yasa dışı bahis/kumar, satış/alım-satım
 * teklifleri ve iletişim/ödeme bilgisi paylaşımı (telefon, IBAN, Telegram, WhatsApp...).
 * Eşleşen mesaj masaya HİÇ gönderilmez; gönderen işaretlenir (chat.ts).
 *
 * Kandırma denemelerine karşı metin normalleştirilir: küçük harf, rakam/simge
 * ile yazım (k0ka1n), şapkasız yazım (uyusturucu), harf tekrarı (kokaaaain) ve
 * araya boşluk/nokta koyma (k.o.k.a.i.n).
 */

export type IllegalCategory = "drugs" | "weapons" | "gambling" | "selling" | "contact";

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "@": "a", "$": "s", "€": "e", "!": "i" };
const FOLD: Record<string, string> = {
  ı: "i", ö: "o", ü: "u", ş: "s", ç: "c", ğ: "g", ä: "a", ß: "ss", é: "e", è: "e", ê: "e", ë: "e", à: "a", á: "a", â: "a", ã: "a",
  í: "i", ì: "i", î: "i", ó: "o", ò: "o", ô: "o", õ: "o", ú: "u", ù: "u", û: "u", ñ: "n",
};

/**
 * Kelime BAŞI eşleşen kökler (şapkasız, küçük harf). Masum kelimelerle
 * çakışmamaları için yeterince uzun/özgül seçildi.
 */
const STEMS: Record<Exclude<IllegalCategory, "contact">, string[]> = {
  drugs: [
    "uyusturucu", "kenevir", "kokain", "eroin", "bonzai", "metamfetamin", "amfetamin", "ekstazi", "captagon",
    "kaptagon", "torbaci", "sentetik kannabinoid", "cocaine", "heroin", "marijuana", "marihuana", "cannabis", "hashish",
    "hasis", "fentanyl", "fentanil", "ecstasy", "mdma", "methamphetamine", "amphetamine", "kokaina", "heroina", "cocaina",
    "metanfetamina", "droga", "droge", "drogue", "rauschgift", "stupefacent", "estupefaciente", "skunk", "lsd",
  ],
  weapons: [
    "ruhsatsiz", "kalasnikof", "kalashnikov", "kalasnikov", "glock", "tabanca", "kurusiki",
    "handgun", "firearm", "ammunition", "waffenhandel", "schusswaffe", "arma de fuego", "arme a feu",
  ],
  gambling: [
    "kumar", "kacak bahis", "yasadisi bahis", "illegal bahis", "bahis sitesi", "bahis sitesi", "casino", "kumarhane",
    "rulet", "betting", "sportsbook", "gluecksspiel", "glucksspiel", "apuesta", "scommess", "aposta",
  ],
  selling: [
    "satilik", "satiyorum", "satarim", "satan var", "kim satiyor", "nereden alirim", "nerden alirim",
    "for sale", "selling", "who sells", "verkaufe", "zu verkaufen", "a vendre", "je vends", "se vende", "vendo", "in vendita",
    "a venda",
  ],
};

/** Tek başına geçince yeterli olan TAM kelimeler (kök olarak aranırsa masum kelimelere çarpar). */
const WORDS: Record<Exclude<IllegalCategory, "contact">, string[]> = {
  drugs: ["esrar", "esrar satan", "meth", "weed", "drug", "drugs", "ot satan", "mal satan", "hap satan"],
  weapons: ["uzi", "silah satan", "silah satilik", "silah al", "gun for sale", "guns for sale", "mermi satan"],
  gambling: ["bahis oyna", "bahis oynat", "bet sitesi", "kacak iddaa"],
  selling: [],
};

/** İletişim ve ödeme bilgisi: oyun dışına çekme ve para alışverişi. */
const CONTACT_STEMS = ["telegram", "whatsapp", "watsap", "vatsap", "snapchat", "instagram", "discord", "papara", "ininal", "western union", "bitcoin"];
/** Yalnızca tam kelime olarak (kök olarak aranırsa "instant" gibi masum kelimelere çarpar). */
const CONTACT_WORDS = ["insta", "wp", "wpden", "wp den", "iban", "usdt", "kripto", "ozelden yaz", "dm at", "dmden yaz", "dm"];

function normalize(text: string): string {
  const lower = text.toLocaleLowerCase("tr-TR").normalize("NFC");
  const mapped = [...lower].map((c) => LEET[c] ?? FOLD[c] ?? c).join("");
  // Harf dışını boşluğa çevir, harf tekrarlarını sıkıştır
  return mapped.replace(/[^\p{L}]+/gu, " ").replace(/(\p{L})\1+/gu, "$1").trim();
}

/** "k o k a i n", "k.o.k.a.i.n" gibi tek harflik dizileri birleştirir. */
function joinSingles(s: string): string {
  const out: string[] = [];
  let run = "";
  for (const w of s.split(" ")) {
    if (w.length === 1) run += w;
    else {
      if (run) out.push(run);
      run = "";
      out.push(w);
    }
  }
  if (run) out.push(run);
  return out.join(" ");
}

const squeeze = (s: string) => s.replace(/(\p{L})\1+/gu, "$1");
const PREPARED = Object.fromEntries(
  (Object.keys(STEMS) as (keyof typeof STEMS)[]).map((k) => [k, { stems: STEMS[k].map(squeeze), words: WORDS[k].map(squeeze) }]),
) as Record<keyof typeof STEMS, { stems: string[]; words: string[] }>;
const CONTACT_S = CONTACT_STEMS.map(squeeze);
const CONTACT_W = CONTACT_WORDS.map(squeeze);

/** Kelime başında başlayan eşleşme (çok kelimeli ifadeler dahil). */
const hasStem = (hay: string, stem: string) => (" " + hay).includes(" " + stem);
const hasWord = (hay: string, word: string) => (" " + hay + " ").includes(" " + word + " ");

/** Telefon numarası (10+ rakam, araya boşluk/tire konsa da), IBAN, @kullanıcı adı. */
function rawContact(text: string): boolean {
  const digits = text.replace(/[\s\-().+]/g, "");
  if (/\d{10,}/.test(digits)) return true;
  if (/\bTR\s?\d{2}[\s\d]{10,}/i.test(text)) return true;
  if (/(^|\s)@[a-z0-9_.]{3,}/i.test(text)) return true;
  if (/(https?:\/\/|www\.|t\.me\/|wa\.me\/|\b[a-z0-9-]+\.(com|net|org|io|me|tr|de|ru|xyz|app|gg|ly|bet|casino)\b)/i.test(text)) return true;
  return false;
}

/** Mesaj yasa dışı içerik ya da iletişim bilgisi içeriyorsa kategorisini döndürür. */
export function illegalCategory(text: string): IllegalCategory | null {
  const n = normalize(text);
  const variants = [...new Set([n, joinSingles(n), n.replace(/ /g, "")])];
  for (const cat of ["drugs", "weapons", "gambling", "selling"] as const) {
    const { stems, words } = PREPARED[cat];
    for (const v of variants) {
      // Boşluksuz varyantta yalnızca uzun kökler aranır (kısa kökler masum kelimelerin içinde geçebilir)
      const spaced = v.includes(" ") || v === n;
      if (stems.some((st) => (spaced ? hasStem(v, st) : st.length >= 6 && !st.includes(" ") && v.includes(st)))) return cat;
      if (words.some((w) => hasWord(v, w))) return cat;
    }
  }
  if (rawContact(text)) return "contact";
  for (const v of variants) if (CONTACT_S.some((w) => hasStem(v, w)) || CONTACT_W.some((w) => hasWord(v, w))) return "contact";
  return null;
}
