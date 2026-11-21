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
      // Kayıt main.tsx'te yapılır: mobil uygulama içinde servis worker gerekmez.
      injectRegister: null,
      includeAssets: ["icon.svg"],
      workbox: {
        // Sözlükler önceden indirilmez; yalnızca seçilen dilinki ilk kullanımda önbelleğe alınır.
        globPatterns: ["**/*.{js,css,html,svg,png}"],
        runtimeCaching: [
          {
            urlPattern: /\/dict\/[a-z]{2}\.txt$/,
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
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
