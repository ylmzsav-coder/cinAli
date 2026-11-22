/**
 * Oyuncu şikâyet ve önerileri. Yalnızca sunucu yazar ("feedback" koleksiyonu);
 * oyuncular okuyamaz. Hız sınırı: oyuncu başına günde en fazla 10 mesaj.
 */
import { FieldValue } from "firebase-admin/firestore";
import { onCall } from "firebase-functions/v2/https";
import { dayKey } from "../../src/economy/config";
import { db, fail, uidOf } from "./common";

export const FEEDBACK_MAX = 250;
const TYPES = new Set(["sikayet", "oneri", "hata", "kelime"]);
const PER_DAY = 10;

export const sendFeedback = onCall(async (req) => {
  const uid = uidOf(req);
  const type = String(req.data?.type ?? "");
  const text = String(req.data?.text ?? "").trim();
  if (!TYPES.has(type) || !text) fail("badRequest", {}, "invalid-argument");
  if ([...text].length > FEEDBACK_MAX) fail("textTooLong", { n: FEEDBACK_MAX }, "invalid-argument");
  const meta = db.collection("feedbackmeta").doc(uid);
  await db.runTransaction(async (t) => {
    const m = (await t.get(meta)).data() as { day?: string; count?: number } | undefined;
    const count = m?.day === dayKey() ? (m.count ?? 0) : 0;
    if (count >= PER_DAY) fail("feedbackLimit", { n: PER_DAY }, "resource-exhausted");
    t.set(meta, { day: dayKey(), count: count + 1 });
    t.create(db.collection("feedback").doc(), {
      uid,
      type,
      text,
      lang: String(req.data?.lang ?? "").slice(0, 5),
      version: String(req.data?.version ?? "").slice(0, 40),
      createdAt: FieldValue.serverTimestamp(),
      sentAt: Number(req.data?.sentAt) || null,
    });
  });
  return { ok: true };
});
