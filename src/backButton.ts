/**
 * Android geri tuşu: önce açık pencereyi kapatır; yoksa ekranlara "geri" olayı
 * gönderir (oyunda çıkış onayı, diğer ekranlarda menüye dönüş, menüde kapatma onayı).
 * Web'de bir şey yapmaz (tarayıcının kendi geri davranışı geçerlidir).
 */
import { Capacitor } from "@capacitor/core";

export const BACK_EVENT = "wordokey:back";

export async function setupBackButton() {
  if (Capacitor.getPlatform() !== "android") return;
  const { App } = await import("@capacitor/app");
  await App.addListener("backButton", () => {
    // Tam ekran yasal metin: kendi "Geri" bağlantısı
    const overlayBack = document.querySelector<HTMLElement>(".legal-overlay .link");
    if (overlayBack) return overlayBack.click();
    // Açık pencere: arka plana dokunmak gibi kapat (pencereler arka plana dokununca kapanır)
    const bgs = document.querySelectorAll<HTMLElement>(".modal-bg");
    if (bgs.length) {
      const top = bgs[bgs.length - 1];
      top.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      return;
    }
    window.dispatchEvent(new CustomEvent(BACK_EVENT));
  });
}
