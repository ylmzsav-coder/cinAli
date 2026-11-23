/**
 * Çip cüzdanı. İki uygulaması var, arayüz aynı:
 *  - Sunucu (Firebase yapılandırılmışsa): bakiye yalnızca Cloud Functions
 *    tarafından değişir; istemci kendi cüzdan belgesini canlı dinler.
 *  - Cihaz (Firebase yoksa): localStorage. Yalnızca geliştirme/önizleme için;
 *    gerçek parayla satış sunucu modunda yapılır.
 */
import { doc, onSnapshot } from "firebase/firestore";
import { CLOUD, call, currentUser, firestore } from "../online/cloud";
import { AD_DAILY_LIMIT, AD_REWARD, DAILY_BONUS, REFILL_CHIPS, REFILL_MS, TxReason, VIP_BONUS_CHIPS, VIP_MS, WELCOME_CHIPS, WELCOME_GAMES, dayKey, nextBrokeSince } from "./config";

export { AD_DAILY_LIMIT, AD_REWARD, DAILY_BONUS, REFILL_CHIPS, WELCOME_CHIPS, WELCOME_GAMES };
export type { TxReason };

export interface WalletData {
  balance: number;
  lastDaily: string | null;
  adsDay: string | null;
  adsToday: number;
  /** Bakiye en ucuz masa girişinin altına düştüğü an (hediye çip sayacı); yeterliyse null. */
  brokeSince?: number | null;
  /** VIP aboneliğin bittiği an (ms); abone değilse null. */
  vipUntil?: number | null;
  /** Sunucu modunda ilk veri geldi mi. */
  ready: boolean;
  /** Cüzdan bu açılışta yeni oluşturuldu (hoş geldin hediyesi verildi). */
  welcome?: boolean;
}

type Listener = (d: WalletData) => void;

export interface WalletApi {
  readonly snapshot: WalletData;
  subscribe(fn: Listener): () => void;
  canClaimDaily(): boolean;
  adsLeftToday(): number;
  /** Hata durumunda kodlu hata fırlatır (err.*). */
  claimDaily(): Promise<void>;
  /** Çipi biten oyuncunun hediyesi ne zaman alınabilir (ms); çipi yeterliyse null. */
  refillAt(): number | null;
  canClaimRefill(): boolean;
  claimRefill(): Promise<void>;
  /** VIP abone mi (şu an). */
  isVip(): boolean;
  /** VIP abonelik satın alındıktan sonra: süreyi uzatır ve hediye çipi ekler. */
  subscribeVip(): Promise<void>;
  /** Reklam izlendikten sonra ödülü ister. */
  rewardAd(): Promise<void>;
  /** Satın alma onaylandıktan sonra çipleri ekler. */
  purchase(chips: number, productId: string): Promise<void>;
  /** Yalnızca cihaz modu (bilgisayara karşı cihazda oynanan masalar). */
  spend(amount: number, reason: TxReason, note?: string): boolean;
  add(amount: number, reason: TxReason, note?: string): void;
}

abstract class Base {
  protected data: WalletData = { balance: 0, lastDaily: null, adsDay: null, adsToday: 0, ready: false };
  private listeners = new Set<Listener>();

  get snapshot(): WalletData {
    return this.data;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  protected emit(next: WalletData) {
    this.data = next;
    this.listeners.forEach((l) => l(next));
  }

  canClaimDaily(): boolean {
    return this.data.ready && this.data.lastDaily !== dayKey();
  }

  refillAt(): number | null {
    const since = this.data.ready ? this.data.brokeSince : null;
    return since ? since + REFILL_MS : null;
  }

  isVip(): boolean {
    return isOwner() || (!!this.data.vipUntil && this.data.vipUntil > Date.now());
  }

  canClaimRefill(): boolean {
    const at = this.refillAt();
    return at !== null && Date.now() >= at;
  }

  adsLeftToday(): number {
    return this.data.adsDay === dayKey() ? Math.max(0, AD_DAILY_LIMIT - this.data.adsToday) : AD_DAILY_LIMIT;
  }
}

// ---- Sahip (kontrol) modu -------------------------------------------------
/**
 * Oyun sahibinin kendi cihazında bütün masaları denemesi için: VIP açık ve çip
 * hiç bitmez. Yalnızca bu cihazda (cihaz cüzdanı) geçerlidir; sunucu cüzdanını
 * etkilemez. Ana menüde sürüm yazısına 7 kez dokunarak açılıp kapanır.
 */
const OWNER_KEY = "wordokey.owner";
const OWNER_CHIPS = 10_000;
export function isOwner(): boolean {
  try {
    return localStorage.getItem(OWNER_KEY) === "1";
  } catch {
    return false;
  }
}
export function setOwner(on: boolean) {
  try {
    if (on) localStorage.setItem(OWNER_KEY, "1");
    else localStorage.removeItem(OWNER_KEY);
  } catch {
    /* yok say */
  }
  wallet.ownerTopUp?.();
}

// ---- Cihaz modu ---------------------------------------------------------
const KEY = "cinali.wallet";

class LocalWallet extends Base implements WalletApi {
  constructor() {
    super();
    let stored: Partial<WalletData> | null = null;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) stored = JSON.parse(raw);
    } catch {
      /* yok say */
    }
    this.data = {
      balance: stored?.balance ?? WELCOME_CHIPS,
      lastDaily: stored?.lastDaily ?? null,
      adsDay: stored?.adsDay ?? null,
      adsToday: stored?.adsToday ?? 0,
      brokeSince: stored?.brokeSince ?? null,
      vipUntil: stored?.vipUntil ?? null,
      ready: true,
      welcome: !stored,
    };
    const since = nextBrokeSince(this.data.balance, this.data.brokeSince);
    if (stored && since !== this.data.brokeSince) this.commit(0, { brokeSince: since });
    // Yeni cüzdan hemen kaydedilir (hediye bir kez verilir)
    if (!stored) {
      try {
        const { balance, lastDaily, adsDay, adsToday } = this.data;
        localStorage.setItem(KEY, JSON.stringify({ balance, lastDaily, adsDay, adsToday }));
      } catch {
        /* depolama yoksa oturum boyunca bellekte kalır */
      }
    }
  }

  private commit(amount: number, patch: Partial<WalletData> = {}) {
    const balance = this.data.balance + amount;
    const next = { ...this.data, ...patch, balance, brokeSince: nextBrokeSince(balance, this.data.brokeSince) };
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* depolama yoksa oturum boyunca bellekte kalır */
    }
    this.emit(next);
  }

  add(amount: number) {
    if (amount > 0) this.commit(amount);
  }

  /** Sahip modunda çip hiç bitmez. */
  ownerTopUp() {
    if (isOwner() && this.data.balance < OWNER_CHIPS) this.commit(OWNER_CHIPS - this.data.balance);
    else this.emit({ ...this.data });
  }

  spend(amount: number): boolean {
    if (isOwner() && amount > this.data.balance) this.ownerTopUp();
    if (amount > this.data.balance) return false;
    this.commit(-amount);
    return true;
  }

  async claimDaily() {
    if (!this.canClaimDaily()) throw Object.assign(new Error("dailyClaimed"), { code: "dailyClaimed", params: {} });
    this.commit(DAILY_BONUS, { lastDaily: dayKey() });
  }

  async subscribeVip() {
    const from = Math.max(Date.now(), this.data.vipUntil ?? 0);
    this.commit(VIP_BONUS_CHIPS, { vipUntil: from + VIP_MS });
  }

  async claimRefill() {
    if (!this.canClaimRefill()) throw Object.assign(new Error("refillNotReady"), { code: "refillNotReady", params: {} });
    this.commit(REFILL_CHIPS, { brokeSince: null });
  }

  async rewardAd() {
    const used = this.data.adsDay === dayKey() ? this.data.adsToday : 0;
    if (used >= AD_DAILY_LIMIT) throw Object.assign(new Error("adLimit"), { code: "adLimit", params: {} });
    this.commit(AD_REWARD, { adsDay: dayKey(), adsToday: used + 1 });
  }

  async purchase(chips: number) {
    this.commit(chips);
  }
}

// ---- Sunucu modu --------------------------------------------------------
class CloudWallet extends Base implements WalletApi {
  private started = false;

  /** Oturum açar, cüzdanı oluşturur (ilk seferde hoş geldin çipi) ve canlı dinlemeye başlar. */
  start(name = "") {
    if (this.started) return;
    this.started = true;
    currentUser()
      .then(async (user) => {
        const res = (await call("bootstrap", { name })) as { welcome?: boolean } | undefined;
        const welcome = !!res?.welcome;
        onSnapshot(doc(firestore(), "wallets", user.uid), (snap) => {
          const d = snap.data();
          if (!d) return;
          this.emit({ balance: d.balance, lastDaily: d.lastDaily ?? null, adsDay: d.adsDay ?? null, adsToday: d.adsToday ?? 0, brokeSince: d.brokeSince ?? null, vipUntil: d.vipUntil ?? null, ready: true, welcome });
        });
      })
      .catch(() => {
        this.started = false; // bir sonraki denemede tekrar dene
      });
  }

  async claimDaily() {
    await call("claimDaily");
  }

  async claimRefill() {
    await call("claimRefill");
  }

  async subscribeVip() {
    // Gerçek abonelik mağaza doğrulamasıyla sunucuda işlenecek (RevenueCat).
    await call("testSubscribeVip");
  }

  async rewardAd() {
    await call("rewardAd");
  }

  async purchase(chips: number, productId: string) {
    // Gerçek satın almalar mağaza doğrulamasıyla sunucuda işlenecek (RevenueCat).
    await call("testPurchase", { chips, productId });
  }

  spend(): boolean {
    throw new Error("Sunucu modunda masa ücretini sunucu alır");
  }

  add() {
    throw new Error("Sunucu modunda çipleri sunucu ekler");
  }
}

export const wallet: WalletApi & { start?: (name?: string) => void; ownerTopUp?: () => void } = CLOUD ? new CloudWallet() : new LocalWallet();
