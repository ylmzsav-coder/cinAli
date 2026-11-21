import { Capacitor } from "@capacitor/core";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { unlockAudio } from "./feedback";
import "./styles.css";

if (Capacitor.isNativePlatform()) {
  // Mobil uygulama: koyu zemin üzerinde açık renkli durum çubuğu
  import("@capacitor/status-bar")
    .then(({ StatusBar, Style }) => StatusBar.setStyle({ style: Style.Dark }))
    .catch(() => {});
} else {
  // Web: çevrimdışı çalışma ve "Ana ekrana ekle" için servis worker
  import("virtual:pwa-register").then(({ registerSW }) => registerSW({ immediate: true }));
}

unlockAudio();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
