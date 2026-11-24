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
  GAME_HANDS,
  gameWinners,
  openHand,
  openPairs,
  rackValue,
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
  it("Türkçe: 104 harf + 2 joker = 106 taş; A 7, E 5, I 4, İ 6, O 3, N 5 adet; renkler dengeli", () => {
    const set = createTileSet();
    expect(set.length).toBe(106);
    expect(set.filter((x) => x.letter === null).length).toBe(2);
    for (const [l, n] of [["A", 7], ["E", 5]] as const) {
      const tilesOf = set.filter((x) => x.letter === l);
      expect(tilesOf.length).toBe(n);
      expect(new Set(tilesOf.map((x) => x.color)).size).toBe(4);
    }
    const count = (l: string) => set.filter((x) => x.letter === l).length;
    expect([count("İ"), count("K"), count("O"), count("T")]).toEqual([6, 8, 3, 6]);
    expect(count("I")).toBe(4);
    const vowels = [..."AEIİOÖUÜ"].reduce((n, l) => n + count(l), 0);
    expect(vowels).toBe(31); // A 7, E 5, I 4, İ 6, O 3, Ö 1, U 3, Ü 2
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
    expect(base.deck.length).toBe(106 - 57);
  });

  it("101 altında açılmaz, 101 ve üstü açılır", () => {
    const kalem = tiles("KALEM");
    const cay = tiles("ÇAY");
    // KALEM + ÇAY = 85: yetmez
    const s = rig(base, [...kalem, ...cay, t("B")]);
    expectErr(
      () => openHand(dict, s, [{ tileIds: kalem.map((x) => x.id) }, { tileIds: cay.map((x) => x.id) }]),
      "openNeeds",
      { need: 101, total: 85 },
    );
    // KALEM + ÇAY + TUZ = 155: açar
    const tuz = tiles("TUZ");
    const s2 = rig(base, [...kalem, ...cay, ...tuz, t("B")]);
    const o = openHand(dict, s2, [kalem, cay, tuz].map((w) => ({ tileIds: w.map((x) => x.id) })));
    expect(o.players[s2.current].opened).toBe(true);
  });

  it("çok kelimeyle açılır, sözlükte olmayan reddedilir", () => {
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
    // Açtığı kelimeler + eklediği harfler oyuncunun hanesine yazılır
    expect(o.players[s.current].points).toBe(wordValue("KALEM") + wordValue("ÇAY") + wordValue("TUZ") + wordValue("CI"));
  });

  it("başkasının kelimesine eklenen harfin değeri ekleyenin hanesine yazılır", () => {
    const kalem = tiles("KALEM"), cay = tiles("ÇAY"), tuz = tiles("TUZ");
    const s = rig(base, [...kalem, ...cay, ...tuz, t("B")]);
    const o = openHand(dict, s, [kalem, cay, tuz].map((w) => ({ tileIds: w.map((x) => x.id) })));
    const owner = s.current;
    // Sırayı ikinci oyuncuya ver: açmış sayılır, ÇAY kelimesine CI ekler
    const o2 = structuredClone(o);
    const other = (owner + 1) % 4;
    o2.current = other;
    o2.phase = "play";
    o2.turnPlays = 0;
    o2.players[other].opened = true;
    const ci = tiles("CI");
    o2.players[other].rack = [...ci, t("B")];
    const o3 = extendWord(dict, o2, o2.table[1].id, "end", { tileIds: ci.map((x) => x.id) });
    expect(o3.players[other].points).toBe(wordValue("CI"));
    expect(o3.players[owner].points).toBe(wordValue("KALEM") + wordValue("ÇAY") + wordValue("TUZ"));
  });

  it("elde kalan okey taşı en yüksek harf (Z = 29) kadar eksi", () => {
    const p = { ...base.players[0], rack: [t("A"), { id: 999, letter: null, color: "kirmizi" } as Tile] };
    expect(rackValue(p)).toBe(1 + 29);
  });

  it("oyun tek el: ilk bitiren olunca oyun biter, kazanan en yüksek puan (bitiren değil)", () => {
    const g = newGame(["Sen", "B1", "B2", "B3"], [false, true, true, true], GAME_HANDS, 3);
    const me = g.current;
    const other = (me + 1) % 4;
    // Diğer oyuncu yere çok puan açmış, siz az puanla bitiriyorsunuz
    g.players[other].opened = true;
    g.players[other].points = 300;
    g.players[other].rack = [t("A")];
    const kalem = tiles("KALEM"), cay = tiles("ÇAY"), tuz = tiles("TUZ"), last = t("B");
    let o = rig(g, [...kalem, ...cay, ...tuz, last]);
    o = openHand(dict, o, [kalem, cay, tuz].map((w) => ({ tileIds: w.map((x) => x.id) })));
    o = discardTile(o, last.id);
    expect(o.phase).toBe("gameOver");
    expect(o.lastResult?.winner).toBe(me);
    expect(o.lastResult?.scores[other]).toBe(300 - 1);
    expect(gameWinners(o)).toEqual([other]);
  });

  it("en çok puanı toplayan oyunu kazanır", () => {
    const g = structuredClone(base);
    g.history = [[174 - 40, 100 + 120, -30, 0], [50, 10, 300, -5]];
    expect(totals(g)).toEqual([184, 230, 270, -5]);
    expect(gameWinners(g)).toEqual([2]);
  });

  it("son taşı atan biter; Renk Bitirme algılanır; puan açtığı kadar, diğerleri elde kalanı eksi alır", () => {
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
    const laid = wordValue("KALEM") + wordValue("ÇAY") + wordValue("TUZ");
    expect(o.lastResult?.scores[s.current]).toBe(laid + RULES.colorWinBonus);
    // diğerleri hiç açmadı: yalnızca elde kalan harflerin değeri eksi (okey 0)
    o.lastResult!.scores.forEach((sc, i) => i !== s.current && expect(sc).toBe(-rackValue(o.players[i])));
  });

  it("karışık renk normal bitiş: puan yalnızca açtığı kadar", () => {
    const kalem = [...tiles("KAL"), ...tiles("EM", "mavi")];
    const cay = tiles("ÇAY");
    const tuz = tiles("TUZ");
    const last = t("B");
    const s = rig(base, [...kalem, ...cay, ...tuz, last]);
    let o = openHand(dict, s, [{ tileIds: kalem.map((x) => x.id) }, { tileIds: cay.map((x) => x.id) }, { tileIds: tuz.map((x) => x.id) }]);
    o = discardTile(o, last.id);
    expect(o.lastResult?.colorWin).toBe(null);
    expect(o.lastResult?.scores[s.current]).toBe(wordValue("KALEM") + wordValue("ÇAY") + wordValue("TUZ") + RULES.winBonus);
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

import { TABLES, payout, tableById, winnerPrize } from "../src/economy/tables";
describe("çip ödemesi (en yüksek toplam birinci)", () => {
  const t = TABLES[0]; // Çayhane: giriş 100, birinciye 400
  it("giriş 100, birinci 300 çip alır", () => {
    expect(TABLES.filter((x) => !x.vip).map((x) => x.id)).toEqual(["caylak", "usta", "usta2", "usta5", "ozel2", "ozel2u", "ozel2b"]);
    const ozel = TABLES.find((x) => x.id === "ozel2")!;
    expect([ozel.players, ozel.entry, winnerPrize(ozel)]).toEqual([2, 100, 200]);
    const usta = TABLES.find((x) => x.id === "usta")!;
    expect([usta.entry, winnerPrize(usta)]).toEqual([100, 400]);
    expect(payout(usta, [80, 120, 120, 40], 1, 0)).toBe(200);
    const s2 = TABLES.find((x) => x.id === "usta2")!, s5 = TABLES.find((x) => x.id === "usta5")!;
    expect([s2.entry, winnerPrize(s2), s2.players ?? 4]).toEqual([1000, 4000, 4]);
    expect([s5.entry, winnerPrize(s5), s5.players ?? 4]).toEqual([10000, 40000, 4]);
    const vip = TABLES.find((x) => x.vip)!;
    expect(vip.players).toBe(2);
    expect(vip.entry).toBe(100);
    expect(winnerPrize(vip)).toBe(200);
    expect(t.entry).toBe(100);
    expect(winnerPrize(t)).toBe(400);
    expect(payout(t, [300, 50, 200, 30], 0, 0)).toBe(400);
  });
  it("birinci değilse 0, eşitlikte paylaşılır", () => {
    expect(payout(t, [10, -100, 200, 30], 0, 0)).toBe(0);
    expect(payout(t, [250, 250, 200, 30], 0, 0)).toBe(200);
    // Üç kişi berabere: 400 / 3 = 133'er çip
    expect(payout(t, [250, 250, 250, 30], 2, 0)).toBe(133);
  });
  it("Renk Bitirme ikramiyesi giriş ücreti kadar", () => {
    expect(payout(t, [400, 50, 200, 30], 0, 1)).toBe(400 + 100);
    expect(payout(t, [100, 400, 50, 30], 0, 0)).toBe(0);
  });
});

import { timeoutMove } from "../src/game/engine";
describe("hamle süresi", () => {
  const base = newGame(["Sen", "B1", "B2", "B3"], [false, true, true, true], 3, 7);
  it("çekme aşamasında süre dolarsa desteden çeker ve çektiği taşı atar", () => {
    let s = discardTile(base, base.players[base.current].rack[0].id); // sıra sonraki oyuncuya geçer
    const who = s.current;
    const before = s.players[who].rack.length;
    const top = s.deck[s.deck.length - 1];
    s = timeoutMove(s);
    expect(s.players[who].rack.length).toBe(before);
    if (top.letter !== null) expect(s.discards[who].at(-1)!.id).toBe(top.id);
    expect(s.current).not.toBe(who);
    expect(s.log.some((l) => l.k === "timeout")).toBe(true);
  });
  it("korunan taşlara ve jokere dokunmaz", () => {
    const rack = [...tiles("KAL"), t(null), t("M")];
    const s = rig(base, rack);
    // son taş (M) korunuyorsa ve joker sonda değilse ilk serbest harf atılır
    const o = timeoutMove(s, [rack[4].id, rack[0].id]);
    expect(o.discards[s.current].at(-1)!.letter).toBe("A");
  });
});

import { bestArrangement } from "../src/game/bot";
describe("otomatik per", () => {
  it("ıstakadan çakışmayan en değerli kelimeleri bulur", () => {
    const rack = [...tiles("KALEMÇAYTUZ"), t("B")];
    const res = bestArrangement(dict, rack);
    const used = res.flatMap((r) => r.spec.tileIds);
    expect(new Set(used).size).toBe(used.length); // taş iki kelimede yok
    for (const r of res) expect(dict.has(r.word)).toBe(true);
    const total = res.reduce((s, r) => s + wordValue(r.word), 0);
    expect(total).toBeGreaterThanOrEqual(163); // en az KALEM+ÇAY+TUZ kadar
  });
});

import { layPair, layWord, openPairs } from "../src/game/engine";
describe("çifte gitme kaldırıldı", () => {
  it("çiftle açmak reddedilir", () => {
    const s = newGame(["A", "B", "C", "D"], [false, true, true, true], 1, 3);
    expect(() => openPairs(s, [])).toThrow(GameError);
  });
});

// Çifte gitme oyundan kaldırıldı; eski kural testleri ileride açılırsa diye duruyor.
describe.skip("çifte gitme", () => {
  const start = (() => {
    const g = newGame(["A", "B", "C", "D"], [false, true, true, true], 1, 7);
    return { ...g, phase: "play" as const };
  })();
  const pairIds = (ts: Tile[]) => [{ tileIds: [ts[0].id, ts[1].id] }];

  it("5 çiftle (değer şartı olmadan) açılır; joker çift tamamlar", () => {
    const ps = [tiles("AA"), tiles("SS", "mavi"), tiles("FF"), tiles("BB", "sari"), [t("K"), t(null)]];
    const keep = t("E");
    const s = rig(start, [...ps.flat(), keep]);
    expectErr(() => openPairs(s, ps.slice(0, 4).flatMap(pairIds)), "pairsNeed", { need: 5, n: 4 });
    const o = openPairs(s, ps.flatMap(pairIds));
    expect(o.players[s.current].pairs).toBe(true);
    expect(o.table.every((w) => w.pair)).toBe(true);
    expect(o.table[4].tiles.map((x) => x.letter).join("")).toBe("KK");
  });

  it("farklı harfler çift değildir", () => {
    const s = rig(start, [...tiles("AB"), ...tiles("CCDDEEFF"), t("Z")]);
    const r = s.players[s.current].rack;
    expectErr(() => openPairs(s, [0, 2, 4, 6, 8].map((i) => ({ tileIds: [r[i].id, r[i + 1].id] }))), "notAPair");
  });

  it("çifte giden kelime koyamaz, işleyemez; çifti kimse işleyemez", () => {
    const ps = [tiles("AA"), tiles("SS"), tiles("FF"), tiles("BB"), tiles("KK")];
    const more = tiles("ÇAY");
    const pp = tiles("ZZ");
    const s = rig(start, [...ps.flat(), ...more, ...pp, t("E")]);
    let o = openPairs(s, ps.flatMap(pairIds));
    expectErr(() => layWord(dict, o, { tileIds: more.map((x) => x.id) }), "pairsOnly");
    expectErr(() => extendWord(dict, o, o.table[0].id, "end", { tileIds: [more[0].id] }), "pairsNoExtend");
    o = layPair(o, { tileIds: pp.map((x) => x.id) });
    expect(o.table.length).toBe(6);
  });

  it("çiftle bitiren: çiftlerin değeri kadar puan", () => {
    for (const [mixed, bonus] of [[true, RULES.pairWinBonus], [false, RULES.pairColorWinBonus]] as const) {
      const ps = [tiles("AA"), tiles("SS"), tiles("FF"), tiles("BB"), tiles("KK", mixed ? "mavi" : "siyah"), tiles("LL"), tiles("MM")];
      const last = t("E", "kirmizi");
      const s = rig(start, [...ps.flat(), last]);
      let o = openPairs(s, ps.flatMap(pairIds));
      o = discardTile(o, last.id);
      expect(o.lastResult?.winner).toBe(s.current);
      expect(o.lastResult?.pairWin).toBe(true);
      expect(o.lastResult?.scores[s.current]).toBe(wordValue("AASSFFBBKKLLMM") + bonus);
    }
  });

  it("kelimeyle açan çift koyamaz", () => {
    const kalem = tiles("KALEM"), cay = tiles("ÇAY"), tuz = tiles("TUZ"), pp = tiles("ZZ");
    const s = rig(start, [...kalem, ...cay, ...tuz, ...pp, t("B")]);
    const o = openHand(dict, s, [kalem, cay, tuz].map((w) => ({ tileIds: w.map((x) => x.id) })));
    expectErr(() => layPair(o, { tileIds: pp.map((x) => x.id) }), "notPairPlayer");
  });
});

describe("Türkçe sözlük", () => {
  it("fiil kökleri (emir kipi) geçerli kelimedir: TUT, GİT, OKU", () => {
    for (const w of ["TUT", "GİT", "OKU", "GEL", "TUTMAK", "PER", "ÖĞE", "ABİ", "OTO", "ISTAKA", "YAZBOZ", "KOALA", "SUDOKU", "YAPMAZ", "OKUMAZ", "MAZOT", "LAZ", "TÜRKÇE", "ZIR"]) expect(dict.has(w), w).toBe(true);
  });
});

describe("Türkçe sözlükte küfür yok", () => {
  it("küfür listesindeki kelimeler oynanamaz, masum benzerleri oynanır", () => {
    for (const w of ["OROSPU", "SİKMEK", "PİÇ", "GÖT", "KAHPE", "ŞEREFSİZ", "PORNO", "SEKS", "BOK"]) expect(dict.has(w), w).toBe(false);
    for (const w of ["GÖTÜRMEK", "SİKKE", "MUSİKİ", "PSİKİYATRİ", "SEKSEN", "BOKS", "SIÇRAMAK"]) expect(dict.has(w), w).toBe(true);
  });
});

import { WELCOME_CHIPS, WELCOME_GAMES } from "../src/economy/config";
describe("hoş geldin hediyesi", () => {
  it("999 çip = Çayhane'de 9 oyunluk çip", () => {
    expect(WELCOME_CHIPS).toBe(999);
    expect(WELCOME_GAMES).toBe(9);
    expect(Math.floor(WELCOME_CHIPS / TABLES[0].entry)).toBe(WELCOME_GAMES);
  });
});

describe("bilgisayar el açmayı geciktirir", () => {
  it("orta seviye bilgisayar 4. turdan önce elini açmaz", () => {
    for (let seed = 1; seed <= 5; seed++) {
      let s = newGame(["A", "B", "C", "D"], [true, true, true, true], 1, seed);
      let thrown = 0;
      while (s.phase === "draw" || s.phase === "play") {
        const before = s.current;
        s = botStep(dict, s, "orta");
        if (s.current !== before) thrown++;
        if (thrown >= 12) break; // ilk 3 tur
        expect(s.players.every((p) => !p.opened), `seed ${seed}`).toBe(true);
      }
    }
  });
});

import { layWord } from "../src/game/engine";
describe("iki harfli kelimeler", () => {
  const base = newGame(["Sen", "B1", "B2", "B3"], [false, true, true, true], 3, 11);
  it("Türkçede yalnızca listedeki iki harfli kelimeler geçerli", () => {
    // Türkçede yalnızca oyun sahibinin listesi geçerli
    for (const w of ["AK", "EL", "ON", "İZ", "AĞ", "ÖZ", "ÖN", "ÜÇ", "BU", "UN", "UZ", "UR"]) expect(dict.has(w), w).toBe(true);
    for (const w of ["KA", "LE", "Lİ", "ÇE", "ZÖ", "AE", "KL", "AA", "K"]) expect(dict.has(w), w).toBe(false);
  });
  it("açmış oyuncu iki harfli kelime koyabilir; tek harf koyamaz", () => {
    const kalem = tiles("KALEM"), cay = tiles("ÇAY"), tuz = tiles("TUZ"), ek = tiles("EK"), b = t("B");
    const s = rig(base, [...kalem, ...cay, ...tuz, ...ek, b, t("Z")]);
    let o = openHand(dict, s, [kalem, cay, tuz].map((w) => ({ tileIds: w.map((x) => x.id) })));
    o = layWord(dict, o, { tileIds: ek.map((x) => x.id) });
    expect(o.table.at(-1)?.tiles.map((x) => x.letter).join("")).toBe("EK");
    expectErr(() => layWord(dict, o, { tileIds: [b.id] }), "minLength", { n: 2 });
  });
  it("Sosyete (en az 3 harf): iki harfli kelime ne açılışta ne sonra geçerli", () => {
    // İki harfli kelime yalnızca Çayhane (ve masasız Pratik) oyununda geçerli
    expect(TABLES.filter((x) => x.minWord === 3).map((x) => x.id)).toEqual(["usta", "usta2", "usta5", "ozel2", "ozel2u", "ozel2b", "vip2"]);
    expect(TABLES.filter((x) => !x.minWord).map((x) => x.id)).toEqual(["caylak"]);
    for (const id of ["vip2m", "vip2u"]) expect(tableById(id)?.minWord, id).toBe(3);
    const pro = { ...base, minWord: 3 };
    const kalem = tiles("KALEM"), cay = tiles("ÇAY"), tuz = tiles("TUZ"), ek = tiles("EK"), at = tiles("AT"), b = t("B");
    const s = rig(pro, [...kalem, ...cay, ...tuz, ...ek, ...at, b]);
    expectErr(() => openHand(dict, s, [kalem, cay, tuz, ek].map((w) => ({ tileIds: w.map((x) => x.id) }))), "minLength", { n: 3 });
    const o = openHand(dict, s, [kalem, cay, tuz].map((w) => ({ tileIds: w.map((x) => x.id) })));
    expectErr(() => layWord(dict, o, { tileIds: at.map((x) => x.id) }), "minLength", { n: 3 });
    expect(newGame(["A", "B"], [false, true], 1, 3, 3).minWord).toBe(3);
    expect(newGame(["A", "B"], [false, true], 1, 3).minWord).toBeUndefined();
  });
  it("Sosyete: 3 harfli kelimelerle açılır, 3 harfli kelime koyulur ve işlenir", () => {
    const pro = { ...base, minWord: 3 };
    const sut = tiles("SÜT"), tuz = tiles("TUZ"), kar = tiles("KAR"), kus = tiles("KUŞ"), a = t("A"), z = t("Z");
    const s = rig(pro, [...sut, ...tuz, ...kar, ...kus, a, z]);
    // Yalnızca 3 harfli kelimelerle açılış (SÜT 72 + TUZ 78 = 150 ≥ 101)
    let o = openHand(dict, s, [sut, tuz].map((w) => ({ tileIds: w.map((x) => x.id) })));
    expect(o.players[o.current].opened).toBe(true);
    expect(o.table.map((w) => w.tiles.map((x) => x.letter).join(""))).toEqual(["SÜT", "TUZ"]);
    // Açtıktan sonra 3 harfli kelime koyma
    o = layWord(dict, o, { tileIds: kar.map((x) => x.id) });
    o = layWord(dict, o, { tileIds: kus.map((x) => x.id) });
    expect(o.table.at(-1)?.tiles.map((x) => x.letter).join("")).toBe("KUŞ");
    // 3 harfli kelimeye işleme: KAR → KARA
    const karId = o.table.find((w) => w.tiles.map((x) => x.letter).join("") === "KAR")!.id;
    o = extendWord(dict, o, karId, "end", { tileIds: [a.id] });
    expect(o.table.find((w) => w.id === karId)!.tiles.map((x) => x.letter).join("")).toBe("KARA");
    // Tek başına 3 harfli ama sözlükte olmayan kelime yine reddedilir
    const zkt = tiles("ZKT"), sut2 = tiles("SÜT"), tuz2 = tiles("TUZ");
    const o2 = openHand(dict, rig(pro, [...zkt, ...sut2, ...tuz2, z]), [sut2, tuz2].map((w) => ({ tileIds: w.map((x) => x.id) })));
    expectErr(() => layWord(dict, o2, { tileIds: zkt.map((x) => x.id) }), "notInDict", { word: "ZKT" });
  });
  it("Sosyete: 4 harfli kelimelerle açılır, 4 harfli kelime koyulur ve işlenir", () => {
    const pro = { ...base, minWord: 3 };
    const kuzu = tiles("KUZU"), arzu = tiles("ARZU"), elma = tiles("ELMA"), kale = tiles("KALE"), m = t("M"), kzal = tiles("KZAL"), z = t("Z");
    const s = rig(pro, [...kuzu, ...arzu, ...elma, ...kale, m, ...kzal, z]);
    // Yalnızca 4 harfli kelimelerle açılış (KUZU 93 + ARZU 76 = 169 ≥ 101)
    let o = openHand(dict, s, [kuzu, arzu].map((w) => ({ tileIds: w.map((x) => x.id) })));
    expect(o.table.map((w) => w.tiles.map((x) => x.letter).join(""))).toEqual(["KUZU", "ARZU"]);
    // Tek 4 harfli kelime eşiğe yetmezse açılmaz (ELMA 38)
    expectErr(() => openHand(dict, s, [{ tileIds: elma.map((x) => x.id) }]), "openNeeds", { need: 101, total: 38 });
    // Açtıktan sonra 4 harfli kelime koyma
    o = layWord(dict, o, { tileIds: elma.map((x) => x.id) });
    o = layWord(dict, o, { tileIds: kale.map((x) => x.id) });
    // 4 harfli kelimeye işleme: KALE → KALEM
    const kaleId = o.table.find((w) => w.tiles.map((x) => x.letter).join("") === "KALE")!.id;
    o = extendWord(dict, o, kaleId, "end", { tileIds: [m.id] });
    expect(o.table.find((w) => w.id === kaleId)!.tiles.map((x) => x.letter).join("")).toBe("KALEM");
    // Sözlükte olmayan 4 harfli dizi reddedilir
    expectErr(() => layWord(dict, o, { tileIds: kzal.map((x) => x.id) }), "notInDict", { word: "KZAL" });
  });
  it("Çayhane ve Pratik: 2, 3 ve 4 harfli kelimelerle açılır, koyulur ve işlenir", () => {
    for (const id of ["caylak", "pratik"]) {
      const cfg = TABLES.find((x) => x.id === id);
      expect(cfg?.minWord, id).toBeUndefined();
      const g = newGame(["A", "B"], [false, true], 1, 5, cfg?.minWord);
      expect(g.minWord, id).toBeUndefined();
      const st = { ...base, minWord: g.minWord };
      const ek = tiles("EK"), sut = tiles("SÜT"), kuzu = tiles("KUZU"), at = tiles("AT"), kar = tiles("KAR"), kale = tiles("KALE"), m = t("M"), a = t("A");
      const s = rig(st, [...ek, ...sut, ...kuzu, ...at, ...kar, ...kale, m, a, t("Z")]);
      // Karışık açılış: EK (2) + SÜT (3) + KUZU (4) = 185
      let o = openHand(dict, s, [ek, sut, kuzu].map((w) => ({ tileIds: w.map((x) => x.id) })));
      expect(o.table.map((w) => w.tiles.length), id).toEqual([2, 3, 4]);
      o = layWord(dict, o, { tileIds: at.map((x) => x.id) });
      o = layWord(dict, o, { tileIds: kar.map((x) => x.id) });
      o = layWord(dict, o, { tileIds: kale.map((x) => x.id) });
      expect(o.table.slice(3).map((w) => w.tiles.map((x) => x.letter).join("")), id).toEqual(["AT", "KAR", "KALE"]);
      const word = (w: string) => o.table.find((x) => x.tiles.map((y) => y.letter).join("") === w)!.id;
      o = extendWord(dict, o, word("KALE"), "end", { tileIds: [m.id] }); // 4 → 5: KALEM
      o = extendWord(dict, o, word("KAR"), "end", { tileIds: [a.id] }); // 3 → 4: KARA
      expect(o.table.map((w) => w.tiles.map((x) => x.letter).join("")).sort(), id).toEqual(["AT", "EK", "KALEM", "KARA", "KUZU", "SÜT"]);
    }
  });
  it("VIP ve Teke Tek: iki harfli kelime ne açılışta ne sonra geçerli; 3 ve 4 harfli geçerli", () => {
    for (const id of ["vip2", "ozel2", "ozel2u", "ozel2b"]) {
      const cfg = TABLES.find((x) => x.id === id)!;
      const g = newGame(["A", "B"], [false, true], 1, 5, cfg.minWord);
      expect(g.minWord, id).toBe(3);
      const st = { ...base, minWord: g.minWord };
      const ek = tiles("EK"), sut = tiles("SÜT"), kuzu = tiles("KUZU"), at = tiles("AT"), kar = tiles("KAR"), kale = tiles("KALE"), m = t("M"), a = t("A");
      const s = rig(st, [...ek, ...sut, ...kuzu, ...at, ...kar, ...kale, m, a, t("Z")]);
      expectErr(() => openHand(dict, s, [ek, sut, kuzu].map((w) => ({ tileIds: w.map((x) => x.id) }))), "minLength", { n: 3 });
      let o = openHand(dict, s, [sut, kuzu].map((w) => ({ tileIds: w.map((x) => x.id) })));
      expectErr(() => layWord(dict, o, { tileIds: at.map((x) => x.id) }), "minLength", { n: 3 });
      o = layWord(dict, o, { tileIds: kar.map((x) => x.id) });
      o = layWord(dict, o, { tileIds: kale.map((x) => x.id) });
      const word = (w: string) => o.table.find((x) => x.tiles.map((y) => y.letter).join("") === w)!.id;
      o = extendWord(dict, o, word("KALE"), "end", { tileIds: [m.id] });
      o = extendWord(dict, o, word("KAR"), "end", { tileIds: [a.id] });
      expect(o.table.map((w) => w.tiles.map((x) => x.letter).join("")).sort(), id).toEqual(["KALEM", "KARA", "KUZU", "SÜT"]);
    }
  });
  it("Sosyete: bilgisayarlar yere hiç 2 harfli kelime koymaz ve oyunlar biter", () => {
    let hands = 0, wins = 0;
    for (let seed = 1; seed <= 4; seed++) {
      let s = newGame(["A", "B", "C", "D"], [true, true, true, true], 2, seed, 3);
      let steps = 0;
      const check = () => {
        hands++;
        if (s.lastResult?.winner != null) wins++;
        for (const w of s.table) expect(w.tiles.length, `seed ${seed}`).toBeGreaterThanOrEqual(3);
      };
      while (s.phase !== "gameOver") {
        if (s.phase === "handOver") { check(); s = dealHand(s); continue; }
        s = botStep(dict, s, "orta");
        if (++steps > 8000) throw new Error("sonsuz döngü");
      }
      check();
    }
    expect(wins).toBeGreaterThan(0);
  }, 120000);
});

describe("Türkçe sözlük (lisanslı kaynaklar)", () => {
  it("isimlerden yanlış türetilmiş anlamsız kelimeler yok, düzenli fiil türevleri var", () => {
    for (const w of ["PARMAZ", "DAMAZ", "RAMAZ", "IRMAZ", "BAŞMAZ"]) expect(dict.has(w), w).toBe(false);
    for (const w of ["YAPMAZ", "OKUMAZ", "GİTMEZ", "GİDEBİLMEK", "EDEBİLMEK", "OKUYABİLMEK", "YAPIVERMEK", "OKUMA", "GİTME", "KALEM", "KUZU", "ADANA", "TÜRKÇE"]) expect(dict.has(w), w).toBe(true);
  });
});

import { LANGS, TWO_LETTER_WORDS } from "../src/game/lang";
describe("iki harfli kelimeler bütün dillerde", () => {
  it("her oynanabilir dilin listesi var ve yalnızca o dilin harflerinden oluşur", () => {
    for (const code of Object.keys(LANGS) as (keyof typeof LANGS)[]) {
      if (!LANGS[code].playable) continue;
      const list = TWO_LETTER_WORDS[code];
      expect(list, code).toBeTruthy();
      for (const w of list!) {
        expect([...w].length, `${code} ${w}`).toBe(2);
        for (const ch of w) expect(LANGS[code].alphabet.includes(ch), `${code} ${w}`).toBe(true);
      }
    }
  });
  it("İngilizcede IS geçerli, XQ ve ZO geçersiz", () => {
    const en = new Dictionary(["CAT"], LANGS.en);
    expect(en.has("IS")).toBe(true);
    expect(en.has("XQ")).toBe(false);
    expect(en.has("ZO")).toBe(false);
  });
});

describe("iki harfli Türkçe kelimeler", () => {
  it("yalnızca anlamlı ikililer geçerli: harf adları, ekler ve eski sözler geçersiz", () => {
    for (const w of ["ET", "EL", "OL", "OK", "ON", "OY", "OF", "AL", "AK", "AN", "AÇ", "AT", "AS", "AY", "AŞ", "İL", "İT", "İŞ", "İN", "İZ", "İS", "İÇ",
      "EN", "EV", "EY", "EK", "ES", "EZ", "UN", "UT", "US", "UÇ", "ŞU", "BU"]) expect(dict.has(w), w).toBe(true);
    for (const w of ["ÜT", "Mİ", "Kİ", "DE", "DA", "RA", "PE", "TO", "NO", "AB", "OD", "IR", "ÇZ", "XQ", "İĞ"]) expect(dict.has(w), w).toBe(false);
  });
});

describe("işleme (yerdeki kelimeye harf ekleme) denetimi", () => {
  const start = () => newGame(["A", "B", "C", "D"], [false, true, true, true], 1, 11);
  /** A oyuncusu KALEM + ÇAY + TUZ ile açar (değeri 163), sonra ıstakasında `extra` kalır. */
  const opened = (extra: Tile[]) => {
    const g = start();
    const s = structuredClone(g);
    s.phase = "play";
    const kalem = tiles("KALEM"), cay = tiles("ÇAY"), tuz = tiles("TUZ");
    s.players[s.current].rack = [...kalem, ...cay, ...tuz, ...extra, t("B")];
    const o = openHand(dict, s, [kalem, cay, tuz].map((w) => ({ tileIds: w.map((x) => x.id) })));
    return o;
  };
  const wordOf = (o: GameState, i: number) => o.table[i].tiles.map((x) => x.letter).join("");

  it("sona harf eklenir: KALEM + Lİ → KALEMLİ; puan ekleyene yazılır", () => {
    const li = tiles("Lİ");
    const o = opened(li);
    const me = o.current;
    const before = o.players[me].points ?? 0;
    const k = o.table.findIndex((w) => wordOf(o, o.table.indexOf(w)) === "KALEM");
    const o2 = extendWord(dict, o, o.table[k].id, "end", { tileIds: li.map((x) => x.id) });
    expect(wordOf(o2, k)).toBe("KALEMLİ");
    expect(o2.players[me].points).toBe(before + wordValue("Lİ"));
    expect(o2.players[me].rack.some((x) => li.some((y) => y.id === x.id))).toBe(false);
    expect(o2.table[k].owner).toBe(o.table[k].owner);
  });

  it("başa harf eklenir: TUZ → ATUZ yok, reddedilir ve hiçbir şey değişmez", () => {
    const a = tiles("A");
    const o = opened(a);
    const k = o.table.findIndex((w) => w.tiles.map((x) => x.letter).join("") === "TUZ");
    const snap = JSON.stringify(o);
    expectErr(() => extendWord(dict, o, o.table[k].id, "start", { tileIds: [a[0].id] }), "notInDict", { word: "ATUZ" });
    expect(JSON.stringify(o)).toBe(snap);
  });

  it("başa ekleme geçerli kelimede kabul edilir: ÇAY → ÇAYIR değil, AY başına harf: KAY? sözlükte yoksa reddedilir", () => {
    const o = opened(tiles("S"));
    const k = o.table.findIndex((w) => w.tiles.map((x) => x.letter).join("") === "TUZ");
    const s = o.players[o.current].rack.find((x) => x.letter === "S")!;
    // STUZ geçersiz
    expectErr(() => extendWord(dict, o, o.table[k].id, "start", { tileIds: [s.id] }), "notInDict");
  });

  it("joker başa eklenerek işlenir ve jokerin harfi seçilir: joker + TUZ → OTUZ", () => {
    const j = t(null);
    const o = opened([j]);
    const k = o.table.findIndex((w) => w.tiles.map((x) => x.letter).join("") === "TUZ");
    const opts = jokerOptions(dict, [null, "T", "U", "Z"]);
    expect(opts).toContainEqual(["O"]);
    const o2 = extendWord(dict, o, o.table[k].id, "start", { tileIds: [j.id], jokerLetters: ["O"] });
    expect(o2.table[k].tiles.map((x) => x.letter).join("")).toBe("OTUZ");
    expect(o2.table[k].tiles[0].tile.letter).toBe(null);
  });

  it("joker harfi verilmeden işlenemez", () => {
    const j = t(null);
    const o = opened([j]);
    const k = o.table.findIndex((w) => w.tiles.map((x) => x.letter).join("") === "TUZ");
    expect(() => extendWord(dict, o, o.table[k].id, "start", { tileIds: [j.id] })).toThrow(GameError);
  });

  it("elde son taş kalmalı: son taşla işleme yapılamaz", () => {
    const g = start();
    const s = structuredClone(g);
    s.phase = "play";
    const kalem = tiles("KALEM"), cay = tiles("ÇAY"), tuz = tiles("TUZ"), li = tiles("Lİ");
    s.players[s.current].rack = [...kalem, ...cay, ...tuz, ...li, t("B")];
    let o = openHand(dict, s, [kalem, cay, tuz].map((w) => ({ tileIds: w.map((x) => x.id) })));
    // ıstakada Lİ + B: Lİ eklenince B kalır (geçerli); B'yi de eklemeye çalışınca taş kalmaz
    const k = o.table.findIndex((w) => w.tiles.map((x) => x.letter).join("") === "KALEM");
    o.players[o.current].rack = o.players[o.current].rack.filter((x) => x.letter !== "B");
    expectErr(() => extendWord(dict, o, o.table[k].id, "end", { tileIds: li.map((x) => x.id) }), "keepOne");
  });

  it("eli açmamış oyuncu işleyemez", () => {
    const g = start();
    const s = structuredClone(g);
    s.phase = "play";
    const o = opened(tiles("Lİ"));
    // sıradaki oyuncuya geç ve onun açmamış olduğunu doğrula
    const other = structuredClone(o);
    other.current = (o.current + 1) % 4;
    other.phase = "play";
    other.players[other.current].opened = false;
    const li = tiles("Lİ");
    other.players[other.current].rack = [...li, t("B")];
    expectErr(() => extendWord(dict, other, o.table[0].id, "end", { tileIds: li.map((x) => x.id) }), "mustOpenFirst");
  });

  it("başkasının kelimesine eklenen puan ekleyene yazılır, kelimenin sahibine değil", () => {
    const o = opened(tiles("Lİ"));
    const owner = o.current;
    const other = structuredClone(o);
    other.current = (owner + 1) % 4;
    other.phase = "play";
    other.players[other.current].opened = true;
    const li = tiles("Lİ");
    other.players[other.current].rack = [...li, t("B")];
    const ownerPts = other.players[owner].points ?? 0;
    const k = other.table.findIndex((w) => w.tiles.map((x) => x.letter).join("") === "KALEM");
    const o2 = extendWord(dict, other, other.table[k].id, "end", { tileIds: li.map((x) => x.id) });
    expect(o2.players[other.current].points).toBe(wordValue("Lİ"));
    expect(o2.players[owner].points).toBe(ownerPts);
    expect(o2.table[k].owner).toBe(owner);
  });

  it("sırası olmayan ya da taş çekmemiş oyuncu işleyemez", () => {
    const o = opened(tiles("Lİ"));
    const s = structuredClone(o);
    s.phase = "draw";
    const li = o.players[o.current].rack.filter((x) => x.letter === "L" || x.letter === "İ");
    expect(() => extendWord(dict, s, o.table[0].id, "end", { tileIds: li.map((x) => x.id) })).toThrow(GameError);
  });

  it("yerdeki jokerli kelimeye işleme: jokerin harfi korunur", () => {
    const g = start();
    const s = structuredClone(g);
    s.phase = "play";
    const j = t(null);
    const kalem = [t("K"), j, t("L"), t("E"), t("M")], cay = tiles("ÇAY"), tuz = tiles("TUZ"), li = tiles("Lİ");
    s.players[s.current].rack = [...kalem, ...cay, ...tuz, ...li, t("B")];
    let o = openHand(dict, s, [
      { tileIds: kalem.map((x) => x.id), jokerLetters: ["A"] },
      { tileIds: cay.map((x) => x.id) },
      { tileIds: tuz.map((x) => x.id) },
    ]);
    const k = o.table.findIndex((w) => w.tiles.map((x) => x.letter).join("") === "KALEM");
    o = extendWord(dict, o, o.table[k].id, "end", { tileIds: li.map((x) => x.id) });
    expect(o.table[k].tiles.map((x) => x.letter).join("")).toBe("KALEMLİ");
    expect(o.table[k].tiles[1].tile.letter).toBe(null);
  });
});

describe("bütün masaların giriş ve ödülleri", () => {
  it("VIP, Teke Tek, Sosyete, Çayhane: giriş, birinciye ödül, kaybedene 0, eşitlikte paylaşım", () => {
    const want: Record<string, [number, number, number]> = {
      caylak: [100, 400, 4], usta: [100, 400, 4], usta2: [1000, 4000, 4], usta5: [10000, 40000, 4],
      ozel2: [100, 200, 2], ozel2u: [250, 500, 2], ozel2b: [500, 1000, 2], vip2: [100, 200, 2],
    };
    expect(TABLES.map((x) => x.id).sort()).toEqual(Object.keys(want).sort());
    for (const tb of TABLES) {
      const [entry, prize, n] = want[tb.id];
      expect([tb.id, tb.entry, winnerPrize(tb), tb.players ?? 4]).toEqual([tb.id, entry, prize, n]);
      const win = Array.from({ length: n }, (_, i) => (i === 0 ? 150 : 20));
      expect(payout(tb, win, 0, 0)).toBe(prize);
      expect(payout(tb, win, 1, 0)).toBe(0);
      const tie = Array.from({ length: n }, (_, i) => (i < 2 ? 150 : 20));
      expect(payout(tb, tie, 0, 0)).toBe(Math.floor(prize / 2));
    }
  });
});

import { noWinnerGame } from "../src/economy/tables";
describe("kimse bitiremedi (deste bitti)", () => {
  it("yalnızca deste bitip oyun sona erince kaybeden yok sayılır", () => {
    expect(noWinnerGame({ phase: "gameOver", lastResult: { reason: "deckEmpty" } })).toBe(true);
    expect(noWinnerGame({ phase: "gameOver", lastResult: { reason: "finished" } })).toBe(false);
    expect(noWinnerGame({ phase: "play", lastResult: null })).toBe(false);
  });
});
