// Gizlilik Politikası'nın herkese açık web sayfalarını üretir (mağaza kayıtları için adres):
//   public/gizlilik.html (Türkçe), public/privacy.html (İngilizce)
// Kaynak: src/legal/privacy.json (uygulama içindeki sayfa da aynı metni kullanır).
// Kullanım: node tools/build_legal.mjs  (npm run build bunu otomatik çalıştırır)
import { readFileSync, writeFileSync } from "node:fs";

const data = JSON.parse(readFileSync(new URL("../src/legal/privacy.json", import.meta.url), "utf8"));
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const page = (lang, other) => {
  const d = data[lang];
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(d.title)}</title>
<meta name="description" content="${esc(d.intro.slice(0, 150))}">
<link rel="icon" href="icon.svg" type="image/svg+xml">
<style>
  :root { color-scheme: light dark; --bg: #f6f3ea; --fg: #1d2b22; --muted: #5b6b60; --accent: #14663f; --card: #fff; }
  @media (prefers-color-scheme: dark) { :root { --bg: #0f2a1d; --fg: #eef3ee; --muted: #a9bdb0; --accent: #ffd54f; --card: #143524; } }
  body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 760px; margin: 0 auto; padding: 24px 16px 48px; }
  header { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
  .brand { font-weight: 900; letter-spacing: 0.04em; color: var(--accent); text-decoration: none; }
  h1 { font-size: 1.8rem; line-height: 1.2; margin: 16px 0 4px; }
  h2 { font-size: 1.15rem; margin: 28px 0 8px; }
  .muted { color: var(--muted); font-size: 0.9rem; }
  section { background: var(--card); border-radius: 12px; padding: 4px 18px 10px; margin-top: 14px; }
  ul { padding-left: 1.2em; } li { margin: 6px 0; }
  a { color: var(--accent); }
</style>
</head>
<body>
<main>
  <header><a class="brand" href="./">WORD OKEY</a><a href="${other.href}" hreflang="${other.lang}">${other.label}</a></header>
  <h1>${esc(d.title)}</h1>
  <p class="muted">${esc(d.updated)}</p>
  <p>${esc(d.intro)}</p>
${d.sections.map((s) => `  <section>\n    <h2>${esc(s.h)}</h2>\n    <ul>\n${s.items.map((i) => `      <li>${esc(i)}</li>`).join("\n")}\n    </ul>\n  </section>`).join("\n")}
  <p class="muted">© ${new Date().getFullYear()} Word Okey</p>
</main>
</body>
</html>
`;
};
writeFileSync(new URL("../public/gizlilik.html", import.meta.url), page("tr", { href: "privacy.html", lang: "en", label: "English" }));
writeFileSync(new URL("../public/privacy.html", import.meta.url), page("en", { href: "gizlilik.html", lang: "tr", label: "Türkçe" }));
console.log("gizlilik.html ve privacy.html üretildi");
