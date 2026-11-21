/**
 * Çip cüzdanı. İki uygulaması var, arayüz aynı:
 *  - Sunucu (Firebase yapılandırılmışsa): bakiye yalnızca Cloud Functions
 *    tarafından değişir; istemci kendi cüzdan belgesini canlı dinler.
 *  - Cihaz (Firebase yoksa): localStorage. Yalnızca geliştirme/önizleme için;
 *    gerçek parayla satış sunucu modunda yapılır.
 */
import { doc, onSnapshot } from "firebase/firestore";
import { CLOUD, call, currentUser, firestore } from "../online/cloud";
import { AD_DAILY_LIMIT, AD_REWARD, DAILY_BONUS, TxReason, WELCOME_CHIPS, dayKey } from "./config";

export { AD_DAILY_LIMIT, AD_REWARD, DAILY_BONUS, WELCOME_CHIPS };
export type { TxReason };

export interface WalletData {
  balance: number;
  lastDaily: string | null;
  adsDay: string | null;
  adsToday: number;
  /** Sunucu modunda ilk veri geldi mi. */
  ready: boolean;
}

type Listener = (d: WalletData) => void;

export interface WalletApi {
  readonly snapshot: WalletData;
  subscribe(fn: Listener): () => void;
  canClaimDaily(): boolean;
  adsLeftToday(): number;
  /** Hata durumunda kodlu hata fırlatır (err.*). */
  claimDaily(): Promise<void>;
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

  adsLeftToday(): number {
    return this.data.adsDay === dayKey() ? Math.max(0, AD_DAILY_LIMIT - this.data.adsToday) : AD_DAILY_LIMIT;
  }
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
      ready: true,
    };
  }

  private commit(amount: number, patch: Partial<WalletData> = {}) {
    const next = { ...this.data, ...patch, balance: this.data.balance + amount };
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

  spend(amount: number): boolean {
    if (amount > this.data.balance) return false;
    this.commit(-amount);
    return true;
  }

  async claimDaily() {
    if (!this.canClaimDaily()) throw Object.assign(new Error("dailyClaimed"), { code: "dailyClaimed", params: {} });
    this.commit(DAILY_BONUS, { lastDaily: dayKey() });
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
        await call("bootstrap", { name });
        onSnapshot(doc(firestore(), "wallets", user.uid), (snap) => {
          const d = snap.data();
          if (!d) return;
          this.emit({ balance: d.balance, lastDaily: d.lastDaily ?? null, adsDay: d.adsDay ?? null, adsToday: d.adsToday ?? 0, ready: true });
        });
      })
      .catch(() => {
        this.started = false; // bir sonraki denemede tekrar dene
      });
  }

  async claimDaily() {
    await call("claimDaily");
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

export const wallet: WalletApi & { start?: (name?: string) => void } = CLOUD ? new CloudWallet() : new LocalWallet();
