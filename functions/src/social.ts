/**
 * Arkadaşlar, çevrimiçi durumu ve masa izleme.
 *
 * Firestore:
 *  users/{uid}                  { name, activeTable, lastSeen }
 *  users/{uid}/friends/{fid}    { name, since }       (iki tarafa da sunucu yazar)
 *  users/{uid}/requests/{from}  { name, at }          (bekleyen arkadaşlık isteği)
 *  tables/{id}.watchers         masayı izleyen arkadaşların uid listesi
 */
import { onCall } from "firebase-functions/v2/https";
import { db, fail, uidOf } from "./common";
import { cleanName } from "./profanity";
import { allowsWatchers } from "./tables";

/** Son görülme bundan yeniyse çevrimiçi sayılır (istemci dakikada bir bildirir). */
export const ONLINE_MS = 2.5 * 60_000;
/** Bir masayı aynı anda izleyebilecek en fazla kişi. */
export const MAX_WATCHERS = 30;

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
  await userRef(uid).set(patch, { merge: true });
  return { ok: true };
});

/** Masadaki oyuncuya arkadaşlık isteği gönderir; karşı taraf da istemişse hemen arkadaş olunur. */
export const sendFriendRequest = onCall(async (req) => {
  const uid = uidOf(req);
  const target = str(req.data?.targetUid);
  if (!target || target === uid) fail("badRequest", {}, "invalid-argument");
  return db.runTransaction(async (t) => {
    const [me, them, already, reverse] = await Promise.all([
      t.get(userRef(uid)),
      t.get(userRef(target)),
      t.get(friendRef(uid, target)),
      t.get(requestRef(uid, target)),
    ]);
    if (!them.exists) return fail("userNotFound", {}, "not-found");
    if (already.exists) return { status: "friends" };
    const myName = (me.data()?.name as string) || "?";
    const theirName = (them.data()?.name as string) || "?";
    const now = Date.now();
    if (reverse.exists) {
      // İki taraf da istedi: arkadaş olun
      t.set(friendRef(uid, target), { name: theirName, since: now });
      t.set(friendRef(target, uid), { name: myName, since: now });
      t.delete(reverse.ref);
      return { status: "friends" };
    }
    t.set(requestRef(target, uid), { name: myName, at: now });
    return { status: "sent" };
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

/** Arkadaşlıktan çıkar (iki taraftan da silinir). */
export const removeFriend = onCall(async (req) => {
  const uid = uidOf(req);
  const fid = str(req.data?.friendUid);
  if (!fid) fail("badRequest", {}, "invalid-argument");
  const batch = db.batch();
  batch.delete(friendRef(uid, fid));
  batch.delete(friendRef(fid, uid));
  await batch.commit();
  return { ok: true };
});

export interface FriendStatus {
  uid: string;
  name: string;
  online: boolean;
  /** Oynadığı (izlenebilir) masa. */
  tableId: string | null;
  tableStatus: "waiting" | "playing" | null;
  watchers: number;
}

/**
 * Arkadaş listesi ve durumları. Başkasının kullanıcı belgesi istemciye kapalı
 * olduğu için durumlar sunucuda toplanır.
 */
export const friendsStatus = onCall(async (req) => {
  const uid = uidOf(req);
  const [friends, requests] = await Promise.all([
    userRef(uid).collection("friends").limit(200).get(),
    userRef(uid).collection("requests").orderBy("at", "desc").limit(50).get(),
  ]);
  const now = Date.now();
  const users = friends.empty ? [] : await db.getAll(...friends.docs.map((d) => userRef(d.id)));
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
      tableId: st && allowsWatchers(tb?.type as string) ? tid : null,
      tableStatus: st,
      watchers: st ? ((tb?.watchers as string[] | undefined) ?? []).length : 0,
    };
  });
  // Çevrimiçi olanlar ve masada oynayanlar önce
  list.sort((a, b) => Number(!!b.tableId) - Number(!!a.tableId) || Number(b.online) - Number(a.online) || a.name.localeCompare(b.name));
  return {
    friends: list,
    requests: requests.docs.map((r) => ({ uid: r.id, name: (r.data().name as string) || "?" })),
  };
});

/** Arkadaşının masasını izleyici olarak açar (yalnızca masada oturan bir arkadaş varsa). */
export const watchTable = onCall(async (req) => {
  const uid = uidOf(req);
  const id = str(req.data?.tableId);
  if (!id) fail("badRequest", {}, "invalid-argument");
  return db.runTransaction(async (t) => {
    const snap = await t.get(tableRef(id));
    if (!snap.exists) return fail("tableNotFound", {}, "not-found");
    const table = snap.data()!;
    if (table.status !== "playing" && table.status !== "waiting") fail("tableOver");
    if (!allowsWatchers(table.type as string)) fail("noWatchersVip", {}, "permission-denied");
    const uids = (table.uids as string[]) ?? [];
    if (uids.includes(uid)) return { ok: true, seated: true };
    const friendSnaps = await Promise.all(uids.map((u) => t.get(friendRef(uid, u))));
    if (!friendSnaps.some((s) => s.exists)) fail("notFriendTable", {}, "permission-denied");
    const watchers = ((table.watchers as string[] | undefined) ?? []).filter((w) => w !== uid);
    if (watchers.length >= MAX_WATCHERS) fail("tooManyWatchers");
    t.update(tableRef(id), { watchers: [...watchers, uid] });
    return { ok: true, seated: false };
  });
});

/** İzlemeyi bırak. */
export const stopWatching = onCall(async (req) => {
  const uid = uidOf(req);
  const id = str(req.data?.tableId);
  if (!id) return { ok: true };
  await db.runTransaction(async (t) => {
    const snap = await t.get(tableRef(id));
    if (!snap.exists) return;
    const watchers = ((snap.data()!.watchers as string[] | undefined) ?? []).filter((w) => w !== uid);
    t.update(tableRef(id), { watchers });
  });
  return { ok: true };
});
