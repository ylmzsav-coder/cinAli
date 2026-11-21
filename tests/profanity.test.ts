import { describe, expect, it } from "vitest";
import { containsLink, containsProfanity } from "../functions/src/profanity";

const bad = (text: string, langs = ["tr"]) => containsProfanity(text, langs);

describe("küfür filtresi", () => {
  it("Türkçe küfürleri ve kandırma denemelerini yakalar", () => {
    for (const t of ["siktir git", "S1KT1R", "siiiiktir", "a.m.k", "amk ya", "AQ", "orospu çocuğu", "o r o s p u",
      "piç", "yavşak herif", "sikerim", "$ikeyim", "götveren", "g0tveren", "ananı sikeyim", "pezevenk"]) {
      expect(bad(t), t).toBe(true);
    }
  });
  it("Türkçe masum kelimeleri engellemez", () => {
    for (const t of ["sıkıldım biraz", "şikayet ediyorum", "sikayet", "sikke topluyorum", "götürmek lazım",
      "amaç kazanmak", "ama olmadı", "ambar", "tasarım güzel", "çok güzel kelime", "kalemi ver",
      "Merhaba, iyi oyunlar!", "tebrikler usta", "Ispanak", "Iğdır"]) {
      expect(bad(t), t).toBe(false);
    }
  });
  it("diğer diller", () => {
    expect(bad("you are a f*cking idiot", ["en"])).toBe(false); // yıldızlı sansürlü yazım geçer
    expect(bad("fuck you", ["en"])).toBe(true);
    expect(bad("sh1t happens", ["en"])).toBe(true);
    expect(bad("good game, well played", ["en"])).toBe(false);
    expect(bad("Scunthorpe assessment class", ["en"])).toBe(false);
    expect(bad("du Arschloch", ["de"])).toBe(true);
    expect(bad("Ich bin am Tisch", ["de"])).toBe(false); // Almanca masada Almanca konuşan: Türkçe liste uygulanmaz
    expect(bad("putain de merde", ["fr"])).toBe(true);
    expect(bad("café con leche", ["es"])).toBe(false);
    expect(bad("hijo de puta", ["es"])).toBe(true);
    expect(bad("che cazzo fai", ["it"])).toBe(true);
    expect(bad("vai tomar no cu", ["pt"])).toBe(true);
    expect(bad("bom jogo", ["pt"])).toBe(false);
  });
  it("bağlantıları yakalar", () => {
    expect(containsLink("bak www.site.com")).toBe(true);
    expect(containsLink("https://x.io")).toBe(true);
    expect(containsLink("güzel oyun.")).toBe(false);
  });
});
