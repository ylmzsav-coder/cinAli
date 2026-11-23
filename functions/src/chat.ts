/**
 * Serbest yazışma (yalnızca arkadaş/özel masalarda) ve oyuncu şikâyeti.
 *
 * Her mesaj sunucuda kontrol edilir:
 *  - masada oturan oyuncu, özel masa, 1-120 karakter, bağlantı yok
 *  - küfür filtresi (masanın dili + gönderenin arayüz dili)
 *  - hız sınırı: en az 1,5 sn arayla, dakikada en fazla 15 mesaj
 *  - aynı masada 3 küfür denemesi -> 10 dakika yazışma kapalı
 * Küfürlü mesaj masaya HİÇ gönderilmez.
 *
 * VIP odada küfür filtresi açık (masanın dili + arayüz dili), hakaret serbest:
 * küfürlü mesaj gönderilmez; aynı masada 3 küfür denemesi -> 10 dakika sohbet kapalı.
 *
 * VIP odada ayrıca yasa dışı içerik filtresi (illegal.ts): uyuşturucu, silah,
 * kumar, satış teklifi ve iletişim/ödeme bilgisi içeren mesaj gönderilmez,
 * moderation koleksiyonuna kaydedilir; 2. ihlalde 24 saat, 4. ihlalde 30 gün
 * sohbet yasağı gelir ve hesap yönetici incelemesine düşer.
 */
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { onCall } from "firebase-functions/v2/https";
import { LANGS } from "../../src/game/lang";
import { isVipType } from "../../src/economy/tables";
import { db, fail, uidOf } from "./common";
import { containsLink, containsProfanity } from "./profanity";
import { illegalCategory } from "./illegal";

export const MAX_TEXT = 120;
const MIN_GAP_MS = 1500;
const PER_MINUTE = 15;
const STRIKES_TO_MUTE = 3;
const MUTE_MS = 10 * 60_000;
const DAY = 24 * 60 * 60_000;
/**
 * Sohbet kaydı saklama süresi (5651 sayılı Kanun kapsamındaki saklama yükümlülüğü için).
 * Süre dolunca Firestore TTL kaydı kendiliğinden siler (firestore.indexes.json: chatLogs.expireAt).
 */
export const CHAT_LOG_DAYS = 730;
/** İhlal sayısına göre sohbet yasağı: 2 -> 1 gün, 4 -> 30 gün. */
const banFor = (strikes: number) => (strikes >= 4 ? 30 * DAY : strikes >= 2 ? DAY : 0);

/** Yasa dışı içerik denemesini kaydeder, gerekirse sohbet yasağı koyar ve hata döndürür. */
async function flagIllegal(uid: string, tableId: string, text: string, category: string, ip: string | null): Promise<never> {
  const userRef = db.collection("users").doc(uid);
  const strikes = await db.runTransaction(async (t) => {
    const u = (await t.get(userRef)).data() ?? {};
    const n = ((u.modStrikes as number | undefined) ?? 0) + 1;
    const ban = banFor(n);
    t.set(userRef, {
      modStrikes: n,
      ...(ban ? { chatBannedUntil: Date.now() + ban } : {}),
      ...(n >= 4 ? { modReview: true } : {}),
    }, { merge: true });
    t.create(db.collection("moderation").doc(), {
      uid, name: (u.name as string) || "?", tableId, text, category, ip, strikes: n, at: FieldValue.serverTimestamp(), status: "open",
    });
    return n;
  });
  const ban = banFor(strikes);
  if (ban) fail("illegalBanned", { h: Math.round(ban / 3_600_000) }, "permission-denied");
  return fail("illegalContent", {}, "permission-denied");
}

interface ChatMeta {
  last: number;
  windowStart: number;
  windowCount: number;
  strikes: number;
  mutedUntil: number;
}

export const sendText = onCall(async (req) => {
  const uid = uidOf(req);
  const tableId = String(req.data?.tableId ?? "");
  const text = String(req.data?.text ?? "").replace(/\s+/g, " ").trim();
  const uiLang = String(req.data?.uiLang ?? "");
  if (!text) fail("badRequest", {}, "invalid-argument");
  if ([...text].length > MAX_TEXT) fail("textTooLong", { n: MAX_TEXT }, "invalid-argument");

  const tableRef = db.collection("tables").doc(tableId);
  const metaRef = tableRef.collection("chatmeta").doc(uid);
  const user = (await db.collection("users").doc(uid).get()).data() ?? {};
  if (user.banned) fail("accountBanned", {}, "permission-denied");
  if (user.adult === false) fail("vipAdultOnly", {}, "permission-denied");
  const bannedUntil = (user.chatBannedUntil as number | undefined) ?? 0;
  if (bannedUntil > Date.now()) fail("chatBanned", { h: Math.max(1, Math.ceil((bannedUntil - Date.now()) / 3_600_000)) }, "permission-denied");
  const ip = req.rawRequest?.ip ?? null;
  const category = illegalCategory(text);
  if (category) {
    const table = (await tableRef.get()).data();
    if (table && (table.uids as string[]).includes(uid)) await flagIllegal(uid, tableId, text, category, ip);
    fail("notAtTable", {}, "permission-denied");
  }
  return db.runTransaction(async (t) => {
    const [tSnap, mSnap] = await Promise.all([t.get(tableRef), t.get(metaRef)]);
    const table = tSnap.data();
    if (!table || !(table.uids as string[]).includes(uid)) fail("notAtTable", {}, "permission-denied");
    // Oyuncular arası yazışma yalnızca VIP odada; özel oda olduğu için içerik filtresi yok
    if (!isVipType(table.type as string)) fail("chatVipOnly");
    const now = Date.now();
    const meta: ChatMeta = (mSnap.data() as ChatMeta) ?? { last: 0, windowStart: now, windowCount: 0, strikes: 0, mutedUntil: 0 };
    if (meta.mutedUntil > now) fail("chatMuted", { n: Math.ceil((meta.mutedUntil - now) / 60_000) }, "resource-exhausted");
    if (now - meta.last < MIN_GAP_MS) fail("tooFast", {}, "resource-exhausted");
    if (now - meta.windowStart > 60_000) {
      meta.windowStart = now;
      meta.windowCount = 0;
    }
    if (meta.windowCount >= PER_MINUTE) fail("tooFast", {}, "resource-exhausted");
    // Küfür filtresi (hakaret serbest): mesaj gönderilmez, 3. denemede 10 dk susturma
    const langs = [String(table!.lang ?? "tr"), ...(uiLang in LANGS ? [uiLang] : [])];
    if (containsProfanity(text, langs, true)) {
      meta.strikes += 1;
      meta.last = now;
      if (meta.strikes >= STRIKES_TO_MUTE) {
        meta.strikes = 0;
        meta.mutedUntil = now + MUTE_MS;
      }
      t.set(metaRef, meta);
      return meta.mutedUntil > now ? { ok: false, muted: true } : { ok: false, blocked: true, strikesLeft: STRIKES_TO_MUTE - meta.strikes };
    }
    meta.last = now;
    meta.windowCount += 1;
    t.set(metaRef, meta);
    t.create(tableRef.collection("chat").doc(), { uid, kind: "text", id: "", text, at: FieldValue.serverTimestamp() });
    // Kalıcı sohbet kaydı: yalnızca sunucu ve yönetici okuyabilir (istemciye kapalı)
    const seat = ((table!.seats as { uid: string | null; name: string }[]) ?? []).find((x) => x.uid === uid);
    t.create(db.collection("chatLogs").doc(), {
      uid, name: seat?.name ?? (user.name as string) ?? "?", tableId, tableType: table!.type, uids: table!.uids, text, ip,
      at: FieldValue.serverTimestamp(), expireAt: Timestamp.fromMillis(now + CHAT_LOG_DAYS * DAY),
    });
    return { ok: true };
  });
});

/** Oyuncuyu şikâyet et: son mesajlarla birlikte denetim kaydı oluşturur. */
export const reportPlayer = onCall(async (req) => {
  const uid = uidOf(req);
  const tableId = String(req.data?.tableId ?? "");
  const target = String(req.data?.targetUid ?? "");
  const reason = String(req.data?.reason ?? "other").slice(0, 32);
  const tableRef = db.collection("tables").doc(tableId);
  const table = (await tableRef.get()).data();
  if (!table || !(table.uids as string[]).includes(uid)) fail("notAtTable", {}, "permission-denied");
  if (!target || target === uid) fail("badRequest", {}, "invalid-argument");
  const recent = await tableRef.collection("chat").orderBy("at", "desc").limit(30).get();
  await db.collection("reports").add({
    reporter: uid,
    target,
    tableId,
    reason,
    at: FieldValue.serverTimestamp(),
    status: "open",
    recentChat: recent.docs.map((d) => {
      const x = d.data();
      return { uid: x.uid, kind: x.kind, id: x.id ?? "", text: x.text ?? "", at: x.at ?? null };
    }),
  });
  return { ok: true };
});
