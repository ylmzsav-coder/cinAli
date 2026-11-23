import { describe, expect, it } from "vitest";
import { illegalCategory } from "../functions/src/illegal";

describe("yasa dışı içerik filtresi", () => {
  it("uyuşturucu, silah, kumar ve satış yakalanır", () => {
    const bad: [string, string][] = [
      ["kokain var mı", "drugs"], ["K.O.K.A.İ.N", "drugs"], ["k0ka1n lazım", "drugs"], ["bonzai satıyorum", "drugs"],
      ["esrar satan var mı", "drugs"], ["uyuşturucu", "drugs"], ["who has weed", "drugs"], ["ecstasy pills", "drugs"],
      ["ruhsatsız tabanca", "weapons"], ["kalaşnikof", "weapons"], ["gun for sale", "weapons"],
      ["kaçak bahis sitesi", "gambling"], ["casino linki", "gambling"], ["kumar oynayalım", "gambling"],
      ["satılık hesap", "selling"], ["satıyorum ucuz", "selling"], ["je vends", "selling"],
    ];
    for (const [txt, cat] of bad) expect([txt, illegalCategory(txt)]).toEqual([txt, cat]);
  });
  it("iletişim ve ödeme bilgisi yakalanır", () => {
    for (const txt of ["0532 123 45 67", "+90 532-123-4567", "TR12 0006 1000 0000 1234 5678 90", "telegramdan yaz", "whatsapp at",
      "iban ver", "papara ile", "@ali_123 ekle", "t.me/abc", "wp den yaz", "dm at"]) expect([txt, illegalCategory(txt)]).toEqual([txt, "contact"]);
  });
  it("masum oyun sohbeti engellenmez", () => {
    for (const txt of ["merhaba, iyi oyunlar", "çok esrarengiz bir hamle", "bu konu bahis konusu değil", "instant win!", "harika oyun",
      "satranç da oynar mısın", "kalem kitap", "üzüldüm kaybettim", "tebrikler 101 açtın", "I bet you win", "market satıcısı gibi",
      "signal is weak", "2. eli kazandım", "skor 150", "drugstore"]) {
      expect([txt, illegalCategory(txt)]).toEqual([txt, null]);
    }
  });
});
