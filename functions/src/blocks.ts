/**
 * Oyuncu engelleme (mağaza kuralları: kullanıcı içeriği olan uygulamada engelleme zorunlu).
 *
 *  users/{uid}/blocks/{target}  { name, at }
 *
 * Engellenen oyuncu: sana arkadaşlık isteği, masa daveti ve hediye gönderemez;
 * rastgele eşleşmede aynı masaya oturtulmazsınız; masadaysanız mesajları sana görünmez.
 * Engelleme karşılıklı arkadaşlığı ve bekleyen istekleri siler. Engelleyen kimse ona bildirilmez.
 */
import { onCall } from "firebase-functions/v2/https";
import type { Transaction } from "firebase-admin/firestore";
import { db, fail, uidOf } from "./common";

const userRef = (uid: string) => db.collection("users").doc(uid);
export const blockRef = (uid: string, target: string) => userRef(uid).collection("blocks").doc(target);
const str = (v: unknown, max = 128) => (typeof v === "string" ? v.slice(0, max) : "");

/** a ile b arasında herhangi bir yönde engel var mı. */
export async function blockedEither(a: string, b: string, t?: Transaction): Promise<boolean> {
  const get = (r: FirebaseFirestore.DocumentReference) => (t ? t.get(r) : r.get());
  const [x, y] = await Promise.all([get(blockRef(a, b)), get(blockRef(b, a))]);
  return x.exists || y.exists;
}

/** uid'in engellediği ya da uid'i engellemiş oyuncular arasında bu uid'lerden biri var mı. */
export async function blockedWithAny(uid: string, others: string[], t?: Transaction): Promise<boolean> {
  for (const o of others) if (o && o !== uid && (await blockedEither(uid, o, t))) return true;
  return false;
}

export const blockPlayer = onCall(async (req) => {
  const uid = uidOf(req);
  const target = str(req.data?.targetUid);
  if (!target || target === uid) fail("badRequest", {}, "invalid-argument");
  const name = str(req.data?.name, 24) || "?";
  const batch = db.batch();
  batch.set(blockRef(uid, target), { name, at: Date.now() });
  batch.delete(userRef(uid).collection("friends").doc(target));
  batch.delete(userRef(target).collection("friends").doc(uid));
  batch.delete(userRef(uid).collection("requests").doc(target));
  batch.delete(userRef(target).collection("requests").doc(uid));
  const invites = await userRef(uid).collection("invites").where("fromUid", "==", target).get();
  for (const d of invites.docs) batch.delete(d.ref);
  await batch.commit();
  return { ok: true };
});

export const unblockPlayer = onCall(async (req) => {
  const uid = uidOf(req);
  const target = str(req.data?.targetUid);
  if (!target) fail("badRequest", {}, "invalid-argument");
  await blockRef(uid, target).delete();
  return { ok: true };
});

/** Engellediğin oyuncuların listesi (Ayarlar). */
export const blockedList = onCall(async (req) => {
  const uid = uidOf(req);
  const snap = await userRef(uid).collection("blocks").orderBy("at", "desc").limit(200).get();
  return { blocked: snap.docs.map((d) => ({ uid: d.id, name: (d.data().name as string) || "?" })) };
});
