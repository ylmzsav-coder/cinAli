/** Arkadaşlar ve çevrimiçi durumu (sunucu çağrıları). */
import { CLOUD, call } from "./cloud";

export interface FriendStatus {
  uid: string;
  name: string;
  online: boolean;
  tableStatus: "waiting" | "playing" | null;
  /** VIP üyeliğin bittiği an (rozet). */
  vipUntil?: number | null;
}
export interface FriendRequest {
  uid: string;
  name: string;
}

/** Gelen masa daveti (VIP odada misafir olarak ücretsiz). */
export interface TableInvite {
  tableId: string;
  name: string;
  code: string;
  type: string;
}
export const friendsStatus = () => call<{ friends: FriendStatus[]; requests: FriendRequest[]; invites: TableInvite[] }>("friendsStatus");
export const inviteFriend = (tableId: string, friendUid: string) => call("inviteFriend", { tableId, friendUid });
export const declineInvite = (tableId: string) => call("declineInvite", { tableId });
export const sendFriendRequest = (targetUid: string) => call<{ status: "sent" | "friends" }>("sendFriendRequest", { targetUid });
export const respondFriendRequest = (fromUid: string, accept: boolean) => call("respondFriendRequest", { fromUid, accept });
/** Hesabı ve sunucudaki verileri kalıcı olarak siler. */
export const deleteAccount = () => call<{ ok: boolean }>("deleteAccount");
export const removeFriend = (friendUid: string) => call("removeFriend", { friendUid });

let beat: ReturnType<typeof setInterval> | null = null;
/** Uygulama açıkken dakikada bir "çevrimiçiyim" bildirir (arkadaş listesindeki yeşil nokta). */
export function startHeartbeat(name: string, invites = true) {
  if (!CLOUD) return;
  const send = () => {
    if (document.visibilityState === "visible") void call("heartbeat", { name, invites }).catch(() => {});
  };
  if (beat) clearInterval(beat);
  send();
  beat = setInterval(send, 60_000);
}
