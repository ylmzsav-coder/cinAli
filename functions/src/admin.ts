/**
 * Yönetici paneli işlevleri.
 *
 * Yönetici olmak için (Firebase konsolundan, bir kez):
 *   Firestore > config/admins belgesi > alan "uids" (dizi) içine kendi hesap kimliğini (uid) ekle.
 *   Kimliğini yönetici panelini açınca görürsün.
 *
 * Yönetici; yasa dışı içerik kayıtlarını (moderation), şikâyetleri (reports) ve
 * incelemedeki hesapları görür, bir oyuncunun sohbet kaydını okur, hesabı
 * kalıcı olarak engeller ya da engeli kaldırır.
 */
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { onCall, type CallableRequest } from "firebase-functions/v2/https";
import { db, fail, uidOf } from "./common";

export async function isAdmin(uid: string, req?: CallableRequest<unknown>): Promise<boolean> {
  if (req?.auth?.token?.admin === true) return true;
  const doc = await db.collection("config").doc("admins").get();
  return ((doc.data()?.uids as string[] | undefined) ?? []).includes(uid);
}

async function requireAdmin(req: CallableRequest<unknown>): Promise<string> {
  const uid = uidOf(req);
  if (!(await isAdmin(uid, req))) fail("adminOnly", { uid }, "permission-denied");
  return uid;
}

/** Hesap kalıcı olarak engelli mi (masaya oturma, sohbet, hediye, arkadaşlık kapalı). */
export async function assertNotBanned(uid: string) {
  const u = (await db.collection("users").doc(uid).get()).data();
  if (u?.banned) fail("accountBanned", {}, "permission-denied");
}

const ms = (v: unknown): number | null => (v instanceof Timestamp ? v.toMillis() : typeof v === "number" ? v : null);
const str = (v: unknown, n = 64) => String(v ?? "").slice(0, n);

/** Kendi kimliğini ve yönetici olup olmadığını döndürür (panel ilk açılışta çağırır). */
export const adminWhoAmI = onCall(async (req) => {
  const uid = uidOf(req);
  return { uid, admin: await isAdmin(uid, req) };
});

/** Açık ihlal kayıtları, açık şikâyetler, incelemedeki ve engelli hesaplar. */
export const adminOverview = onCall(async (req) => {
  await requireAdmin(req);
  const [mods, reports, review, banned] = await Promise.all([
    db.collection("moderation").where("status", "==", "open").orderBy("at", "desc").limit(100).get(),
    db.collection("reports").where("status", "==", "open").orderBy("at", "desc").limit(50).get(),
    db.collection("users").where("modReview", "==", true).limit(100).get(),
    db.collection("users").where("banned", "==", true).limit(200).get(),
  ]);
  const user = (d: FirebaseFirestore.QueryDocumentSnapshot) => ({
    uid: d.id, name: (d.data().name as string) || "?", strikes: (d.data().modStrikes as number) ?? 0,
    chatBannedUntil: (d.data().chatBannedUntil as number) ?? null, banned: !!d.data().banned, banReason: (d.data().banReason as string) ?? "",
  });
  return {
    moderation: mods.docs.map((d) => {
      const x = d.data();
      return { id: d.id, uid: x.uid, name: x.name, text: x.text, category: x.category, strikes: x.strikes, tableId: x.tableId, ip: x.ip ?? null, at: ms(x.at) };
    }),
    reports: reports.docs.map((d) => {
      const x = d.data();
      return {
        id: d.id, reporter: x.reporter, target: x.target, reason: x.reason, tableId: x.tableId, at: ms(x.at),
        recentChat: ((x.recentChat as { uid: string; kind: string; text?: string; id?: string }[]) ?? []).map((m) => ({ uid: m.uid, text: m.text || m.id || m.kind })),
      };
    }),
    review: review.docs.map(user),
    banned: banned.docs.map(user),
  };
});

/** Bir oyuncunun son sohbet kaydı (en fazla 200 mesaj). */
export const adminChatLog = onCall(async (req) => {
  await requireAdmin(req);
  const target = str(req.data?.uid);
  if (!target) fail("badRequest", {}, "invalid-argument");
  const [logs, u] = await Promise.all([
    db.collection("chatLogs").where("uid", "==", target).orderBy("at", "desc").limit(200).get(),
    db.collection("users").doc(target).get(),
  ]);
  return {
    uid: target,
    name: (u.data()?.name as string) || "?",
    banned: !!u.data()?.banned,
    strikes: (u.data()?.modStrikes as number) ?? 0,
    messages: logs.docs.map((d) => {
      const x = d.data();
      return { text: x.text, tableId: x.tableId, tableType: x.tableType, ip: x.ip ?? null, at: ms(x.at) };
    }),
  };
});

/** Hesabı kalıcı engelle / engeli kaldır. Engel kaldırılınca ihlal sayacı ve sohbet yasağı da sıfırlanır. */
export const adminSetBan = onCall(async (req) => {
  const admin = await requireAdmin(req);
  const target = str(req.data?.uid);
  const banned = req.data?.banned === true;
  const reason = str(req.data?.reason, 200);
  if (!target || target === admin) fail("badRequest", {}, "invalid-argument");
  await db.collection("users").doc(target).set(
    banned
      ? { banned: true, banReason: reason, bannedAt: Date.now(), bannedBy: admin, modReview: false }
      : { banned: false, banReason: "", modStrikes: 0, chatBannedUntil: 0, modReview: false },
    { merge: true },
  );
  await db.collection("adminLog").add({ admin, target, action: banned ? "ban" : "unban", reason, at: FieldValue.serverTimestamp() });
  return { ok: true };
});

/** İhlal kaydını ya da şikâyeti "incelendi" olarak kapat. */
export const adminResolve = onCall(async (req) => {
  const admin = await requireAdmin(req);
  const kind = req.data?.kind === "report" ? "reports" : "moderation";
  const id = str(req.data?.id, 128);
  if (!id) fail("badRequest", {}, "invalid-argument");
  await db.collection(kind).doc(id).set({ status: "closed", closedBy: admin, closedAt: Date.now() }, { merge: true });
  return { ok: true };
});

/** Oda grubu: Çayhane, Sosyete (usta*), Teke Tek (ozel*), VIP (vip*). */
function roomOf(type: string): "caylak" | "carli" | "sosyete" | "teketek" | "vip" | null {
  if (type.startsWith("caylak")) return "caylak";
  if (type.startsWith("carli")) return "carli";
  if (type.startsWith("usta")) return "sosyete";
  if (type.startsWith("ozel")) return "teketek";
  if (type.startsWith("vip")) return "vip";
  return null;
}

/**
 * Oda raporu (çevrimiçi açılışın ilk haftası için): son N günde (varsayılan 7) her odada oynanan
 * oyun sayısı ve oynayan farklı gerçek oyuncu sayısı; ayrıca başarı oranına göre Teke Tek (%50)
 * ve Sosyete (%76) şartını karşılayan oyuncu sayısı.
 */
export const adminTableReport = onCall(async (req) => {
  await requireAdmin(req);
  const days = Math.min(90, Math.max(1, Number((req.data as { days?: number })?.days ?? 7)));
  const since = Date.now() - days * 86_400_000;
  const tables = await db.collection("tables").where("createdAt", ">=", since).get();
  const rooms: Record<string, { games: number; players: Set<string>; byType: Record<string, number> }> = {};
  for (const name of ["caylak", "carli", "sosyete", "teketek", "vip"]) rooms[name] = { games: 0, players: new Set(), byType: {} };
  for (const d of tables.docs) {
    const t = d.data();
    const room = roomOf(String(t.type ?? ""));
    // Başlamış oyunlar (bekleme masası ya da kimse gelmeden kapanan masa sayılmaz)
    if (!room || !["playing", "finished"].includes(String(t.status)) && !(t.status === "abandoned" && t.view)) continue;
    const r = rooms[room];
    r.games++;
    r.byType[t.type] = (r.byType[t.type] ?? 0) + 1;
    for (const s of (t.seats as { uid: string | null; bot?: boolean }[]) ?? []) if (s.uid && !s.bot) r.players.add(s.uid);
  }
  const users = await db.collection("users").where("gamesPlayed", ">", 0).get();
  let teke = 0, sosyete = 0, carli = 0;
  for (const u of users.docs) {
    const played = Number(u.data().gamesPlayed ?? 0), won = Number(u.data().gamesWon ?? 0);
    const rate = played > 0 ? Math.round((won / played) * 100) : 0;
    if (rate >= 31) carli++;
    if (rate >= 50) teke++;
    if (rate >= 76) sosyete++;
  }
  return {
    days, since,
    rooms: Object.entries(rooms).map(([room, r]) => ({ room, games: r.games, players: r.players.size, byType: r.byType })),
    rated: { players: users.size, carli, teketek: teke, sosyete },
  };
});
