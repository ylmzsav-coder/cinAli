import { isVipType } from "../economy/tables";
import { useEffect, useState } from "react";
import { errorText, t } from "../i18n";
import { CLOUD } from "../online/cloud";
import { type FriendRequest, type FriendStatus, type TableInvite, declineInvite, friendsStatus, removeFriend, respondFriendRequest } from "../online/social";
import { Avatar } from "./Profile";

/**
 * Profildeki arkadaş listesi: bekleyen istekler, çevrimiçi durum ve masada
 * oynayan arkadaşın masasını izleme.
 */
export function FriendsPanel({ onJoin }: { onWatch?: (tableId: string) => void; onJoin?: (code: string) => void }) {
  const [friends, setFriends] = useState<FriendStatus[] | null>(null);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [invites, setInvites] = useState<TableInvite[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    if (!CLOUD) return;
    friendsStatus().then(
      (r) => {
        setFriends(r.friends);
        setRequests(r.requests);
        setInvites(r.invites ?? []);
        setErr(null);
      },
      (e) => setErr(errorText(e)),
    );
  };
  useEffect(() => {
    load();
    if (!CLOUD) return;
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  if (!CLOUD)
    return (
      <div className="friends-panel">
        <p className="muted">{t("friendsSoon")}</p>
      </div>
    );

  const respond = async (uid: string, accept: boolean) => {
    setBusy(true);
    try {
      await respondFriendRequest(uid, accept);
      load();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="friends-panel">
      {invites.length > 0 && (
        <div className="friend-requests">
          <div className="stat-label">{t("tableInvites")}</div>
          {invites.map((v) => (
            <div key={v.tableId} className="friend-row invite-row">
              <span className="friend-name">
                {isVipType(v.type) ? "👑 " : ""}{v.name}
                <small className="muted">{isVipType(v.type) ? t("inviteVipGuest") : t("inviteTable")}</small>
              </span>
              {onJoin && <button type="button" className="primary small-btn" onClick={() => onJoin(v.code)}>{t("joinFree")}</button>}
              <button type="button" className="small-btn" onClick={() => void declineInvite(v.tableId).then(load)}>{t("decline")}</button>
            </div>
          ))}
        </div>
      )}
      {requests.length > 0 && (
        <div className="friend-requests">
          <div className="stat-label">{t("friendRequests")}</div>
          {requests.map((r) => (
            <div key={r.uid} className="friend-row">
              <Avatar name={r.name} seat={1} size="sm" />
              <span className="friend-name">{r.name}</span>
              <button type="button" className="primary small-btn" disabled={busy} onClick={() => void respond(r.uid, true)}>{t("accept")}</button>
              <button type="button" className="small-btn" disabled={busy} onClick={() => void respond(r.uid, false)}>{t("decline")}</button>
            </div>
          ))}
        </div>
      )}
      {err && <p className="error">{err}</p>}
      {friends === null ? (
        <p className="muted">…</p>
      ) : friends.length === 0 ? (
        <p className="muted">{t("friendsEmpty")}</p>
      ) : (
        <div className="friend-list">
          {friends.map((f, i) => (
            <div key={f.uid} className="friend-row">
              <span className="friend-ava">
                <Avatar name={f.name} seat={(i % 5) + 1} size="sm" />
                <i className={`presence ${f.online ? "on" : ""}`} aria-hidden />
              </span>
              <span className="friend-name">
                {f.name}
                <small className="muted">
                  {f.tableStatus === "playing" ? t("friendPlaying") : f.tableStatus === "waiting" ? t("friendWaiting") : f.online ? t("online") : t("offline")}
                </small>
              </span>
              <button type="button" className="link small-btn" aria-label={t("removeFriend")} title={t("removeFriend")}
                onClick={() => { if (confirm(t("removeFriendAsk", { name: f.name }))) void removeFriend(f.uid).then(load); }}>✕</button>
            </div>
          ))}
        </div>
      )}
      <p className="muted small">{t("friendsHint")}</p>
    </div>
  );
}
