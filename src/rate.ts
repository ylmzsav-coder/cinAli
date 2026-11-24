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

/** Mağaza sayfasını açar; web'de false döner (seçim penceresi gösterilir). */
export function openStoreReview(): boolean {
  const p = platform();
  if (p === "android") {
    window.open(`market://details?id=${PLAY_ID}`, "_system") ?? window.open(playUrl, "_system");
    return true;
  }
  if (p === "ios" && APP_STORE_ID) {
    window.open(`itms-apps://itunes.apple.com/app/id${APP_STORE_ID}?action=write-review`, "_system");
    return true;
  }
  return false;
}
