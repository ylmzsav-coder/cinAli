/**
 * Paralel testlerin eksiksiz olduğunu denetler: her sunucu test dosyası CI'daki bir parçada,
 * her tarayıcı bölümü (tests/e2e/run.cjs) bir PARTS grubunda olmalı. Yoksa hata verir.
 */
const fs = require("fs");
const wf = fs.readFileSync(".github/workflows/tests.yml", "utf8");
const e2e = fs.readFileSync("tests/e2e/run.cjs", "utf8");
let bad = 0;
for (const f of fs.readdirSync("tests/emulator").filter((x) => x.endsWith(".mjs"))) {
  if (!wf.includes(`tests/emulator/${f}`)) { console.log(`✗ sunucu testi hiçbir parçada değil: ${f}`); bad++; }
}
const parts = eval("(" + e2e.match(/const PARTS = (\{[^;]*\});/)[1] + ")");
const assigned = new Set(Object.values(parts).flat());
for (const m of e2e.matchAll(/if \(want\("([0-9a-z]+)"\)\)/g)) {
  if (!assigned.has(m[1])) { console.log(`✗ tarayıcı bölümü ${m[1]} hiçbir parçada değil`); bad++; }
}
for (const p of Object.keys(parts)) if (!wf.includes(p)) { console.log(`✗ CI'da ${p} parçası yok`); bad++; }
console.log(bad ? `\n✗ ${bad} eksik` : "✓ bütün testler bir paralel parçaya atanmış");
process.exit(bad ? 1 : 0);
