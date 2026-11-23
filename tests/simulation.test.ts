// Tüm dillerde 2 ve 4 kişilik bilgisayar oyunları: taş sayısı korunur, her taş tek yerde, yerdeki kelimeler geçerli, oyun sonsuz döngüye girmez.
import { readFileSync } from "node:fs";
import { it, expect } from "vitest";
import { botStep } from "../src/game/bot";
import { Dictionary } from "../src/game/dictionary";
import { setGameLang, LANG_ORDER, LANGS } from "../src/game/lang";
import { newGame, totals, gameWinners, GAME_HANDS } from "../src/game/engine";
import { wordValue } from "../src/game/tiles";

for (const code of LANG_ORDER.filter((c) => LANGS[c].playable)) {
  it(`simülasyon ${code}`, () => {
    setGameLang(code);
    const dict = Dictionary.fromText(readFileSync(`public/dict/${code}.txt`, "utf-8"));
    let probs: string[] = [];
    for (const n of [2, 4]) for (const lvl of ["kolay", "orta", "zor"] as const) for (let seed = 1; seed <= 3; seed++) {
      const names = ["A", "B", "C", "D"].slice(0, n);
      let s = newGame(names, names.map(() => true), GAME_HANDS, seed * 7 + n);
      const total0 = s.deck.length + s.players.reduce((a, p) => a + p.rack.length, 0) + s.discards.flat().length;
      let steps = 0;
      while (s.phase !== "gameOver" && s.phase !== "handOver") {
        s = botStep(dict, s, lvl);
        const tot = s.deck.length + s.players.reduce((a, p) => a + p.rack.length, 0) + s.discards.flat().length + s.table.reduce((a, w) => a + w.tiles.length, 0);
        if (tot !== total0) { probs.push(`${code} n${n} ${lvl} s${seed}: taş sayısı ${tot}≠${total0} adım ${steps}`); break; }
        for (const w of s.table) if (!w.pair && !dict.has(w.tiles.map((t) => t.letter).join(""))) { probs.push(`${code} geçersiz yer kelimesi ${w.tiles.map((t)=>t.letter).join("")}`); }
        const ids = [...s.deck, ...s.players.flatMap((p) => p.rack), ...s.discards.flat(), ...s.table.flatMap((w) => w.tiles.map((x) => x.tile))].map((t) => t.id);
        if (new Set(ids).size !== ids.length) { probs.push(`${code} n${n} ${lvl} s${seed}: aynı taş iki yerde (adım ${steps})`); break; }
        if (++steps > 4000) { probs.push(`${code} n${n} ${lvl} s${seed}: sonsuz döngü`); break; }
      }
      const tt = totals(s);
      if (tt.some((x) => !Number.isFinite(x))) probs.push(`${code}: NaN toplam`);
      const w = gameWinners(s);
      if (!w.length) probs.push(`${code}: kazanan yok`);
    }
    probs = [...new Set(probs)];
    if (probs.length) console.log(probs.slice(0, 10).join("\n"));
    expect(probs).toEqual([]);
  }, 300000);
}
