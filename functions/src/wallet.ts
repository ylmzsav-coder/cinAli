import { onCall } from "firebase-functions/v2/https";
import { AD_DAILY_LIMIT, AD_REWARD, DAILY_BONUS, REFILL_CHIPS, REFILL_MS, VIP_BONUS_CHIPS, VIP_MS, WELCOME_CHIPS, dayKey } from "../../src/economy/config";
import { IS_EMULATOR, WalletDoc, applyTx, db, fail, uidOf, walletRef } from "./common";
import { cleanName } from "./profanity";

/** İstemcinin gördüğü kumbara (sunucu saatine göre günlük durumlar dahil). */
function view(w: WalletDoc) {
  const today = dayKey();
  return {
    balance: w.balance,
    canClaimDaily: w.lastDaily !== today,
    adsLeftToday: w.adsDay === today ? Math.max(0, AD_DAILY_LIMIT - w.adsToday) : AD_DAILY_LIMIT,
  };
}

/** Oturum açan kullanıcı için kumbarayı oluşturur (ilk seferde hoş geldin çipi). Tekrar çağrılabilir. */
export const bootstrap = onCall(async (req) => {
  const uid = uidOf(req);
  const name = typeof req.data?.name === "string" && req.data.name.trim() ? cleanName(req.data.name, uid, "en") : "";
  return db.runTransaction(async (t) => {
    const snap = await t.get(walletRef(uid));
    let w = snap.data() as WalletDoc | undefined;
    const created = !w;
    if (!w) {
      const empty: WalletDoc = { balance: 0, lastDaily: null, adsDay: null, adsToday: 0, createdAt: Date.now() };
      w = applyTx(t, uid, empty, WELCOME_CHIPS, "hosgeldin");
      t.set(db.collection("users").doc(uid), { name, createdAt: Date.now() });
    }
    return { ...view(w), welcome: created };
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

/** Çipi biten oyuncuya hediye: bakiye en ucuz masa girişinin altına düştükten 12 saat sonra. */
export const claimRefill = onCall(async (req) => {
  const uid = uidOf(req);
  return db.runTransaction(async (t) => {
    const w = (await t.get(walletRef(uid))).data() as WalletDoc | undefined;
    if (!w) return fail("noWallet");
    if (!w.brokeSince || Date.now() < w.brokeSince + REFILL_MS) fail("refillNotReady");
    return view(applyTx(t, uid, w, REFILL_CHIPS, "destek", null, { brokeSince: null }));
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
  if (![1_000, 5_000, 15_000, 30_000, 50_000, 100_000].includes(chips)) fail("badRequest", {}, "invalid-argument");
  return db.runTransaction(async (t) => {
    const w = (await t.get(walletRef(uid))).data() as WalletDoc | undefined;
    if (!w) return fail("noWallet");
    return view(applyTx(t, uid, w, chips, "satin-alma", String(req.data?.productId ?? "")));
  });
});

/** Test VIP aboneliği: yalnızca emülatörde. Gerçek abonelik RevenueCat web kancasıyla gelecek. */
/** Yalnızca emülatörde: başarı oranı testleri için oyuncunun oyun sayılarını ayarlar. */
/** Yalnızca emülatör testleri: kumbarayı ve "çipi bitti" anını ayarlar (12 saatlik bekleme testi). */
export const testSetWallet = onCall(async (req) => {
  const uid = uidOf(req);
  if (!IS_EMULATOR) fail("storeSoon");
  const patch: Record<string, number | null> = {};
  if (typeof req.data?.balance === "number") patch.balance = Math.max(0, Math.floor(req.data.balance));
  if (typeof req.data?.brokeHoursAgo === "number") patch.brokeSince = Date.now() - req.data.brokeHoursAgo * 3_600_000;
  await walletRef(uid).set(patch, { merge: true });
  return { ok: true };
});

export const testSetStats = onCall(async (req) => {
  const uid = uidOf(req);
  if (!IS_EMULATOR) fail("storeSoon");
  const played = Math.max(0, Math.floor(Number(req.data?.played ?? 0)));
  const won = Math.min(played, Math.max(0, Math.floor(Number(req.data?.won ?? 0))));
  await db.collection("users").doc(uid).set({ gamesPlayed: played, gamesWon: won }, { merge: true });
  return { ok: true };
});

export const testSubscribeVip = onCall(async (req) => {
  const uid = uidOf(req);
  if (!IS_EMULATOR) fail("storeSoon");
  return db.runTransaction(async (t) => {
    const w = (await t.get(walletRef(uid))).data() as WalletDoc | undefined;
    if (!w) return fail("noWallet");
    const from = Math.max(Date.now(), w.vipUntil ?? 0);
    return view(applyTx(t, uid, w, VIP_BONUS_CHIPS, "vip", "wordokey_vip_haftalik", { vipUntil: from + VIP_MS }));
  });
});
