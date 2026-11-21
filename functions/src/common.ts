import { getApps, initializeApp } from "firebase-admin/app";
import { Firestore, Transaction, getFirestore } from "firebase-admin/firestore";
import { setGlobalOptions } from "firebase-functions/v2";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import type { TxReason } from "../../src/economy/config";

// Frankfurt: Türkiye ve Avrupa'ya yakın. Fonksiyonlar tanımlanmadan ÖNCE ayarlanmalı.
export const REGION = "europe-west3";
setGlobalOptions({ region: REGION, maxInstances: 20 });

if (!getApps().length) initializeApp();
export const db: Firestore = getFirestore();

export const IS_EMULATOR = process.env.FUNCTIONS_EMULATOR === "true";

/**
 * İstemciye giden hata: code bir çeviri anahtarıdır (err.*), params yer tutucular.
 * İstemci HttpsError.details içinden okuyup kendi dilinde gösterir.
 */
export function fail(code: string, params: Record<string, string | number> = {}, kind: "failed-precondition" | "invalid-argument" | "permission-denied" | "not-found" | "resource-exhausted" = "failed-precondition"): never {
  throw new HttpsError(kind, code, { code, params });
}

export function uidOf(req: CallableRequest<unknown>): string {
  if (!req.auth) throw new HttpsError("unauthenticated", "signIn", { code: "signIn", params: {} });
  return req.auth.uid;
}

export interface WalletDoc {
  balance: number;
  lastDaily: string | null;
  adsDay: string | null;
  adsToday: number;
  createdAt: number;
}

export const walletRef = (uid: string) => db.collection("wallets").doc(uid);

/** Bakiyeyi değiştirir ve hesap hareketi kaydeder (işlem/transaction içinde). */
export function applyTx(
  t: Transaction,
  uid: string,
  wallet: WalletDoc,
  amount: number,
  reason: TxReason,
  note: string | null = null,
  patch: Partial<WalletDoc> = {},
): WalletDoc {
  const next = { ...wallet, ...patch, balance: wallet.balance + amount };
  if (next.balance < 0) fail("notEnoughChips", { need: -amount, have: wallet.balance });
  t.set(walletRef(uid), next);
  t.create(walletRef(uid).collection("tx").doc(), { at: Date.now(), amount, reason, note, balance: next.balance });
  return next;
}
