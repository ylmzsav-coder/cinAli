/**
 * Kök değeri 7 olan bütün Türkçe kelimeleri sözlükten çıkarır (sözlük sırasıyla).
 * Çalıştır: npx tsx tools/kok7.ts  →  public/dict/kok7-tr.txt
 * Sözlük değişirse yeniden çalıştırılır; testler dosyanın güncel olduğunu denetler.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { wordNumber } from "../src/strokes";

const words = readFileSync("public/dict/tr.txt", "utf8").split("\n").map((w) => w.trim()).filter(Boolean);
const sevens = words.filter((w) => wordNumber(w).root === 7);
// İlk satır: sözlükteki toplam kelime sayısı (# ile)
writeFileSync("public/dict/kok7-tr.txt", `# ${words.length}\n` + sevens.join("\n") + "\n");
console.log(`${words.length} kelime, ${sevens.length} tanesinin kök değeri 7`);
