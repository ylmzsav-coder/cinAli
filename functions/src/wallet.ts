import { onCall } from "firebase-functions/v2/https";
import { AD_DAILY_LIMIT, AD_REWARD, DAILY_BONUS, WELCOME_CHIPS, dayKey } from "../../src/economy/config";
import { IS_EMULATOR, WalletDoc, applyTx, db, fail, uidOf, walletRef } from "./common";

/** İstemcinin gördüğü cüzdan (sunucu saatine göre günlük durumlar dahil). */
function view(w: WalletDoc) {
  const today = dayKey();
  return {
    balance: w.balance,
    canClaimDaily: w.lastDaily !== today,
    adsLeftToday: w.adsDay === today ? Math.max(0, AD_DAILY_LIMIT - w.adsToday) : AD_DAILY_LIMIT,
  };
}

/** Oturum açan kullanıcı için cüzdanı oluşturur (ilk seferde hoş geldin çipi). Tekrar çağrılabilir. */
export const bootstrap = onCall(async (req) => {
  const uid = uidOf(req);
  const name = typeof req.data?.name === "string" ? req.data.name.trim().slice(0, 12) : "";
  return db.runTransaction(async (t) => {
    const snap = await t.get(walletRef(uid));
    let w = snap.data() as WalletDoc | undefined;
    if (!w) {
      const empty: WalletDoc = { balance: 0, lastDaily: null, adsDay: null, adsToday: 0, createdAt: Date.now() };
      w = applyTx(t, uid, empty, WELCOME_CHIPS, "hosgeldin");
      t.set(db.collection("users").doc(uid), { name, createdAt: Date.now() });
    }
    return view(w);
  });
});

export const claimDaily = onCall(async (req) => {
  const uid = uidOf(req);
  return db.runTransaction(async (t) => {
    const w = (await t.get(walletRef(uid))).data() as WalletDoc | undefined;
    if (!w) return fail("noWallet");
    if (w.lastDaily === dayKey()) fail("dailyClaimed");
    return view(applyTx(t, uid, w, DAILY_BONUS, "gunluk", null, { lastDaily: dayKey() }));
  });
});

/**
 * Ödüllü reklam. Gerçek yayında AdMob "sunucu tarafı doğrulama" (SSV) geri
 * çağrısıyla verilecek; o bağlanana kadar yalnızca emülatörde çalışır.
 */
export const rewardAd = onCall(async (req) => {
  const uid = uidOf(req);
  if (!IS_EMULATOR) fail("adsSoon");
  return db.runTransaction(async (t) => {
    const w = (await t.get(walletRef(uid))).data() as WalletDoc | undefined;
    if (!w) return fail("noWallet");
    const today = dayKey();
    const used = w.adsDay === today ? w.adsToday : 0;
    if (used >= AD_DAILY_LIMIT) fail("adLimit", {}, "resource-exhausted");
    return view(applyTx(t, uid, w, AD_REWARD, "reklam", null, { adsDay: today, adsToday: used + 1 }));
  });
});

/** Test satın alması: yalnızca emülatörde. Gerçek satın almalar RevenueCat web kancasıyla gelecek. */
export const testPurchase = onCall(async (req) => {
  const uid = uidOf(req);
  if (!IS_EMULATOR) fail("storeSoon");
  const chips = Number(req.data?.chips);
  if (![10_000, 50_000, 150_000, 500_000].includes(chips)) fail("badRequest", {}, "invalid-argument");
  return db.runTransaction(async (t) => {
    const w = (await t.get(walletRef(uid))).data() as WalletDoc | undefined;
    if (!w) return fail("noWallet");
    return view(applyTx(t, uid, w, chips, "satin-alma", String(req.data?.productId ?? "")));
  });
});
