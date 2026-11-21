/**
 * Oyunu kapatma. Android'de uygulamadan çıkılır. iOS'ta Apple kuralları
 * uygulamanın kendini kapatmasına izin vermez, bu yüzden düğme gösterilmez.
 * Web'de sekme kapatılmaya çalışılır; tarayıcı izin vermezse "kapandı"
 * ekranı gösterilir (sekme elle kapatılabilir).
 */
import { Capacitor } from "@capacitor/core";

export const canCloseGame = () => Capacitor.getPlatform() !== "ios";

/** Kapatır; web'de tarayıcı izin vermediyse false döner. */
export async function closeGame(): Promise<boolean> {
  if (Capacitor.getPlatform() === "android") {
    const { App } = await import("@capacitor/app");
    await App.exitApp();
    return true;
  }
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
  } catch {
    /* tam ekran değil */
  }
  window.close();
  // window.close yalnızca betikle açılmış pencerelerde çalışır; kısa süre sonra hâlâ açıksak false
  await new Promise((r) => setTimeout(r, 300));
  return window.closed;
}
