/**
 * Hediyeler: oyuncu çiple hediye alıp arkadaşına ya da masadaki oyuncuya gönderir;
 * alan oyuncu hediyeyi saklar ya da değerinin %80'ine çipe dönüştürür.
 *
 * Firestore:
 *  users/{uid}/gifts/{id}  { giftId, value, fromUid, fromName, at, converted }
 */
import { FieldValue } from "firebase-admin/firestore";
import { onCall } from "firebase-functions/v2/https";
import { convertValue, giftById, isGiftForSale } from "../../src/economy/gifts";
import { WalletDoc, applyTx, db, fail, uidOf, walletRef } from "./common";

const userRef = (uid: string) => db.collection("users").doc(uid);
const str = (v: unknown) => (typeof v === "string" ? v.slice(0, 128) : "");

/** Aynı kişiye 24 saatte en fazla bu kadar hediye (hediye yoluyla çip aktarımını sınırlar). */
export const GIFT_LIMIT_PER_PERSON = 3;
const GIFT_WINDOW_MS = 24 * 3_600_000;

/** Hediye gönder: çip göndericiden düşülür, hediye alıcının kutusuna eklenir. */
export const sendGift = onCall(async (req) => {
  const uid = uidOf(req);
  const to = str(req.data?.toUid);
  const gift = isGiftForSale(str(req.data?.giftId)) ? giftById(str(req.data?.giftId)) : undefined;
  const tableId = str(req.data?.tableId);
  if (!gift || !to || to === uid) fail("badRequest", {}, "invalid-argument");
  return db.runTransaction(async (t) => {
    const limitRef = userRef(uid).collection("giftLimits").doc(to);
    const [me, them, friend, w, tb, lim] = await Promise.all([
      t.get(userRef(uid)),
      t.get(userRef(to)),
      t.get(userRef(uid).collection("friends").doc(to)),
      t.get(walletRef(uid)),
      tableId ? t.get(db.collection("tables").doc(tableId)) : Promise.resolve(null),
      t.get(limitRef),
    ]);
    if (!them.exists) return fail("userNotFound", {}, "not-found");
    // Arkadaşa ya da aynı masada oturan oyuncuya gönderilebilir
    const uids = (tb?.data()?.uids as string[] | undefined) ?? [];
    const sameTable = !!tb?.exists && uids.includes(uid) && uids.includes(to);
    if (!friend.exists && !sameTable) fail("giftNotAllowed", {}, "permission-denied");
    // Aynı kişiye son 24 saatte en fazla 3 hediye (farklı kişilere sınır yok)
    const now = Date.now();
    const recent = ((lim.data()?.times as number[] | undefined) ?? []).filter((x) => now - x < GIFT_WINDOW_MS);
    if (recent.length >= GIFT_LIMIT_PER_PERSON) {
      const hours = Math.max(1, Math.ceil((Math.min(...recent) + GIFT_WINDOW_MS - now) / 3_600_000));
      fail("giftLimit", { n: GIFT_LIMIT_PER_PERSON, h: hours }, "resource-exhausted");
    }
    const wallet = w.data() as WalletDoc | undefined;
    if (!wallet) return fail("noWallet");
    if (wallet.balance < gift!.value) fail("notEnoughChips", { need: gift!.value, have: wallet.balance });
    applyTx(t, uid, wallet, -gift!.value, "hediye-gonder", `${gift!.id}→${to}`);
    t.set(limitRef, { times: [...recent, now] });
    const fromName = (me.data()?.name as string) || "?";
    t.create(userRef(to).collection("gifts").doc(), {
      giftId: gift!.id, value: gift!.value, fromUid: uid, fromName, at: Date.now(), converted: false,
    });
    // Masada gönderildiyse herkes görsün
    if (sameTable) {
      t.create(db.collection("tables").doc(tableId).collection("chat").doc(), {
        uid, kind: "gift", id: `${gift!.id}:${to}`, at: FieldValue.serverTimestamp(),
      });
    }
    return { ok: true };
  });
});

/** Gelen hediyeyi çipe dönüştür (değerin %80'i). */
export const convertGift = onCall(async (req) => {
  const uid = uidOf(req);
  const id = str(req.data?.id);
  if (!id) fail("badRequest", {}, "invalid-argument");
  return db.runTransaction(async (t) => {
    const ref = userRef(uid).collection("gifts").doc(id);
    const [g, w] = await Promise.all([t.get(ref), t.get(walletRef(uid))]);
    if (!g.exists) return fail("giftNotFound", {}, "not-found");
    const data = g.data()!;
    if (data.converted) fail("giftConverted");
    const wallet = w.data() as WalletDoc | undefined;
    if (!wallet) return fail("noWallet");
    const chips = convertValue({ value: data.value as number });
    applyTx(t, uid, wallet, chips, "hediye-cip", String(data.giftId));
    t.update(ref, { converted: true, convertedAt: Date.now() });
    return { ok: true, chips };
  });
});
