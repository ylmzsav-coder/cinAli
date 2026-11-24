/**
 * Arkadaşlar, çevrimiçi durumu ve masa izleme.
 *
 * Firestore:
 *  users/{uid}                  { name, activeTable, lastSeen }
 *  users/{uid}/friends/{fid}    { name, since }       (iki tarafa da sunucu yazar)
 *  users/{uid}/requests/{from}  { name, at }          (bekleyen arkadaşlık isteği)
 */
import { assertNotBanned } from "./admin";
import { blockedEither } from "./blocks";
import { FieldValue } from "firebase-admin/firestore";
import { onCall } from "firebase-functions/v2/https";
import { db, fail, uidOf } from "./common";
import { cleanName } from "./profanity";

/** Son görülme bundan yeniyse çevrimiçi sayılır (istemci dakikada bir bildirir). */
export const ONLINE_MS = 2.5 * 60_000;
/** Bir masayı aynı anda izleyebilecek en fazla kişi. */

const userRef = (uid: string) => db.collection("users").doc(uid);
const friendRef = (uid: string, fid: string) => userRef(uid).collection("friends").doc(fid);
const requestRef = (uid: string, from: string) => userRef(uid).collection("requests").doc(from);
const tableRef = (id: string) => db.collection("tables").doc(id);

const str = (v: unknown, max = 128) => (typeof v === "string" ? v.slice(0, max) : "");

/** Uygulama açıkken dakikada bir: çevrimiçi durumu ve görünen ad. */
export const heartbeat = onCall(async (req) => {
  const uid = uidOf(req);
  const patch: Record<string, unknown> = { lastSeen: Date.now() };
  const raw = str(req.data?.name, 40);
  if (raw.trim()) patch.name = cleanName(raw, uid, "en");
  // Profil ayarı: arkadaşlardan oyun daveti alınsın mı
  if (typeof req.data?.invites === "boolean") patch.allowInvites = req.data.invites;
  // Yaş beyanı: 18 yaşından küçükler VIP Oda'ya (serbest sohbet) giremez
  if (typeof req.data?.adult === "boolean") patch.adult = req.data.adult;
  await userRef(uid).set(patch, { merge: true });
  return { ok: true };
});

/**
 * Arkadaş ekle (tek taraflı): oyuncu istediği kişiyi kendi arkadaş listesine kaydeder.
 * Eklenen kişiye istek ya da bildirim gitmez, haberi olmaz; kendi listesi değişmez.
 * (İşlev adı eski sürümlerle uyum için aynı kaldı.)
 */
export const sendFriendRequest = onCall(async (req) => {
  const uid = uidOf(req);
  await assertNotBanned(uid);
  const target = str(req.data?.targetUid);
  if (!target || target === uid) fail("badRequest", {}, "invalid-argument");
  return db.runTransaction(async (t) => {
    const [them, already] = await Promise.all([t.get(userRef(target)), t.get(friendRef(uid, target))]);
    if (!them.exists) return fail("userNotFound", {}, "not-found");
    if (await blockedEither(uid, target, t)) fail("blocked", {}, "permission-denied");
    if (already.exists) return { status: "friends" };
    t.set(friendRef(uid, target), { name: (them.data()?.name as string) || "?", since: Date.now() });
    // Eski sürümden kalan bekleyen istekler temizlenir
    t.delete(requestRef(uid, target));
    t.delete(requestRef(target, uid));
    return { status: "friends" };
  });
});

/** Gelen isteği kabul ya da reddet. */
export const respondFriendRequest = onCall(async (req) => {
  const uid = uidOf(req);
  const from = str(req.data?.fromUid);
  const accept = req.data?.accept === true;
  if (!from) fail("badRequest", {}, "invalid-argument");
  return db.runTransaction(async (t) => {
    const [r, me] = await Promise.all([t.get(requestRef(uid, from)), t.get(userRef(uid))]);
    if (!r.exists) return { status: "none" };
    t.delete(r.ref);
    if (!accept) return { status: "declined" };
    const now = Date.now();
    t.set(friendRef(uid, from), { name: r.data()!.name ?? "?", since: now });
    t.set(friendRef(from, uid), { name: (me.data()?.name as string) || "?", since: now });
    return { status: "friends" };
  });
});

/** Arkadaş listesinden çıkar (yalnızca kendi listenden; karşı tarafa haber gitmez). */
export const removeFriend = onCall(async (req) => {
  const uid = uidOf(req);
  const fid = str(req.data?.friendUid);
  if (!fid) fail("badRequest", {}, "invalid-argument");
  await friendRef(uid, fid).delete();
  return { ok: true };
});

export interface FriendStatus {
  uid: string;
  name: string;
  online: boolean;
  tableStatus: "waiting" | "playing" | null;
  vipUntil: number | null;
}

/**
 * Arkadaş listesi ve durumları. Başkasının kullanıcı belgesi istemciye kapalı
 * olduğu için durumlar sunucuda toplanır.
 */
export const friendsStatus = onCall(async (req) => {
  const uid = uidOf(req);
  const [friends, requests, invites] = await Promise.all([
    userRef(uid).collection("friends").limit(200).get(),
    userRef(uid).collection("requests").orderBy("at", "desc").limit(50).get(),
    userRef(uid).collection("invites").orderBy("at", "desc").limit(10).get(),
  ]);
  const now = Date.now();
  const invTables = invites.empty ? [] : await db.getAll(...invites.docs.map((d) => tableRef(d.id)));
  const inviteTables = new Map(invTables.map((s) => [s.id, s.data()?.status as string | undefined]));
  const users = friends.empty ? [] : await db.getAll(...friends.docs.map((d) => userRef(d.id)));
  const wallets = friends.empty ? [] : await db.getAll(...friends.docs.map((d) => db.collection("wallets").doc(d.id)));
  const tableIds = [...new Set(users.map((u) => u.data()?.activeTable as string | undefined).filter((x): x is string => !!x))];
  const tables = tableIds.length ? await db.getAll(...tableIds.map(tableRef)) : [];
  const tableById = new Map(tables.map((s) => [s.id, s.data()]));
  const list: FriendStatus[] = friends.docs.map((d, i) => {
    const u = users[i]?.data() ?? {};
    const tid = (u.activeTable as string | undefined) ?? null;
    const tb = tid ? tableById.get(tid) : undefined;
    const st = tb?.status === "waiting" || tb?.status === "playing" ? (tb.status as "waiting" | "playing") : null;
    return {
      uid: d.id,
      name: (u.name as string) || (d.data().name as string) || "?",
      online: typeof u.lastSeen === "number" && now - u.lastSeen < ONLINE_MS,
      tableStatus: st,
      // VIP rozeti: üyelik sürüyorsa bitiş anı
      vipUntil: ((wallets[i]?.data()?.vipUntil as number | undefined) ?? 0) > now ? (wallets[i]!.data()!.vipUntil as number) : null,
    };
  });
  // Çevrimiçi olanlar ve masada oynayanlar önce
  list.sort((a, b) => Number(!!b.tableStatus) - Number(!!a.tableStatus) || Number(b.online) - Number(a.online) || a.name.localeCompare(b.name));
  return {
    friends: list,
    requests: requests.docs.map((r) => ({ uid: r.id, name: (r.data().name as string) || "?" })),
    // Geçerli masa davetleri: davet eden masa hâlâ açık (bekliyor) ve süre dolmadı.
    // Oyundaki arkadaşın daveti bekler; oyunu bitip menüye dönünce görür.
    invites: invites.docs
      .filter((d) => now - (d.data().at as number) < INVITE_MS && inviteTables.get(d.id) === "waiting")
      .map((d) => ({ tableId: d.id, name: d.data().name as string, code: d.data().code as string, type: d.data().type as string })),
  };
});


/** Masa daveti en fazla bu kadar geçerli (masa kapanınca daha önce düşer). */
export const INVITE_MS = 60 * 60_000;
const inviteRef = (uid: string, tableId: string) => userRef(uid).collection("invites").doc(tableId);

/**
 * Özel masadan arkadaşa doğrudan davet. VIP odada misafir abonelik şartı olmadan
 * ve ücretsiz oturur. Davet, arkadaşın profilinde ve ana menüsünde görünür.
 */
export const inviteFriend = onCall(async (req) => {
  const uid = uidOf(req);
  const id = str(req.data?.tableId);
  const fid = str(req.data?.friendUid);
  if (!id || !fid) fail("badRequest", {}, "invalid-argument");
  return db.runTransaction(async (t) => {
    const [tSnap, fSnap, me] = await Promise.all([t.get(tableRef(id)), t.get(friendRef(uid, fid)), t.get(userRef(uid))]);
    const table = tSnap.data();
    if (!table || !(table.uids as string[]).includes(uid)) return fail("notAtTable", {}, "permission-denied");
    if (!table.private || table.status !== "waiting" || !table.code) fail("notNow");
    if (!fSnap.exists) fail("notFriend", {}, "permission-denied");
    const target = await t.get(userRef(fid));
    if (target.data()?.allowInvites === false) fail("invitesOff");
    if (await blockedEither(uid, fid, t)) fail("blocked", {}, "permission-denied");
    t.set(inviteRef(fid, id), {
      fromUid: uid,
      name: (me.data()?.name as string) || "?",
      code: table.code,
      type: table.type,
      at: Date.now(),
    });
    // Davet eden, bekleme ekranında davetin durumunu görür (gönderildi / reddetti)
    t.update(tableRef(id), { [`invited.${fid}`]: (target.data()?.name as string) || "?", [`declined.${fid}`]: FieldValue.delete() });
    return { ok: true };
  });
});

/** Gelen masa davetini reddet. */
export const declineInvite = onCall(async (req) => {
  const uid = uidOf(req);
  const id = str(req.data?.tableId);
  if (!id) return { ok: true };
  await inviteRef(uid, id).delete();
  // Davet edene "reddetti" bilgisi (masa hâlâ bekliyorsa)
  const [tb, me] = await Promise.all([tableRef(id).get(), userRef(uid).get()]);
  if (tb.exists && tb.data()?.status === "waiting") {
    await tableRef(id).update({ [`declined.${uid}`]: (me.data()?.name as string) || "?" }).catch(() => {});
  }
  return { ok: true };
});

