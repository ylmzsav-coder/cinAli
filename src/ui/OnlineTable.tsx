import { addDoc, collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp } from "firebase/firestore";
import { InviteSeat, shareInvite } from "./Lobby";
import { type FriendStatus, friendsStatus, inviteFriend, sendFriendRequest, blockPlayer, blockedList, unblockPlayer } from "../online/social";
import { Avatar } from "./Profile";
import { sendGiftTo } from "../online/gifts";
import { useEffect, useMemo, useRef, useState } from "react";
import { isVipType, tableById, type TableConfig } from "../economy/tables";
import type { Dictionary } from "../game/dictionary";
import { setGameLang, type LangCode } from "../game/lang";
import { errorText, t, uiLang } from "../i18n";
import { call, currentUser, firestore } from "../online/cloud";
import { loadDictionary } from "../online/dicts";
import type { ChatEvent, SendTextResult } from "../online/chat";
import { rotatedState, type Action, type PublicView, type SeatInfo } from "../online/view";
import { TABLE_TURN_SECONDS, type Gender, type Settings } from "../storage";
import { Game, type ChatChannel, type PlayerMenu, type RemoteControl } from "./Game";

/** Susturulan oyuncular cihazda hatırlanır (tüm masalarda geçerli). */
const MUTED_KEY = "cinali.muted";
function loadMuted(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(MUTED_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}
function saveMuted(s: Set<string>) {
  try {
    localStorage.setItem(MUTED_KEY, JSON.stringify([...s].slice(-500)));
  } catch {
    /* depolama yok */
  }
}

type RawChat = { uid: string; kind: "msg" | "emoji" | "text" | "gift"; id: string; text?: string; at: number };

interface TableDoc {
  type: string;
  private?: boolean;
  code?: string | null;
  lang: LangCode;
  status: "waiting" | "playing" | "finished" | "abandoned";
  seats: SeatInfo[];
  uids: string[];
  startAt: number;
  deadline: number | null;
  view: string | null;
  payouts?: Record<string, number>;
}

/** Masaya nasıl girildiği. */
export type OnlineEntry =
  | { kind: "public"; table: TableConfig; want?: Gender; bot?: boolean }
  | { kind: "create"; table: TableConfig }
  | { kind: "join"; code: string };

interface Props {
  entry: OnlineEntry;
  settings: Settings;
  /** Sohbet balonlarını aç/kapat. */
  onChat?: (on: boolean, privateTable: boolean) => void;
  /** Menüye dön (masa sürmeye devam eder; tekrar girince kaldığı yerden). */
  onExit: () => void;
  /** Oyun bitti ya da masadan kalkıldı. */
  onDone: () => void;
}

export function OnlineTable({ entry, settings, onChat, onExit, onDone }: Props) {
  const [uid, setUid] = useState<string | null>(null);
  const [tableId, setTableId] = useState<string | null>(null);
  const [doc_, setDoc] = useState<TableDoc | null>(null);
  const [rack, setRack] = useState<{ seat: number; rack: unknown[] } | null>(null);
  const [dict, setDict] = useState<Dictionary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [chatRaw, setChatRaw] = useState<RawChat[]>([]);
  const [muted, setMuted] = useState<Set<string>>(loadMuted);
  // Engellenen oyuncular (sunucuda): mesajları susturulanlar gibi gizlenir
  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  useEffect(() => {
    void blockedList().then((r) => setBlocked(new Set(r.blocked.map((b) => b.uid))), () => {});
  }, []);

  // Masaya otur (oturduğu masa varsa ona döner)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const user = await currentUser();
        if (!alive) return;
        setUid(user.uid);
        // Çevrimiçi masada "Sen" yerine ayırt edilebilir bir ad
        const name = settings.name || t("guestName", { n: String(parseInt(user.uid.slice(0, 6), 36) % 10000).padStart(4, "0") });
        // Davet linkiyle ilk kez gelen oyuncunun cüzdanı henüz oluşmamış olabilir:
        // masaya katılmadan önce hesabın hazır olduğundan emin ol (tekrar çağrılabilir).
        await call("bootstrap", { name: settings.name });
        const res =
          entry.kind === "join"
            ? await call<{ tableId: string }>("joinPrivateTable", { code: entry.code, name })
            : await call<{ tableId: string }>(entry.kind === "create" ? "createPrivateTable" : "joinTable", {
                type: entry.table.id,
                lang: settings.gameLang,
                name,
                // VIP odada bayan/erkek oyuncu arama
                ...(entry.kind === "public" && entry.want ? { want: entry.want, gender: settings.gender } : {}),
              });
        if (alive) setTableId(res.tableId);
        // "Bilgisayara karşı oyna": masa açılır açılmaz bilgisayarla başlar
        if (alive && entry.kind === "public" && entry.bot) await call("startTable", { tableId: res.tableId }).catch(() => {});
      } catch (e) {
        if (alive) setError(errorText(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [entry, settings.gameLang, settings.name]);

  // Masayı ve kendi ıstakanı canlı dinle
  useEffect(() => {
    if (!tableId || !uid) return;
    const db = firestore();
    const off1 = onSnapshot(doc(db, "tables", tableId), (s) => setDoc((s.data() as TableDoc) ?? null), (e) => setError(errorText(e)));
    const off2 = onSnapshot(doc(db, "tables", tableId, "hands", uid), (s) => setRack((s.data() as { seat: number; rack: unknown[] }) ?? null));
    const off3 = onSnapshot(
      query(collection(db, "tables", tableId, "chat"), orderBy("at", "desc"), limit(30)),
      (s) =>
        setChatRaw(
          s.docs.map((d) => {
            const x = d.data({ serverTimestamps: "estimate" });
            return { uid: x.uid, kind: x.kind, id: x.id ?? "", text: x.text, at: x.at?.toMillis?.() ?? Date.now() };
          }),
        ),
      (e) => console.warn("chat listener", e.code, e.message),
    );
    return () => {
      off1();
      off2();
      off3();
    };
  }, [tableId, uid]);

  // Masanın dilinin sözlüğü (istemci tarafı ön kontrol için)
  useEffect(() => {
    if (!doc_) return;
    setGameLang(doc_.lang);
    loadDictionary(doc_.lang).then(setDict, () => setError(t("dictError")));
  }, [doc_?.lang]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bekleme odası: süre dolunca masayı botlarla başlat
  const startedRef = useRef(false);
  useEffect(() => {
    if (doc_?.status !== "waiting") return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [doc_?.status]);
  useEffect(() => {
    if (!tableId || doc_?.status !== "waiting" || doc_.private || now < doc_.startAt || startedRef.current) return;
    startedRef.current = true;
    call("startTable", { tableId }).catch(() => {
      startedRef.current = false;
    });
  }, [now, doc_, tableId]);

  const remote: RemoteControl | null = useMemo(
    () =>
      tableId
        ? {
            send: (action: Action) => call("act", { tableId, action }),
            timeout: () => call("claimTimeout", { tableId }),
            nextHand: () => call("nextHand", { tableId }),
            deadline: doc_?.deadline ?? null,
          }
        : null,
    [tableId, doc_?.deadline],
  );

  // Sohbet: gönderenin koltuğunu bizim görünümümüze çevir (0 = biz)
  const chat: ChatChannel | undefined = useMemo(() => {
    if (!tableId || !uid || !doc_ || !rack) return undefined;
    const events: ChatEvent[] = [];
    for (const m of chatRaw) {
      if (muted.has(m.uid) || blocked.has(m.uid)) continue; // susturulan oyuncunun mesajları görünmez
      const abs = doc_.seats.findIndex((s) => s.uid === m.uid);
      const n = doc_.seats.length;
      if (abs < 0) continue;
      if (m.kind === "gift") {
        // id: "hediye:alıcıUid" → balonda alıcının adı
        const [gid, to] = m.id.split(":");
        events.push({ seat: (abs - rack.seat + n) % n, kind: "gift", id: gid, text: doc_.seats.find((s) => s.uid === to)?.name ?? "", at: m.at });
        continue;
      }
      events.push({ seat: (abs - rack.seat + n) % n, kind: m.kind, id: m.id, text: m.text, at: m.at });
    }
    return {
      events,
      send: (kind, id) => addDoc(collection(firestore(), "tables", tableId, "chat"), { uid, kind, id, at: serverTimestamp() }),
      // Serbest yazışma yalnızca arkadaş masalarında
      // Oyuncular arası sohbet yalnızca VIP odada (filtresiz)
      sendText: isVipType(doc_.type)
        ? (text: string) => call<SendTextResult>("sendText", { tableId, text, uiLang: uiLang() })
        : undefined,
    };
  }, [chatRaw, tableId, uid, doc_, rack, muted, blocked]);

  // Oyuncu menüsü: görünümdeki koltuğu gerçek koltuğa çevirip uid bul
  const playerMenu: PlayerMenu | undefined = useMemo(() => {
    if (!doc_ || !rack || !tableId) return undefined;
    const uidAt = (seat: number) => doc_.seats[(seat + rack.seat) % doc_.seats.length]?.uid ?? null;
    return {
      available: (seat) => seat !== 0 && !!uidAt(seat),
      isMuted: (seat) => muted.has(uidAt(seat) ?? ""),
      toggleMute: (seat) => {
        const u = uidAt(seat);
        if (!u) return;
        const next = new Set(muted);
        if (next.has(u)) next.delete(u);
        else next.add(u);
        saveMuted(next);
        setMuted(next);
      },
      report: (seat) => call("reportPlayer", { tableId, targetUid: uidAt(seat), reason: "chat" }),
      sendGift: async (seat, giftId) => {
        const u = uidAt(seat);
        if (!u) throw new Error("userNotFound");
        await sendGiftTo(u, giftId, tableId);
      },
      addFriend: async (seat) => {
        const u = uidAt(seat);
        if (!u) throw new Error("userNotFound");
        return (await sendFriendRequest(u)).status;
      },
      isBlocked: (seat) => blocked.has(uidAt(seat) ?? ""),
      toggleBlock: async (seat) => {
        const u = uidAt(seat);
        if (!u) return;
        const s = doc_.seats.find((x) => x.uid === u);
        const next = new Set(blocked);
        if (next.has(u)) {
          await unblockPlayer(u);
          next.delete(u);
        } else {
          await blockPlayer(u, s?.name ?? "?");
          next.add(u);
        }
        setBlocked(next);
      },
    };
  }, [doc_, rack, tableId, muted, blocked]);

  const leave = async () => {
    // Onay, oyun ekranındaki "Oyundan çık" penceresinde alınır
    try {
      if (tableId) await call("leaveTable", { tableId });
    } catch {
      /* yine de çık */
    }
    onDone();
  };

  if (error)
    return (
      <div className="page">
        <button type="button" className="link" onClick={onDone}>{t("back")}</button>
        <p className="toast error-toast">{error}</p>
      </div>
    );

  if (!doc_ || !uid) return <div className="page"><p className="muted">{t("connecting")}</p></div>;
  const cfg = tableById(doc_.type) ?? (entry.kind !== "join" ? entry.table : undefined);
  if (!cfg) return <div className="page"><p className="muted">{t("connecting")}</p></div>;

  if (doc_.status === "waiting" && (cfg.players ?? 4) === 2 && !doc_.private) {
    // VIP rastgele eşleşme: başka bir VIP oyuncu aranır
    const left = Math.max(0, Math.ceil((doc_.startAt - now) / 1000));
    return (
      <div className="page menu vip-searching">
        <div className="vip-radar" aria-hidden><span>{cfg.vip ? "👑" : "🎲"}</span></div>
        <h1>{entry.kind === "public" && entry.want ? t(entry.want === "kadin" ? "vipSearchingF" : "vipSearchingM") : t("vipSearching")}</h1>
        <p className="muted">{t("vipSearchingDesc", { n: left })}</p>
        <div className="waiting-seats">
          <div className="waiting-seat taken">{doc_.seats[0]?.name}</div>
          <div className="waiting-seat searching">🔎 {t("vipSearchSeat")}</div>
        </div>
        <button type="button" className="primary big" onClick={() => void call("startTable", { tableId }).catch(() => {})}>🤖 {t("vipPlayBotNow")}</button>
        <button type="button" className="big" onClick={leave}>{t("vipCancelSearch")}</button>
      </div>
    );
  }

  if (doc_.status === "waiting") {
    const left = Math.max(0, Math.ceil((doc_.startAt - now) / 1000));
    const size = cfg.players ?? 4;
    const seats = [...doc_.seats, ...Array(Math.max(0, size - doc_.seats.length)).fill(null)] as (SeatInfo | null)[];
    return (
      <div className="page menu">
        <h1>{t("waitingTitle")}</h1>
        <p className="muted">{t("tableTitle", { name: t(`table_${cfg.id}` as "table_vip") })}</p>
        <div className="waiting-seats">
          {seats.map((s, i) => (
            s ? <div key={i} className="waiting-seat taken">{s.name}{s.guest && <small className="guest-tag"> · {t("guestTag")}</small>}</div>
              : <InviteSeat key={i} className="waiting-seat" onInvite={() => void shareInvite(doc_.private ? doc_.code ?? undefined : undefined)} />
          ))}
        </div>
        {doc_.private ? (
          <PrivateLobby code={doc_.code ?? ""} isHost={doc_.seats[0]?.uid === uid} onStart={() => call("startTable", { tableId })}
            tableId={tableId!} vip={!!cfg.vip} seatedUids={doc_.uids} />
        ) : (
          <>
            <p className="muted">{t("waitingDesc", { n: left })}</p>
            <button type="button" className="primary big" onClick={() => void call("startTable", { tableId }).catch(() => {})}>{t("startNow")}</button>
          </>
        )}
        <button type="button" className="big" onClick={leave}>{t("leaveTable")}</button>
      </div>
    );
  }

  if (doc_.status === "abandoned") {
    onDone();
    return null;
  }

  if (!doc_.view || !rack || !dict || !remote) return <div className="page"><p className="muted">{t("loadingDict")}</p></div>;
  setGameLang(doc_.lang);
  const view = JSON.parse(doc_.view) as PublicView;
  const state = rotatedState(view, rack.seat, rack.rack as never);

  return (
    <Game
      remote={remote}
      chat={chat}
      chatEnabled={doc_.private ? settings.chatInvite !== false : settings.chat}
      onChatEnabled={onChat && ((on) => onChat(on, !!doc_.private))}
      chatRoom={isVipType(doc_.type)}
      playerMenu={playerMenu}
      vipSeats={doc_.seats.map((_, i) => {
        const s = doc_.seats[(i + rack.seat) % doc_.seats.length];
        return !s?.bot && !!s?.vipUntil && s.vipUntil > Date.now();
      })}
      dict={dict}
      state={state}
      level={cfg.level}
      speed={settings.speed}
      turnSeconds={cfg.vip ? 0 : TABLE_TURN_SECONDS}
      sound={settings.sound}
      vibration={settings.vibration}
      onChange={() => {}}
      onExit={onExit}
      onNewGame={onDone}
      onLeave={doc_.status === "playing" ? leave : undefined}
      tableName={t(`table_${cfg.id}` as "table_vip")} tableId={cfg.id}
      payout={doc_.payouts?.[uid]}
    />
  );
}

/** Özel masa bekleme alanı: davet kodu, paylaş, (kurucu için) başlat. */
function PrivateLobby({ code, isHost, onStart, tableId, vip, seatedUids }: { code: string; isHost: boolean; onStart: () => Promise<unknown>; tableId: string; vip: boolean; seatedUids: string[] }) {
  // Arkadaş listesinden doğrudan davet (VIP odada misafir: abonelik ve ücret yok)
  const [friends, setFriends] = useState<FriendStatus[]>([]);
  const [invited, setInvited] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!isHost) return;
    friendsStatus().then((r) => setFriends(r.friends), () => {});
  }, [isHost]);
  const inviteOne = async (f: FriendStatus) => {
    try {
      await inviteFriend(tableId, f.uid);
      setInvited((s) => new Set(s).add(f.uid));
      setMsg(t("inviteSentTo", { name: f.name }));
    } catch (e) {
      setMsg(errorText(e));
    }
  };
  const [msg, setMsg] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const link = `${location.origin}${location.pathname}#join=${code}`;
  const share = async () => {
    const text = t("inviteText", { code });
    try {
      if (navigator.share) {
        await navigator.share({ title: "Word Okey", text, url: link });
        return;
      }
      await navigator.clipboard.writeText(`${text}\n${link}`);
      setMsg(t("copied"));
    } catch {
      /* paylaşım iptal edildi */
    }
  };
  return (
    <div className="private-lobby">
      <div className="muted small">{t("tableCode")}</div>
      <div className="invite-code" aria-label={t("tableCode")}>{code}</div>
      <button type="button" className="primary big" onClick={share}>📨 {t("invite")}</button>
      {vip && <p className="muted small">{t("vipGuestNote")}</p>}
      {isHost && friends.length > 0 && (
        <div className="friend-list lobby-friends">
          <div className="stat-label">{t("inviteFromFriends")}</div>
          {friends.filter((f) => !seatedUids.includes(f.uid)).slice(0, 8).map((f) => (
            <div key={f.uid} className="friend-row">
              <span className="friend-ava"><Avatar name={f.name} seat={1} size="sm" /><i className={`presence ${f.online ? "on" : ""}`} aria-hidden /></span>
              <span className="friend-name">{f.name}<small className="muted">{f.online ? t("online") : t("offline")}</small></span>
              <button type="button" className="primary small-btn" disabled={invited.has(f.uid)} onClick={() => void inviteOne(f)}>
                {invited.has(f.uid) ? "✓" : t("inviteSeat")}
              </button>
            </div>
          ))}
        </div>
      )}
      {msg && <div className="toast">{msg}</div>}
      {isHost ? (
        <button type="button" className="big" disabled={starting} onClick={() => {
          setStarting(true);
          onStart().catch((e) => {
            setStarting(false);
            setMsg(errorText(e));
          });
        }}>{t("startNow")}</button>
      ) : (
        <p className="muted">{t("hostWillStart")}</p>
      )}
    </div>
  );
}
