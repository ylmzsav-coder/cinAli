import { describe, expect, it } from "vitest";
import { LANG_ORDER, LANGS } from "../src/game/lang";
import de from "../src/i18n/de";
import en from "../src/i18n/en";
import es from "../src/i18n/es";
import fr from "../src/i18n/fr";
import itl from "../src/i18n/it";
import pt from "../src/i18n/pt";
import tr from "../src/i18n/tr";

const catalogs = { tr, en, de, fr, es, it: itl, pt } as Record<string, Record<string, unknown>>;
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("çeviriler", () => {
  it("her dilin kataloğu var", () => {
    expect(Object.keys(catalogs).sort()).toEqual([...LANG_ORDER].sort());
  });
  for (const [code, cat] of Object.entries(catalogs)) {
    it(`${code}: tüm anahtarlar ve yer tutucular Türkçeyle aynı`, () => {
      expect(Object.keys(cat).sort()).toEqual(Object.keys(tr).sort());
      for (const [k, v] of Object.entries(tr)) {
        if (typeof v === "string") expect(placeholders(cat[k] as string), `${code}.${k}`).toEqual(placeholders(v));
        else expect((cat[k] as string[]).length, `${code}.${k}`).toBe(v.length);
      }
    });
  }
  it("oynanabilir dillerde 104 harf taşı var", () => {
    for (const c of LANG_ORDER.filter((c) => LANGS[c].playable)) {
      const total = Object.values(LANGS[c].counts).reduce((a, b) => a + b, 0);
      expect(total, c).toBe(104);
    }
  });
});

describe("Kumbara (çiplerin biriktiği yer)", () => {
  const WALLET = { tr: /cüzdan/i, en: /wallet/i, de: /geldbörse|brieftasche/i, fr: /portefeuille/i, es: /cartera|billetera/i, it: /portafoglio/i, pt: /carteira/i } as Record<string, RegExp>;
  const NAME = { tr: "Kumbara", en: "Money box", de: "Spardose", fr: "Tirelire", es: "Hucha", it: "Salvadanaio", pt: "Cofrinho" } as Record<string, string>;
  it("hiçbir metinde 'cüzdan' geçmez; her dilde kumbaranın adı var", () => {
    for (const [code, cat] of Object.entries(catalogs)) {
      for (const [k, v] of Object.entries(cat)) if (typeof v === "string") expect(WALLET[code].test(v), `${code}.${k}: ${v}`).toBe(false);
      expect(cat.kumbara, code).toBe(NAME[code]);
    }
  });
});
