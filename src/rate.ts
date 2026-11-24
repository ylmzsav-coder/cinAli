/**
 * "Word Okey'i Değerlendir": mağazadaki uygulama sayfasını açar.
 *  - Android: Google Play (uygulama kimliği capacitor.config.ts ile aynı)
 *  - iOS: App Store değerlendirme sayfası (App Store kimliği yayından sonra APP_STORE_ID'ye yazılır)
 *  - Web: iki mağazanın bağlantısı gösterilir
 */
import { Capacitor } from "@capacitor/core";

export const PLAY_ID = "com.wordokey.oyun";
/** App Store Connect'te uygulama oluşturulunca verilen sayısal kimlik (ör. "6470000000"). */
export const APP_STORE_ID = "";

export const playUrl = `https://play.google.com/store/apps/details?id=${PLAY_ID}&showAllReviews=true`;
export const appStoreUrl = APP_STORE_ID ? `https://apps.apple.com/app/id${APP_STORE_ID}?action=write-review` : "";

export const platform = () => Capacitor.getPlatform();

/** Cihazın türü: uygulama içindeyse Capacitor, tarayıcıdaysa tarayıcı kimliğinden. */
export function deviceStore(): "android" | "ios" | "other" {
  const p = platform();
  if (p === "android" || p === "ios") return p;
  const ua = navigator.userAgent || "";
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  return "other";
}

/**
 * Kişinin cihazına göre mağazayı açar:
 *  - Android (uygulama ya da tarayıcı): market:// bağlantısı; telefon hangi mağazayı
 *    kullanıyorsa (Google Play, Galaxy Store…) onu açar ya da seçtirir.
 *  - iPhone/iPad: App Store değerlendirme sayfası (APP_STORE_ID girilince).
 * Açamazsa false döner (bilgisayar ya da App Store kimliği henüz yok): o zaman bağlantılar gösterilir.
 */
export function openStoreReview(): boolean {
  const d = deviceStore();
  if (d === "android") {
    window.location.href = `market://details?id=${PLAY_ID}`;
    return true;
  }
  if (d === "ios" && APP_STORE_ID) {
    window.location.href = `itms-apps://itunes.apple.com/app/id${APP_STORE_ID}?action=write-review`;
    return true;
  }
  return false;
}
