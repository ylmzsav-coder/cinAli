/**
 * Serbest yazışma (yalnızca arkadaş/özel masalarda) ve oyuncu şikâyeti.
 *
 * Her mesaj sunucuda kontrol edilir:
 *  - masada oturan oyuncu, özel masa, 1-120 karakter, bağlantı yok
 *  - küfür filtresi (masanın dili + gönderenin arayüz dili)
 *  - hız sınırı: en az 1,5 sn arayla, dakikada en fazla 15 mesaj
 *  - aynı masada 3 küfür denemesi -> 10 dakika yazışma kapalı
 * Küfürlü mesaj masaya HİÇ gönderilmez.
 */
import { FieldValue } from "firebase-admin/firestore";
import { onCall } from "firebase-functions/v2/https";
import { LANGS } from "../../src/game/lang";
import { db, fail, uidOf } from "./common";
import { containsLink, containsProfanity } from "./profanity";

export const MAX_TEXT = 120;
const MIN_GAP_MS = 1500;
const PER_MINUTE = 15;
const STRIKES_TO_MUTE = 3;
const MUTE_MS = 10 * 60_000;

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
  return db.runTransaction(async (t) => {
    const [tSnap, mSnap] = await Promise.all([t.get(tableRef), t.get(metaRef)]);
    const table = tSnap.data();
    if (!table || !(table.uids as string[]).includes(uid)) fail("notAtTable", {}, "permission-denied");
    // Serbest yazışma: arkadaş masalarında ve VIP odada
    if (!table.private && table.type !== "vip2") fail("textPrivateOnly");
    const now = Date.now();
    const meta: ChatMeta = (mSnap.data() as ChatMeta) ?? { last: 0, windowStart: now, windowCount: 0, strikes: 0, mutedUntil: 0 };
    if (meta.mutedUntil > now) fail("chatMuted", { n: Math.ceil((meta.mutedUntil - now) / 60_000) }, "resource-exhausted");
    if (now - meta.last < MIN_GAP_MS) fail("tooFast", {}, "resource-exhausted");
    if (now - meta.windowStart > 60_000) {
      meta.windowStart = now;
      meta.windowCount = 0;
    }
    if (meta.windowCount >= PER_MINUTE) fail("tooFast", {}, "resource-exhausted");
    if (containsLink(text)) fail("noLinks");

    const langs = [table.lang, ...(uiLang in LANGS ? [uiLang] : [])];
    if (containsProfanity(text, langs)) {
      meta.strikes += 1;
      const muted = meta.strikes >= STRIKES_TO_MUTE;
      if (muted) {
        meta.mutedUntil = now + MUTE_MS;
        meta.strikes = 0;
      }
      t.set(metaRef, meta);
      // Küfürlü mesaj kaydedilmez; denetim için yalnızca sayaç tutulur.
      return { ok: false, blocked: true, muted, strikesLeft: muted ? 0 : STRIKES_TO_MUTE - meta.strikes };
    }

    meta.last = now;
    meta.windowCount += 1;
    t.set(metaRef, meta);
    t.create(tableRef.collection("chat").doc(), { uid, kind: "text", id: "", text, at: FieldValue.serverTimestamp() });
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
