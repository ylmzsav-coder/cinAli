/**
 * Kelime anlamları: yerdeki bir kelimeye dokununca, kelimenin oyun dilindeki
 * Vikisözlük (Wiktionary) sayfasından ilk birkaç anlamı getirir. Vikisözlük
 * tarayıcıdan erişime izin verir (CORS), anahtar gerekmez. Sonuçlar oturum
 * boyunca bellekte tutulur.
 */
import { LANGS, type LangCode } from "./game/lang";

export interface Meaning {
  /** Sözlükte bulunan başlık (küçük harfli yazım). */
  title: string;
  /** İlk birkaç anlam (düz metin). */
  senses: string[];
  /** Vikisözlük sayfasının adresi. */
  url: string;
}

const MAX_SENSES = 4;
const MAX_LEN = 260;
const cache = new Map<string, Promise<Meaning | null>>();

/** Dil bölümünün başlığını tanır (her Vikisözlük farklı yazar). */
function isLangHeading(el: Element, lang: LangCode): boolean {
  const id = el.id || el.querySelector("[id]")?.id || "";
  switch (lang) {
    case "tr": return id === "Türkçe";
    case "en": return id === "English";
    case "fr": return id === "Français";
    case "es": return id === "Español";
    case "it": return id === "Italiano";
    case "pt": return id === "Português";
    case "de": return /\(Deutsch\)$/.test(id);
  }
  return false;
}

/** Portekizce Vikisözlük dilleri h1 ile, diğerleri h2 ile ayırır. */
const sectionTag = (lang: LangCode) => (lang === "pt" ? "H1" : "H2");

function clean(el: Element): string {
  const c = el.cloneNode(true) as Element;
  c.querySelectorAll("ul, ol, dl, style, script, sup, .reference, .mw-ref, link").forEach((x) => x.remove());
  let s = (c.textContent ?? "").replace(/\s+/g, " ").trim();
  s = s.replace(/^\[\d+[a-z]?\]\s*/, ""); // Almanca "[1]" numarası
  s = s.replace(/\s+([,.;:])/g, "$1");
  if (s.length > MAX_LEN) s = s.slice(0, MAX_LEN - 1).trimEnd() + "…";
  return s;
}

/** Vikisözlük sayfasının HTML'inden, istenen dilin bölümündeki anlamları çıkarır. */
export function extractSenses(html: string, lang: LangCode): string[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const tag = sectionTag(lang);
  const all = Array.from(doc.body.querySelectorAll("*"));
  const start = all.findIndex((el) => el.tagName === tag && isLangHeading(el, lang));
  if (start < 0) return [];
  const out: string[] = [];
  let afterBedeutungen = false;
  for (let i = start + 1; i < all.length && out.length < MAX_SENSES; i++) {
    const el = all[i];
    if (el.tagName === tag) break; // sonraki dilin bölümü
    if (lang === "de") {
      // Almanca: "Bedeutungen:" başlığından sonraki ilk listedeki [1], [2]…
      if (el.tagName === "P" && /^Bedeutungen:?$/.test((el.textContent ?? "").trim())) afterBedeutungen = true;
      else if (afterBedeutungen && el.tagName === "DD" && el.parentElement?.previousElementSibling?.textContent?.trim().startsWith("Bedeutungen")) {
        const s = clean(el);
        if (s) out.push(s);
      } else if (afterBedeutungen && out.length && el.tagName === "P") break;
      continue;
    }
    if (lang === "es") {
      // İspanyolca: <dl><dt>1</dt><dd>anlam</dd></dl>
      if (el.tagName === "DD" && /^\d+$/.test(el.previousElementSibling?.textContent?.trim() ?? "")) {
        const s = clean(el);
        if (s) out.push(s);
      }
      continue;
    }
    // Diğerleri: numaralı liste (<ol><li>), iç içe örnek listeleri hariç
    if (el.tagName === "LI" && el.parentElement?.tagName === "OL" && !el.parentElement.closest("li, .references")) {
      const s = clean(el);
      if (s && !s.startsWith("↑")) out.push(s);
    }
  }
  return out;
}

async function fetchPage(lang: LangCode, title: string): Promise<string | null> {
  const url = `https://${lang}.wiktionary.org/w/api.php?action=parse&prop=text&format=json&formatversion=2&redirects=1&origin=*&page=${encodeURIComponent(title)}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error("network");
  const json = (await res.json()) as { parse?: { text?: string }; error?: { code?: string } };
  return json.parse?.text ?? null;
}

/** Aksanları ve ß'yi sadeleştirir (oyun sözlüğü aksansız yazar: ECHOPPER = échopper). */
const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ß/g, "ss").toLowerCase();

/** Aksansız kelimenin sözlükteki gerçek yazımlarını arar (échopper, estribación…). */
async function searchTitles(lang: LangCode, word: string): Promise<string[]> {
  const url = `https://${lang}.wiktionary.org/w/api.php?action=opensearch&format=json&namespace=0&limit=15&origin=*&search=${encodeURIComponent(word)}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error("network");
  const json = (await res.json()) as [string, string[]];
  const target = fold(word);
  return (json[1] ?? []).filter((t) => fold(t) === target);
}

/** Wikimedia, tarayıcıdan gelen istekleri bu başlıkla tanır (kullanım kuralları). */
const HEADERS = { "Api-User-Agent": "WordOkey/1.0 (word game; meaning lookup)" };

/** Kelimenin anlamını getirir; bulunamazsa null, bağlantı yoksa hata fırlatır. */
export function lookupMeaning(word: string, lang: LangCode): Promise<Meaning | null> {
  const key = `${lang}:${word}`;
  let p = cache.get(key);
  if (!p) {
    p = (async () => {
      const locale = LANGS[lang]?.locale ?? lang;
      const lower = word.toLocaleLowerCase(locale);
      const capital = lower.charAt(0).toLocaleUpperCase(locale) + lower.slice(1);
      // Almanca adlar büyük harfle başlar: önce o denenir
      const tries = lang === "de" ? [capital, lower] : [lower, capital];
      for (const title of tries) {
        const html = await fetchPage(lang, title);
        if (!html) continue;
        const senses = extractSenses(html, lang);
        if (senses.length) return { title, senses, url: `https://${lang}.wiktionary.org/wiki/${encodeURIComponent(title)}` };
      }
      // Aksanlı diller: sözlükteki gerçek yazımı bul
      if (lang !== "tr") {
        for (const title of await searchTitles(lang, lower)) {
          if (tries.includes(title)) continue;
          const html = await fetchPage(lang, title);
          const senses = html ? extractSenses(html, lang) : [];
          if (senses.length) return { title, senses, url: `https://${lang}.wiktionary.org/wiki/${encodeURIComponent(title)}` };
        }
      }
      return null;
    })();
    cache.set(key, p);
    p.catch(() => cache.delete(key)); // bağlantı hatası: sonra yeniden denensin
  }
  return p;
}
