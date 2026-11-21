// functions/src/index.ts'i (ve paylaşılan ../src/game, ../src/economy kodunu) tek dosyaya paketler,
// sözlükleri lib/dict'e kopyalar.
import { build } from "esbuild";
import { cpSync, mkdirSync } from "node:fs";

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  outfile: "lib/index.js",
  external: ["firebase-admin", "firebase-functions"],
  sourcemap: true,
  logLevel: "info",
});
mkdirSync("lib/dict", { recursive: true });
cpSync("../public/dict", "lib/dict", { recursive: true });
