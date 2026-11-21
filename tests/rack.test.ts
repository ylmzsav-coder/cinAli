import { describe, expect, it } from "vitest";
import { RACK_COLS, RACK_SLOTS, groupsOf, initialSlots, moveTile, syncSlots } from "../src/ui/rack";

describe("okey ıstakası", () => {
  it("32 yuva; yeni el üst sıradan dizilir", () => {
    const s = initialSlots([1, 2, 3]);
    expect(s.length).toBe(RACK_SLOTS);
    expect(s.slice(0, 4)).toEqual([1, 2, 3, null]);
  });
  it("boşluklar grupları ayırır; sıra sonu da ayırır", () => {
    const s = initialSlots([]);
    [1, 2, 3].forEach((id, i) => (s[i] = id));
    [4, 5].forEach((id, i) => (s[6 + i] = id)); // 3 boşluk sonra
    s[RACK_COLS - 1] = 6; // üst sıranın son yuvası
    s[RACK_COLS] = 7; // alt sıranın ilk yuvası: ayrı grup
    expect(groupsOf(s).map((g) => g.ids)).toEqual([[1, 2, 3], [4, 5], [6], [7]]);
  });
  it("taş boş yuvaya taşınır, dolu yuvayla yer değiştirir", () => {
    let s = initialSlots([1, 2, 3]);
    s = moveTile(s, 1, 10);
    expect(s[0]).toBe(null);
    expect(s[10]).toBe(1);
    s = moveTile(s, 2, 10);
    expect(s[10]).toBe(2);
    expect(s[1]).toBe(1);
  });
  it("çekilen taş bırakılan yuvaya, yoksa alt sıranın en sağına konur; giden taş kalkar", () => {
    let s = initialSlots([1, 2, 3]);
    s = syncSlots(s, [1, 2, 3, 9], 20);
    expect(s[20]).toBe(9);
    s = syncSlots(s, [1, 2, 3, 9, 10]);
    expect(s[RACK_SLOTS - 1]).toBe(10);
    s = syncSlots(s, [1, 3, 9, 10]);
    expect(s.includes(2)).toBe(false);
    expect(s[1]).toBe(null); // yerinde boşluk kalır
  });
});

import { arrangeWords } from "../src/ui/rack";
describe("otomatik per dizimi", () => {
  it("kelimeler ayrı gruplar, kalan taşlar ayrı", () => {
    const s = arrangeWords([[1, 2, 3, 4, 5], [6, 7, 8], [9, 10, 11]], [12, 13]);
    const groups = groupsOf(s).map((g) => g.ids);
    expect(groups).toContainEqual([1, 2, 3, 4, 5]);
    expect(groups).toContainEqual([6, 7, 8]);
    expect(groups).toContainEqual([9, 10, 11]);
    // kalan taşlar hiçbir kelimeye yapışmaz
    for (const g of groups) if (g.includes(12) || g.includes(13)) expect(g.every((x) => x >= 12)).toBe(true);
  });
  it("uzun kelimeler alt sıraya taşar", () => {
    const a = Array.from({ length: 9 }, (_, i) => i + 1);
    const b = Array.from({ length: 6 }, (_, i) => i + 20);
    const s = arrangeWords([a, b], []);
    expect(groupsOf(s).map((g) => g.ids)).toEqual([a, b]);
  });
});
