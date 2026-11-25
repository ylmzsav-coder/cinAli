import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SPACE_WORDS, wordNumber } from "../src/strokes";

describe("Kelimelerin Kök Değeri", () => {
  it("uzay altılısı: hepsi 16 hareket, kök değeri 7", () => {
    for (const w of SPACE_WORDS) expect([w, wordNumber(w).total, wordNumber(w).root]).toEqual([w, 16, 7]);
  });
  it("Ü 5 hareket: AMPÜL 16 → 7; ELEKTİRİK 25 → 7; küçük harf Türkçe büyütülür", () => {
    expect(wordNumber("AMPÜL").total).toBe(16);
    expect(wordNumber("elektirik")).toMatchObject({ total: 25, root: 7 });
    expect(wordNumber("ışık").letters.join("")).toBe("IŞIK");
  });
  it("kayıtlı yediler listesi sözlükle güncel (npx tsx tools/kok7.ts)", () => {
    const words = readFileSync("public/dict/tr.txt", "utf8").split("\n").map((w) => w.trim()).filter(Boolean);
    const want = words.filter((w) => wordNumber(w).root === 7);
    const [head, ...saved] = readFileSync("public/dict/kok7-tr.txt", "utf8").split("\n").filter(Boolean);
    expect(head).toBe(`# ${words.length}`);
    expect(saved.length).toBe(want.length);
    expect(saved).toEqual(want);
    for (const w of SPACE_WORDS) expect(saved).toContain(w);
  });
});
