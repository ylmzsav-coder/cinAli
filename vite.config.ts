import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";

/** Menüde görünen sürüm: derleme tarihi + kayıt numarası (telefonda güncel sürüm açık mı anlaşılır). */
const APP_VERSION = (() => {
  const d = new Date();
  const date = `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`;
  try {
    return `${date} · ${execSync("git rev-parse --short HEAD").toString().trim()}`;
  } catch {
    return date;
  }
})();

/** Sözlük sürümleri: dosya değişince adres (?v=) değişir, telefonlar eski sözlükte kalmaz. */
const DICT_VERSIONS = Object.fromEntries(
  readdirSync("public/dict")
    .filter((f) => f.endsWith(".txt"))
    .map((f) => [f.slice(0, -4), createHash("sha256").update(readFileSync(`public/dict/${f}`)).digest("hex").slice(0, 10)]),
);

export default defineConfig({
  // Göreli yol: GitHub Pages alt klasöründe ve yerelde aynı şekilde çalışır.
  base: "./",
  define: { __DICT_VERSIONS__: JSON.stringify(DICT_VERSIONS), __APP_VERSION__: JSON.stringify(APP_VERSION) },
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      // Kayıt main.tsx'te yapılır: mobil uygulama içinde servis worker gerekmez.
      injectRegister: null,
      includeAssets: ["icon.svg"],
      workbox: {
        // Sözlükler önceden indirilmez; yalnızca seçilen dilinki ilk kullanımda önbelleğe alınır.
        globPatterns: ["**/*.{js,css,html,svg,png,m4a}"],
        // Resim denetimi modeli (~5 MB) önceden indirilmez: yalnızca profil resmi seçilince yüklenir
        globIgnores: ["**/photocheck-*.js", "**/group1-shard*.js", "**/model.min-*.js"],
        runtimeCaching: [
          {
            urlPattern: /\/dict\/[a-z]{2}\.txt(\?.*)?$/,
            handler: "CacheFirst",
            options: { cacheName: "cinali-dict", expiration: { maxEntries: 10 } },
          },
        ],
      },
      manifest: {
        name: "Word Okey",
        short_name: "Word Okey",
        description: "Harflerle oynanan okey tarzı kelime oyunu / The rummy tile game played with letters",
        theme_color: "#0f5132",
        background_color: "#0f5132",
        display: "fullscreen",
        orientation: "landscape",
        start_url: "./",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  build: {
    // Kütüphaneler ayrı dosyada: oyun güncellenince yalnızca oyunun kendi kodu yeniden indirilir
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: (id) => (id.includes("node_modules/firebase") || id.includes("node_modules/@firebase") ? "firebase" : id.includes("node_modules/react") ? "react" : undefined),
      },
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
