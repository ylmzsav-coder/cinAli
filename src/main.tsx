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
  // Yeni sürüm oyunun ortasında sayfayı yenilemez: uygulama arka plana geçince
  // (ya da hâlâ açılış ekranındaysa hemen) sessizce güncellenir.
  import("virtual:pwa-register").then(({ registerSW }) => {
    const update = registerSW({
      immediate: true,
      onNeedRefresh() {
        const onSplash = sessionStorage.getItem("wordokey.started") !== "1";
        if (onSplash) {
          void update(true);
          return;
        }
        const later = () => {
          if (document.visibilityState === "hidden") {
            document.removeEventListener("visibilitychange", later);
            void update(true);
          }
        };
        document.addEventListener("visibilitychange", later);
      },
    });
  });
}

unlockAudio();
// Giriş müziğini önceden işle: dokunulunca takılmadan çalar
import("./music").then((m) => m.prepareMusic()).catch(() => {});
// El sonu müziklerini de önceden işle (giriş müziğinden sonra, boşta)
setTimeout(() => void import("./jingles").then((m) => m.prepareJingles()).catch(() => {}), 2000);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
