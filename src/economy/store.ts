/**
 * Uygulama içi satın alma ve ödüllü reklam katmanı.
 *
 * Gerçek sağlayıcılar (RevenueCat ile Google Play / App Store ödemeleri ve
 * AdMob ödüllü reklamları) mağaza hesapları açılınca buraya bağlanacak.
 * O zamana kadar:
 *  - geliştirme sunucusunda (npm run dev) TEST modu çalışır: satın alma ve
 *    reklam taklit edilir, çip verilir;
 *  - yayınlanmış sürümde mağaza ve reklam "yakında" olarak görünür.
 */

export interface ChipPack {
  /** Play Console ve App Store Connect'te aynı kimlikle oluşturulacak. */
  productId: string;
  chips: number;
  /** Gerçek fiyat mağazadan gelir; bu yalnızca test modunda gösterilir. */
  testPrice: string;
  /** Rozet çeviri anahtarı. */
  badge?: "badge_popular" | "badge_bonus" | "badge_best";
}

export const CHIP_PACKS: ChipPack[] = [
  // Masa girişi 100 çip: 1.000 çip = 10 oyun
  { productId: "wordokey_cip_1k", chips: 1_000, testPrice: "₺ 29,99" },
  { productId: "wordokey_cip_5k", chips: 5_000, testPrice: "₺ 119,99", badge: "badge_popular" },
  { productId: "wordokey_cip_15k", chips: 15_000, testPrice: "₺ 299,99", badge: "badge_bonus" },
  { productId: "wordokey_cip_50k", chips: 50_000, testPrice: "₺ 799,99", badge: "badge_best" },
];

/** Geliştirme sunucusu ve test yapıları (GitHub Pages, debug APK) taklit mağaza kullanır. */
export const TEST_MODE = import.meta.env.DEV || import.meta.env.VITE_TEST_STORE === "1";

export const purchasesAvailable = () => TEST_MODE;
export const adsAvailable = () => TEST_MODE;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Satın alma; başarılıysa verilecek çip miktarını döndürür. */
export async function buyPack(pack: ChipPack): Promise<number> {
  if (!TEST_MODE) throw Object.assign(new Error("storeSoon"), { code: "storeSoon" });
  await wait(600);
  return pack.chips;
}

/** Ödüllü reklam gösterir; sonuna kadar izlendiyse true. */
export async function showRewardedAd(): Promise<boolean> {
  if (!TEST_MODE) throw Object.assign(new Error("adsSoon"), { code: "adsSoon" });
  await wait(1500);
  return true;
}

/**
 * Otomatik Per: tek seferlik satın alma (tüketilmeyen ürün), sınırsız kullanım.
 * Play Console / App Store Connect'te "wordokey_otomatik_per" kimliğiyle,
 * 1 $ fiyat kademesinde oluşturulacak.
 */
export const AUTO_PER_PRODUCT = { productId: "wordokey_otomatik_per", testPrice: "1\u00a0$" };
const KEY_AUTO_PER = "wordokey.autoPer";

export function ownsAutoPer(): boolean {
  try {
    return localStorage.getItem(KEY_AUTO_PER) === "1";
  } catch {
    return false;
  }
}

/** Otomatik Per'i satın alır; başarılıysa kalıcı olarak açılır. */
export async function buyAutoPer(): Promise<void> {
  if (!TEST_MODE) throw Object.assign(new Error("storeSoon"), { code: "storeSoon" });
  await wait(600);
  try {
    localStorage.setItem(KEY_AUTO_PER, "1");
  } catch {
    /* depolama yoksa yalnızca bu oturumda açık kalır */
  }
}
