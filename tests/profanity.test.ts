import { describe, expect, it } from "vitest";
import { cleanName, containsLink, containsProfanity } from "../functions/src/profanity";

const bad = (text: string, langs = ["tr"]) => containsProfanity(text, langs);

describe("küfür filtresi", () => {
  it("Türkçe küfürleri ve kandırma denemelerini yakalar", () => {
    for (const t of ["siktir git", "S1KT1R", "siiiiktir", "a.m.k", "amk ya", "AQ", "orospu çocuğu", "o r o s p u",
      "piç", "yavşak herif", "sikerim", "$ikeyim", "götveren", "g0tveren", "ananı sikeyim", "pezevenk",
      "Siktir", "SİKTİR", "siktirr", "s i k t i r", "s.i.k.t.i.r", "sktr", "siktr", "sktir", "SG", "s.g",
      "sıktır git", "SIKTIR", "sıkeyim", "s1ktır", "siktirgit", "siktiiir lan"]) {
      expect(bad(t), t).toBe(true);
    }
  });
  it("Türkçe masum kelimeleri engellemez", () => {
    for (const t of ["sıkıldım biraz", "şikayet ediyorum", "sikayet", "sikke topluyorum", "götürmek lazım",
      "amaç kazanmak", "ama olmadı", "ambar", "tasarım güzel", "çok güzel kelime", "kalemi ver",
      "canım sıktı", "çok sıktın", "sıkışık masa", "sıkı oyun", "SIKILDIM", "sığ su", "sgk", "saygı",
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

describe("oyuncu adları", () => {
  it("küfürlü veya bağlantılı adlar masanın dilinde misafir adıyla değişir", () => {
    expect(cleanName("Siktir", "abc123", "tr")).toMatch(/^Misafir \d{4}$/);
    expect(cleanName("SıKTıR", "abc123", "tr")).toMatch(/^Misafir \d{4}$/);
    expect(cleanName("fuckboy", "abc123", "de")).toMatch(/^Gast \d{4}$/);
    expect(cleanName("www.spam.com", "abc123", "en")).toMatch(/^Guest \d{4}$/);
    expect(cleanName("", "abc123", "fr")).toMatch(/^Invité \d{4}$/);
  });
  it("normal adlar korunur (12 karaktere kısaltılır)", () => {
    expect(cleanName("Ayşe", "x", "tr")).toBe("Ayşe");
    expect(cleanName("  Mehmet   Ali  ", "x", "tr")).toBe("Mehmet Ali");
    expect(cleanName("Çokuzunbirisimdir", "x", "tr")).toBe("Çokuzunbiris");
  });
});

describe("VIP: küfür var, hakaret yok", () => {
  it("küfür yakalanır, hakaret serbest", () => {
    for (const txt of ["siktir git", "amk", "orospu çocuğu", "fuck you", "va te faire enculer"]) expect([txt, containsProfanity(txt, ["tr", "en", "fr"], true)]).toEqual([txt, true]);
    for (const txt of ["şerefsiz", "serefsiz adam", "bastard", "connard", "pendejo", "stronzo"]) expect([txt, containsProfanity(txt, ["tr", "en", "fr", "es", "it"], true)]).toEqual([txt, false]);
    expect(containsProfanity("şerefsiz", ["tr"])).toBe(true); // diğer yerlerde (adlar) hakaret de süzülür
  });
});

import { containsInsult } from "../functions/src/profanity";
describe("hakaret filtresi (bütün sohbetli odalar)", () => {
  const ins = (text: string, langs = ["tr"]) => containsInsult(text, langs);
  it("Türkçe hakaretleri yakalar", () => {
    for (const t of ["şerefsiz hamle yaptın", "SEREFSIZ", "salak", "lan bu ne biçim hamle, salak", "aptal mısın", "aptalca oynuyorsun",
      "gerizekalı", "geri zekalı", "ahmak", "dangalak herif", "beyinsiz", "aşağılık", "namussuz", "pislik", "pisliğin teki",
      "ezik", "enayi", "s a l a k", "4ptal", "it oğlu it", "budala", "mankafa"]) {
      expect(ins(t), t).toBe(true);
    }
  });
  it("Türkçe masum kelimeleri engellemez", () => {
    for (const t of ["mal varlığı", "köpeğim var", "alçak sesle konuş", "adil oyun", "salam yedim", "ezilmiş domates", "ezikliği geçti",
      "Merhaba, iyi oyunlar!", "tebrikler usta", "harika hamle", "geri döndüm", "zekâ oyunu"]) {
      expect(ins(t), t).toBe(false);
    }
  });
  it("diğer diller", () => {
    expect(ins("you are an idiot", ["en"])).toBe(true);
    expect(ins("stupid move", ["en"])).toBe(true);
    expect(ins("good game, well played", ["en"])).toBe(false);
    expect(ins("Du Trottel", ["de"])).toBe(true);
    expect(ins("quel crétin", ["fr"])).toBe(true);
    expect(ins("je suis en retard", ["fr"])).toBe(false);
    expect(ins("eres un idiota", ["es"])).toBe(true);
    expect(ins("mi idioma es español", ["es"])).toBe(false);
    expect(ins("sei uno scemo", ["it"])).toBe(true);
    expect(ins("seu otário", ["pt"])).toBe(true);
  });
});
