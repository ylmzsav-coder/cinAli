import { describe, expect, it } from "vitest";
import { FAMOUS_SEVENS, SEVEN_GROUPS } from "../src/sevens";

describe("Ünlü 7'liler", () => {
  it("her kartın Türkçe ve İngilizce metni, bilinen bir konusu var", () => {
    for (const s of FAMOUS_SEVENS) {
      expect(SEVEN_GROUPS[s.group]).toBeTruthy();
      expect(s.tr.title && s.tr.items && s.en.title && s.en.items).toBeTruthy();
    }
  });
  it("sayılan listeler gerçekten yedi öğe", () => {
    const seven = ["7 kıta", "Gökkuşağının 7 rengi", "Haftanın 7 günü", "7 nota", "Türkiye'nin 7 coğrafi bölgesi", "Dünyanın yeni 7 harikası (2007)", "Yedi ölümcül günah"];
    for (const title of seven) {
      const s = FAMOUS_SEVENS.find((x) => x.tr.title === title)!;
      const list = s.tr.items.replace(/^[^:]*: /, "").replace(/\.$/, "");
      expect([title, list.split(",").length]).toEqual([title, 7]);
    }
  });
});
