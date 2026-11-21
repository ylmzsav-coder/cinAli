import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // Göreli yol: GitHub Pages alt klasöründe ve yerelde aynı şekilde çalışır.
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "kelimeler.txt"],
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,txt}"],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      manifest: {
        name: "Cinali",
        short_name: "Cinali",
        description: "Harflerle oynanan okey tarzı kelime oyunu",
        lang: "tr",
        theme_color: "#0f5132",
        background_color: "#0f5132",
        display: "standalone",
        orientation: "any",
        start_url: "./",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
