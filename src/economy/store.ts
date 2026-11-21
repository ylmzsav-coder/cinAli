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
  { productId: "cinali_cip_10k", chips: 10_000, testPrice: "₺ 29,99" },
  { productId: "cinali_cip_50k", chips: 50_000, testPrice: "₺ 119,99", badge: "badge_popular" },
  { productId: "cinali_cip_150k", chips: 150_000, testPrice: "₺ 299,99", badge: "badge_bonus" },
  { productId: "cinali_cip_500k", chips: 500_000, testPrice: "₺ 799,99", badge: "badge_best" },
];

export const TEST_MODE = import.meta.env.DEV;

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
