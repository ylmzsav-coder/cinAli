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
  it("104 harf + 2 joker = 106 taş; A ve E 4'er adet; renkler dengeli", () => {
    const set = createTileSet();
    expect(set.length).toBe(106);
    expect(set.filter((x) => x.letter === null).length).toBe(2);
    for (const l of ["A", "E"]) {
      const tilesOf = set.filter((x) => x.letter === l);
      expect(tilesOf.length).toBe(4);
      expect(new Set(tilesOf.map((x) => x.color)).size).toBe(4);
    }
    const count = (l: string) => set.filter((x) => x.letter === l).length;
    expect([count("İ"), count("K"), count("O"), count("T")]).toEqual([5, 8, 6, 6]);
    const vowels = [..."AEIİOÖUÜ"].reduce((n, l) => n + count(l), 0);
    expect(vowels).toBe(29); // alfabedeki harf sayısı kadar
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

  it("86 altında açılmaz, 86 ve üstü açılır", () => {
    const kalem = tiles("KALEM");
    const cay = tiles("ÇAY");
    // KALEM + ÇAY = 85: bir eksik
    const s = rig(base, [...kalem, ...cay, t("B")]);
    expectErr(
      () => openHand(dict, s, [{ tileIds: kalem.map((x) => x.id) }, { tileIds: cay.map((x) => x.id) }]),
      "openNeeds",
      { need: 86, total: 85 },
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

import { TABLES, payout, winnerPrize } from "../src/economy/tables";
describe("çip ödemesi (en yüksek toplam birinci)", () => {
  const t = TABLES[0]; // tek masa: giriş 100, birinciye 300
  it("giriş 100, birinci 300 çip alır", () => {
    expect(TABLES.length).toBe(1);
    expect(t.entry).toBe(100);
    expect(winnerPrize(t)).toBe(300);
    expect(payout(t, [300, 50, 200, 30], 0, 0)).toBe(300);
  });
  it("birinci değilse 0, eşitlikte paylaşılır", () => {
    expect(payout(t, [10, -100, 200, 30], 0, 0)).toBe(0);
    expect(payout(t, [250, 250, 200, 30], 0, 0)).toBe(150);
    // Üç kişi berabere: 300 / 3 = 100'er çip
    expect(payout(t, [250, 250, 250, 30], 2, 0)).toBe(100);
  });
  it("Renk Bitirme ikramiyesi giriş ücreti kadar", () => {
    expect(payout(t, [400, 50, 200, 30], 0, 1)).toBe(300 + 100);
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
describe("çifte gitme", () => {
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
  it("500 çip = masada 5 oyunluk çip", () => {
    expect(WELCOME_CHIPS).toBe(500);
    expect(WELCOME_GAMES).toBe(5);
    expect(WELCOME_CHIPS).toBe(WELCOME_GAMES * TABLES[0].entry);
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
    for (const w of ["AK", "KA", "EL", "LE", "Lİ", "ON", "İZ", "ÇE", "AĞ", "ÖZ", "ÖN", "ÜÇ", "BU", "UN", "UZ", "UR"]) expect(dict.has(w), w).toBe(true);
    for (const w of ["ŞU", "ZÖ", "AE", "KL", "AA", "K"]) expect(dict.has(w), w).toBe(false);
  });
  it("açmış oyuncu iki harfli kelime koyabilir; tek harf koyamaz", () => {
    const kalem = tiles("KALEM"), cay = tiles("ÇAY"), tuz = tiles("TUZ"), ek = tiles("EK"), b = t("B");
    const s = rig(base, [...kalem, ...cay, ...tuz, ...ek, b, t("Z")]);
    let o = openHand(dict, s, [kalem, cay, tuz].map((w) => ({ tileIds: w.map((x) => x.id) })));
    o = layWord(dict, o, { tileIds: ek.map((x) => x.id) });
    expect(o.table.at(-1)?.tiles.map((x) => x.letter).join("")).toBe("EK");
    expectErr(() => layWord(dict, o, { tileIds: [b.id] }), "minLength", { n: 2 });
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
