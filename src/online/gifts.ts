/** Hediyeler (sunucu çağrıları ve gelen hediyeler). */
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { call, currentUser, firestore } from "./cloud";

export interface ReceivedGift {
  id: string;
  giftId: string;
  value: number;
  fromName: string;
  at: number;
  converted: boolean;
}

export const sendGiftTo = (toUid: string, giftId: string, tableId?: string) => call("sendGift", { toUid, giftId, tableId });
export const convertGift = (id: string) => call<{ ok: boolean; chips: number }>("convertGift", { id });

export async function myGifts(): Promise<ReceivedGift[]> {
  const u = await currentUser();
  const snap = await getDocs(query(collection(firestore(), "users", u.uid, "gifts"), orderBy("at", "desc"), limit(100)));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ReceivedGift, "id">) }));
}
