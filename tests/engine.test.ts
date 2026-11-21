import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { botStep } from "../src/game/bot";
import { Dictionary } from "../src/game/dictionary";
import { setGameLang } from "../src/game/lang";
import {
  GameError,
  GameState,
  RULES,
  colorWinOf,
  dealHand,
  discardTile,
  drawFromDeck,
  extendWord,
  jokerOptions,
  newGame,
  openHand,
  totals,
} from "../src/game/engine";
import { Tile, createTileSet, wordValue } from "../src/game/tiles";

setGameLang("tr");
const dict = Dictionary.fromText(readFileSync("public/dict/tr.txt", "utf-8"));

function rig(state: GameState, rack: Tile[]): GameState {
  const s = structuredClone(state);
  s.players[s.current].rack = rack;
  return s;
}

function expectErr(fn: () => unknown, code: string, params?: Record<string, unknown>) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(GameError);
    expect((e as GameError).code).toBe(code);
    if (params) expect((e as GameError).params).toMatchObject(params);
    return;
  }
  throw new Error(`${code} bekleniyordu, hata atılmadı`);
}

let nextId = 1000;
const t = (letter: Tile["letter"], color: Tile["color"] = "siyah"): Tile => ({ id: nextId++, letter, color });
const tiles = (word: string, color: Tile["color"] = "siyah") => [...word].map((l) => t(l as Tile["letter"], color));

describe("taş seti", () => {
  it("94 harf + 2 joker; A ve E her renkten birer tane; renkler dengeli", () => {
    const set = createTileSet();
    expect(set.length).toBe(96);
    for (const l of ["A", "E"]) {
      const colors = set.filter((x) => x.letter === l).map((x) => x.color).sort();
      expect(colors).toEqual(["kirmizi", "mavi", "sari", "siyah"]);
    }
    const perColor = ["kirmizi", "mavi", "sari", "siyah"].map((c) => set.filter((x) => x.letter && x.color === c).length);
    expect(Math.max(...perColor) - Math.min(...perColor)).toBeLessThanOrEqual(1);
  });
  it("harf değerleri alfabe sırası", () => {
    expect(wordValue("KALEM")).toBe(52);
    expect(wordValue("ÇAY")).toBe(33);
  });
});

describe("kurallar", () => {
  const base = newGame(["Sen", "B1", "B2", "B3"], [false, true, true, true], 3, 42);

  it("başlayan 15, diğerleri 14 taş alır", () => {
    expect(base.players.map((p) => p.rack.length).sort()).toEqual([14, 14, 14, 15]);
    expect(base.deck.length).toBe(96 - 57);
  });

  it("101 altında açılmaz", () => {
    const rack = [...tiles("KALEM"), t("A"), t("B")];
    const s = rig(base, rack);
    expectErr(() => openHand(dict, s, [{ tileIds: rack.slice(0, 5).map((x) => x.id) }]), "openNeeds", { need: 101, total: 52 });
    // KALEM + ÇAY = 85: eskiden açardı, artık yetmez
    const kalem = tiles("KALEM");
    const cay = tiles("ÇAY");
    const s2 = rig(base, [...kalem, ...cay, t("B")]);
    expectErr(
      () => openHand(dict, s2, [{ tileIds: kalem.map((x) => x.id) }, { tileIds: cay.map((x) => x.id) }]),
      "openNeeds",
      { need: 101, total: 85 },
    );
  });

  it("101 ve üstü ile açılır, sözlükte olmayan reddedilir", () => {
    const kalem = tiles("KALEM");
    const cay = tiles("ÇAY");
    const tuz = tiles("TUZ");
    const rest = [t("B")];
    const s = rig(base, [...kalem, ...cay, ...tuz, ...rest]);
    const opened = openHand(dict, s, [{ tileIds: kalem.map((x) => x.id) }, { tileIds: cay.map((x) => x.id) }, { tileIds: tuz.map((x) => x.id) }]);
    expect(opened.players[s.current].opened).toBe(true);
    expect(opened.table.length).toBe(3);
    const bad = tiles("KLAEM");
    expectErr(() => openHand(dict, rig(base, [...bad, ...cay, t("B")]), [{ tileIds: bad.map((x) => x.id) }]), "notInDict", { word: "KLAEM" });
  });

  it("joker seçenekleri bulunur", () => {
    const opts = jokerOptions(dict, ["K", "A", null, "E", "M"]);
    expect(opts.map((o) => o.join(""))).toContain("L");
  });

  it("işleme: kelimenin sonuna harf eklenir", () => {
    const kalem = tiles("KALEM");
    const cay = tiles("ÇAY");
    const tuz = tiles("TUZ");
    const ci = tiles("CI");
    const s = rig(base, [...kalem, ...cay, ...tuz, ...ci, t("B")]);
    let o = openHand(dict, s, [{ tileIds: kalem.map((x) => x.id) }, { tileIds: cay.map((x) => x.id) }, { tileIds: tuz.map((x) => x.id) }]);
    const cayWord = o.table[1];
    expectErr(() => extendWord(dict, o, cayWord.id, "end", { tileIds: [ci[0].id] }), "notInDict", { word: "ÇAYC" });
    o = extendWord(dict, o, cayWord.id, "end", { tileIds: ci.map((x) => x.id) });
    expect(o.table[1].tiles.map((x) => x.letter).join("")).toBe("ÇAYCI");
  });

  it("son taşı atan biter; tek renk ise Renk Bitirme -200", () => {
    const kalem = tiles("KALEM");
    const cay = tiles("ÇAY");
    const tuz = tiles("TUZ");
    const last = t("B", "kirmizi");
    const s = rig(base, [...kalem, ...cay, ...tuz, last]);
    let o = openHand(dict, s, [{ tileIds: kalem.map((x) => x.id) }, { tileIds: cay.map((x) => x.id) }, { tileIds: tuz.map((x) => x.id) }]);
    expect(colorWinOf(o.players[o.current])).toBe("siyah");
    o = discardTile(o, last.id);
    expect(o.lastResult?.winner).toBe(s.current);
    expect(o.lastResult?.colorWin).toBe("siyah");
    expect(o.lastResult?.scores[s.current]).toBe(RULES.colorWinScore);
    // diğerleri el açmadı -> 200
    o.lastResult!.scores.forEach((sc, i) => i !== s.current && expect(sc).toBe(RULES.unopenedPenalty));
  });

  it("karışık renk normal bitiş -100", () => {
    const kalem = [...tiles("KAL"), ...tiles("EM", "mavi")];
    const cay = tiles("ÇAY");
    const tuz = tiles("TUZ");
    const last = t("B");
    const s = rig(base, [...kalem, ...cay, ...tuz, last]);
    let o = openHand(dict, s, [{ tileIds: kalem.map((x) => x.id) }, { tileIds: cay.map((x) => x.id) }, { tileIds: tuz.map((x) => x.id) }]);
    o = discardTile(o, last.id);
    expect(o.lastResult?.colorWin).toBe(null);
    expect(o.lastResult?.scores[s.current]).toBe(RULES.winScore);
  });

  it("çekmeden atılamaz", () => {
    let o = discardTile(base, base.players[base.current].rack[0].id);
    expect(o.phase).toBe("draw");
    expect(() => discardTile(o, o.players[o.current].rack[0].id)).toThrow();
    o = drawFromDeck(o);
    expect(o.phase).toBe("play");
  });
});

describe("bot simülasyonu", () => {
  it("4 bot oyunu tamamlar", () => {
    let wins = 0, colorWins = 0, hands = 0, discards = 0;
    for (let seed = 1; seed <= 6; seed++) {
      let s = newGame(["A", "B", "C", "D"], [true, true, true, true], 3, seed);
      let steps = 0;
      while (s.phase !== "gameOver") {
        if (s.phase === "handOver") {
          hands++;
          if (s.lastResult?.winner !== null) wins++;
          if (s.lastResult?.colorWin) colorWins++;
          s = dealHand(s);
          continue;
        }
        const before = s.current;
        s = botStep(dict, s);
        if (s.current !== before) discards++;
        if (++steps > 5000) throw new Error("sonsuz döngü");
      }
      hands++;
      if (s.lastResult?.winner !== null) wins++;
      expect(totals(s).length).toBe(4);
    }
    console.log(`eller: ${hands}, bitirilen: ${wins}, renk: ${colorWins}, el başına ortalama tur: ${(discards / hands / 4).toFixed(1)}`);
    expect(wins).toBeGreaterThan(0);
  }, 120000);
});

import { TABLES, payout, winnerPrize } from "../src/economy/tables";
describe("çip ödemesi", () => {
  const t = TABLES[0]; // Çaylak, giriş 500
  it("birinci potun %90'ını alır", () => {
    expect(winnerPrize(t)).toBe(1800);
    expect(payout(t, [-100, 50, 200, 30], 0, 0)).toBe(1800);
  });
  it("birinci değilse 0, eşitlikte paylaşılır", () => {
    expect(payout(t, [10, -100, 200, 30], 0, 0)).toBe(0);
    expect(payout(t, [-100, -100, 200, 30], 0, 0)).toBe(900);
  });
  it("Renk Bitirme ikramiyesi giriş ücreti kadar", () => {
    expect(payout(t, [-200, 50, 200, 30], 0, 1)).toBe(1800 + 500);
    expect(payout(t, [100, -200, 50, 30], 0, 0)).toBe(0);
  });
});
