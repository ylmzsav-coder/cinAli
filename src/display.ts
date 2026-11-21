/**
 * Tam ekran ve yatay mod.
 * - Uygulamada (Android/iOS) yön, yerel proje ayarlarıyla yataya kilitlidir;
 *   durum çubuğu gizlenir.
 * - Web'de tam ekran ve yön kilidi ancak bir dokunuştan sonra istenebilir;
 *   destekleyen tarayıcılarda (Android Chrome) yatay kilitlenir, desteklemeyende
 *   (iPhone Safari) ekranda "telefonu yatay çevirin" uyarısı gösterilir.
 */
import { Capacitor } from "@capacitor/core";

export async function enterFullscreenLandscape() {
  if (Capacitor.isNativePlatform()) {
    try {
      const { StatusBar } = await import("@capacitor/status-bar");
      await StatusBar.hide();
    } catch {
      /* yok say */
    }
    return;
  }
  try {
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
    if (!document.fullscreenElement) {
      if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: "hide" });
      else await el.webkitRequestFullscreen?.();
    }
  } catch {
    /* tarayıcı izin vermedi */
  }
  try {
    const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    await o.lock?.("landscape");
  } catch {
    /* desteklenmiyor (ör. iPhone Safari, masaüstü) */
  }
}
