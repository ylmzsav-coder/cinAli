/**
 * Çip cüzdanı.
 *
 * ŞİMDİLİK cihazda (localStorage) tutulur. Gerçek parayla çip satışı
 * başlamadan önce bakiye sunucuya (Firebase) taşınacak; aksi hâlde
 * uygulama silinince satın alınan çipler kaybolur ve bakiye hileyle
 * değiştirilebilir. Arayüz bu yüzden tek bir modül üzerinden konuşur.
 */

import { AD_DAILY_LIMIT, AD_REWARD, DAILY_BONUS, TxReason, WELCOME_CHIPS, dayKey } from "./config";

export { AD_DAILY_LIMIT, AD_REWARD, DAILY_BONUS, WELCOME_CHIPS };
export type { TxReason };

export interface Tx {
  at: number;
  amount: number;
  reason: TxReason;
  note?: string;
}

export interface WalletData {
  balance: number;
  lastDaily: string | null;
  adsDay: string | null;
  adsToday: number;
  history: Tx[];
}

const KEY = "cinali.wallet";
const today = () => dayKey();

function load(): WalletData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as WalletData;
  } catch {
    /* yok say */
  }
  return {
    balance: WELCOME_CHIPS,
    lastDaily: null,
    adsDay: null,
    adsToday: 0,
    history: [{ at: Date.now(), amount: WELCOME_CHIPS, reason: "hosgeldin" }],
  };
}

function save(d: WalletData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* depolama yoksa oturum boyunca bellekte kalır */
  }
}

type Listener = (d: WalletData) => void;

class Wallet {
  private data = load();
  private listeners = new Set<Listener>();

  get snapshot(): WalletData {
    return this.data;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private commit(amount: number, reason: TxReason, note?: string, patch: Partial<WalletData> = {}) {
    const history = [{ at: Date.now(), amount, reason, note }, ...this.data.history].slice(0, 100);
    this.data = { ...this.data, ...patch, balance: this.data.balance + amount, history };
    save(this.data);
    this.listeners.forEach((l) => l(this.data));
  }

  add(amount: number, reason: TxReason, note?: string) {
    if (amount > 0) this.commit(amount, reason, note);
  }

  /** Yetersiz bakiyede false döner. */
  spend(amount: number, reason: TxReason, note?: string): boolean {
    if (amount > this.data.balance) return false;
    this.commit(-amount, reason, note);
    return true;
  }

  canClaimDaily(): boolean {
    return this.data.lastDaily !== today();
  }

  claimDaily(): boolean {
    if (!this.canClaimDaily()) return false;
    this.commit(DAILY_BONUS, "gunluk", undefined, { lastDaily: today() });
    return true;
  }

  adsLeftToday(): number {
    return this.data.adsDay === today() ? AD_DAILY_LIMIT - this.data.adsToday : AD_DAILY_LIMIT;
  }

  rewardAd(): boolean {
    const left = this.adsLeftToday();
    if (left <= 0) return false;
    const used = this.data.adsDay === today() ? this.data.adsToday : 0;
    this.commit(AD_REWARD, "reklam", undefined, { adsDay: today(), adsToday: used + 1 });
    return true;
  }
}

export const wallet = new Wallet();
