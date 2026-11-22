/** Arkadaşlar, çevrimiçi durumu ve masa izleme (sunucu çağrıları). */
import { CLOUD, call } from "./cloud";

export interface FriendStatus {
  uid: string;
  name: string;
  online: boolean;
  tableId: string | null;
  tableStatus: "waiting" | "playing" | null;
  watchers: number;
}
export interface FriendRequest {
  uid: string;
  name: string;
}

export const friendsStatus = () => call<{ friends: FriendStatus[]; requests: FriendRequest[] }>("friendsStatus");
export const sendFriendRequest = (targetUid: string) => call<{ status: "sent" | "friends" }>("sendFriendRequest", { targetUid });
export const respondFriendRequest = (fromUid: string, accept: boolean) => call("respondFriendRequest", { fromUid, accept });
export const removeFriend = (friendUid: string) => call("removeFriend", { friendUid });
export const watchTable = (tableId: string) => call<{ ok: boolean; seated: boolean }>("watchTable", { tableId });
export const stopWatching = (tableId: string) => call("stopWatching", { tableId });
export const takeSeat = (tableId: string, seat: number, name: string) => call("takeSeat", { tableId, seat, name });

let beat: ReturnType<typeof setInterval> | null = null;
/** Uygulama açıkken dakikada bir "çevrimiçiyim" bildirir (arkadaş listesindeki yeşil nokta). */
export function startHeartbeat(name: string) {
  if (!CLOUD) return;
  const send = () => {
    if (document.visibilityState === "visible") void call("heartbeat", { name }).catch(() => {});
  };
  if (beat) clearInterval(beat);
  send();
  beat = setInterval(send, 60_000);
}
