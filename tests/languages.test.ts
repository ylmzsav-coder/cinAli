import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { botStep } from "../src/game/bot";
import { Dictionary } from "../src/game/dictionary";
import { dealHand, newGame } from "../src/game/engine";
import { LANGS, LangCode, PLAYABLE_LANGS, setGameLang } from "../src/game/lang";

/** Her oynanabilir dilde 4 bot birkaç oyunu sonuna kadar oynar. */
export function simulate(code: LangCode, level: "kolay" | "orta" | "zor", games: number) {
  setGameLang(code);
  const dict = Dictionary.fromText(readFileSync(`public/dict/${code}.txt`, "utf-8"), LANGS[code]);
  let hands = 0, wins = 0, turns = 0;
  for (let seed = 1; seed <= games; seed++) {
    let s = newGame(["A", "B", "C", "D"], [true, true, true, true], 3, seed);
    let t = 0, steps = 0;
    for (;;) {
      if (s.phase === "handOver" || s.phase === "gameOver") {
        hands++; turns += t; t = 0;
        if (s.lastResult!.winner !== null) wins++;
        if (s.phase === "gameOver") break;
        s = dealHand(s);
        continue;
      }
      const c = s.current;
      s = botStep(dict, s, level);
      if (s.current !== c || s.phase === "handOver" || s.phase === "gameOver") t++;
      if (++steps > 5000) throw new Error("sonsuz döngü");
    }
  }
  return { hands, wins, rounds: turns / hands / 4 };
}

describe("diller", () => {
  for (const code of PLAYABLE_LANGS) {
    it(`${code}: botlar oyunu bitirir`, () => {
      const r = simulate(code, "orta", 3);
      expect(r.wins).toBeGreaterThan(0);
    }, 120000);
  }
});
