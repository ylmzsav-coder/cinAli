/**
 * Hesabı silme (profil > Ayarlar > "Word Okey hesabını sil").
 *
 * Silinenler: kullanıcı belgesi ve alt koleksiyonları (arkadaşlar, istekler, davetler,
 * hediye sınırları), cüzdan ve alt koleksiyonları (çip hareketleri, hediyeler),
 * arkadaşların listesindeki kayıt ve giriş hesabı (Firebase Auth).
 * Yasal saklama yükümlülüğü olan sohbet ve ihlal kayıtları (chatLogs, moderation)
 * süreleri dolana kadar kalır.
 */
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { onCall } from "firebase-functions/v2/https";
import { IS_EMULATOR, db, fail, uidOf } from "./common";

export const deleteAccount = onCall(async (req) => {
  const uid = uidOf(req);
  const userRef = db.collection("users").doc(uid);
  const user = (await userRef.get()).data() ?? {};
  // Oynanan bir masadan önce çıkılmalı (masadaki diğer oyuncular etkilenmesin)
  if (user.activeTable) {
    const st = (await db.collection("tables").doc(user.activeTable as string).get()).data()?.status;
    if (st === "waiting" || st === "playing") fail("leaveTableFirst");
  }
  const friends = await userRef.collection("friends").get();
  const batch = db.batch();
  for (const f of friends.docs) batch.delete(db.collection("users").doc(f.id).collection("friends").doc(uid));
  await batch.commit();
  await db.recursiveDelete(userRef);
  await db.recursiveDelete(db.collection("wallets").doc(uid));
  await db.collection("deletedAccounts").doc(uid).set({ at: FieldValue.serverTimestamp() });
  try {
    await getAuth().deleteUser(uid);
  } catch (e) {
    if (!IS_EMULATOR) throw e;
  }
  return { ok: true };
});
