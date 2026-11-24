/**
 * Çip ekonomisi ve başarı oranı simülasyonu (yalnızca istenince:
 *   SIM=1 SIM_N=300 SIM_OUT=sonuc.json npx vitest run tests/economy-sim.test.ts).
 * Gerçek oyuncuyu bir beceri seviyesindeki yapay oyuncu temsil eder; masadaki bilgisayarlar
 * oyundaki gibi davranır (bitirebildiği an bitirir; gerçek oyuncuyla eşit şartlar).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { describe, it } from "vitest";
import { botStep, type BotLevel } from "../src/game/bot";
import { Dictionary } from "../src/game/dictionary";
import { gameWinners, newGame, type GameState } from "../src/game/engine";
import { setGameLang } from "../src/game/lang";
import { TABLES } from "../src/economy/tables";

const RUN = !!process.env.SIM;
const N = Number(process.env.SIM_N ?? 120);
setGameLang("tr");
const dict = Dictionary.fromText(readFileSync("public/dict/tr.txt", "utf-8"));

/** Bir oyun: 0. koltuk gerçek oyuncu (skill seviyesinde oynar). Sonuç: kazandı / kaybetti / sayılmaz. */
function play(tableId: string, skill: BotLevel, seed: number): "won" | "lost" | "none" {
  const tb = TABLES.find((x) => x.id === tableId)!;
  const n = tb.players ?? 4;
  const names = ["Sen", "B1", "B2", "B3"].slice(0, n);
  let s: GameState = newGame(names, names.map((_, i) => i > 0), 1, seed, tb.minWord);
  for (let steps = 0; s.phase !== "gameOver" && steps < 5000; steps++) {
    if (s.current === 0) {
      // Gerçek oyuncu bitirebildiği an bitirir (bilgisayarların "bekleme" kuralı ona uygulanmaz)
      const as = { ...s, players: s.players.map((p) => ({ ...p, isBot: true })) };
      const next = botStep(dict, as, skill);
      s = { ...next, players: next.players.map((p, i) => ({ ...p, isBot: i !== 0 })) };
    } else s = botStep(dict, s, tb.level);
  }
  if (s.lastResult?.reason === "deckEmpty") return "none";
  return gameWinners(s).includes(0) ? "won" : "lost";
}

/** Bir oyunun ayrıntısı: sonuç, tur sayısı (herkesin birer hamlesi bir tur), bitiren koltuk. */
function playDetail(tableId: string, skill: BotLevel, seed: number) {
  const tb = TABLES.find((x) => x.id === tableId)!;
  const n = tb.players ?? 4;
  const names = ["Sen", "B1", "B2", "B3"].slice(0, n);
  let s: GameState = newGame(names, names.map((_, i) => i > 0), 1, seed, tb.minWord);
  for (let steps = 0; s.phase !== "gameOver" && steps < 5000; steps++) {
    if (s.current === 0) {
      const as = { ...s, players: s.players.map((p) => ({ ...p, isBot: true })) };
      const next = botStep(dict, as, skill);
      s = { ...next, players: next.players.map((p, i) => ({ ...p, isBot: i !== 0 })) };
    } else s = botStep(dict, s, tb.level);
  }
  const moves = s.discards.reduce((a, d) => a + d.length, 0) + s.table.length * 0;
  const rounds = Math.ceil((moves + 1) / n);
  const result = s.lastResult?.reason === "deckEmpty" ? "none" : gameWinners(s).includes(0) ? "won" : "lost";
  return { result, rounds, finisher: s.lastResult?.winner ?? null, deckLeft: s.deck.length };
}

describe.skipIf(!RUN)("ekonomi simülasyonu", () => {
  it("oda raporu: sonuçlar ve tur sayıları", () => {
    const rows: unknown[] = [];
    for (const id of (process.env.SIM_ROOMS ?? "caylak,usta,usta2,usta5,ozel2,ozel2u,ozel2b,vip2").split(",")) {
      for (const skill of ["kolay", "orta", "zor"] as BotLevel[]) {
        for (let k = 0; k < N; k++) rows.push({ id, skill, ...playDetail(id, skill, 1000 + k * 7) });
      }
    }
    if (process.env.SIM_OUT) writeFileSync(process.env.SIM_OUT.replace(/\.json$/, "-oda.json"), JSON.stringify(rows));
  }, 3_600_000);

  it.skipIf(!!process.env.SIM_ROOMS_ONLY)("kazanma oranları", () => {
    const out: Record<string, Record<string, { won: number; lost: number; none: number }>> = {};
    for (const id of ["caylak", "usta", "ozel2", "ozel2u", "vip2"]) {
      out[id] = {};
      for (const skill of ["kolay", "orta", "zor"] as BotLevel[]) {
        const r = { won: 0, lost: 0, none: 0 };
        for (let k = 0; k < N; k++) r[play(id, skill, 1000 + k * 7)]++;
        out[id][skill] = r;
        const rate = Math.round((r.won / Math.max(1, r.won + r.lost)) * 100);
        console.log(`${id.padEnd(7)} ${skill.padEnd(5)} kazanma %${rate} (sayılan ${r.won + r.lost}, kimse bitiremedi ${r.none})`);
      }
    }
    if (process.env.SIM_OUT) writeFileSync(process.env.SIM_OUT, JSON.stringify(out));
  }, 3_600_000);
});
