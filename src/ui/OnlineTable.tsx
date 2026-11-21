import { addDoc, collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp } from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import type { TableConfig } from "../economy/tables";
import type { Dictionary } from "../game/dictionary";
import { setGameLang, type LangCode } from "../game/lang";
import { errorText, t } from "../i18n";
import { call, currentUser, firestore } from "../online/cloud";
import { loadDictionary } from "../online/dicts";
import type { ChatEvent } from "../online/chat";
import { rotatedState, type Action, type PublicView, type SeatInfo } from "../online/view";
import type { Settings } from "../storage";
import { Game, type ChatChannel, type RemoteControl } from "./Game";

interface TableDoc {
  type: string;
  lang: LangCode;
  status: "waiting" | "playing" | "finished" | "abandoned";
  seats: SeatInfo[];
  uids: string[];
  startAt: number;
  deadline: number | null;
  view: string | null;
  payouts?: Record<string, number>;
}

interface Props {
  table: TableConfig;
  settings: Settings;
  /** Menüye dön (masa sürmeye devam eder; tekrar girince kaldığı yerden). */
  onExit: () => void;
  /** Oyun bitti ya da masadan kalkıldı. */
  onDone: () => void;
}

export function OnlineTable({ table: cfg, settings, onExit, onDone }: Props) {
  const [uid, setUid] = useState<string | null>(null);
  const [tableId, setTableId] = useState<string | null>(null);
  const [doc_, setDoc] = useState<TableDoc | null>(null);
  const [rack, setRack] = useState<{ seat: number; rack: unknown[] } | null>(null);
  const [dict, setDict] = useState<Dictionary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [chatRaw, setChatRaw] = useState<{ uid: string; kind: "msg" | "emoji"; id: string; at: number }[]>([]);

  // Masaya otur (oturduğu masa varsa ona döner)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const user = await currentUser();
        if (!alive) return;
        setUid(user.uid);
        const res = await call<{ tableId: string }>("joinTable", {
          type: cfg.id,
          lang: settings.gameLang,
          // Çevrimiçi masada "Sen" yerine ayırt edilebilir bir ad
          name: settings.name || t("guestName", { n: String(parseInt(user.uid.slice(0, 6), 36) % 10000).padStart(4, "0") }),
        });
        if (alive) setTableId(res.tableId);
      } catch (e) {
        if (alive) setError(errorText(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [cfg.id, settings.gameLang, settings.name]);

  // Masayı ve kendi ıstakanı canlı dinle
  useEffect(() => {
    if (!tableId || !uid) return;
    const db = firestore();
    const off1 = onSnapshot(doc(db, "tables", tableId), (s) => setDoc((s.data() as TableDoc) ?? null), (e) => setError(errorText(e)));
    const off2 = onSnapshot(doc(db, "tables", tableId, "hands", uid), (s) => setRack((s.data() as { seat: number; rack: unknown[] }) ?? null));
    const off3 = onSnapshot(
      query(collection(db, "tables", tableId, "chat"), orderBy("at", "desc"), limit(12)),
      (s) =>
        setChatRaw(
          s.docs.map((d) => {
            const x = d.data({ serverTimestamps: "estimate" });
            return { uid: x.uid, kind: x.kind, id: x.id, at: x.at?.toMillis?.() ?? Date.now() };
          }),
        ),
      () => {},
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
    if (!tableId || doc_?.status !== "waiting" || now < doc_.startAt || startedRef.current) return;
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
    const events: ChatEvent[] = chatRaw
      .map((m) => {
        const abs = doc_.seats.findIndex((s) => s.uid === m.uid);
        return abs < 0 ? null : { seat: (abs - rack.seat + 4) % 4, kind: m.kind, id: m.id, at: m.at };
      })
      .filter((e): e is ChatEvent => !!e);
    return {
      events,
      send: (kind, id) => addDoc(collection(firestore(), "tables", tableId, "chat"), { uid, kind, id, at: serverTimestamp() }),
    };
  }, [chatRaw, tableId, uid, doc_, rack]);

  const leave = async () => {
    if (doc_?.status === "playing" && !confirm(t("leaveConfirm"))) return;
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

  if (doc_.status === "waiting") {
    const left = Math.max(0, Math.ceil((doc_.startAt - now) / 1000));
    const seats = [...doc_.seats, ...Array(4 - doc_.seats.length).fill(null)] as (SeatInfo | null)[];
    return (
      <div className="page menu">
        <h1>{t("waitingTitle")}</h1>
        <p className="muted">{t("tableTitle", { name: t(`table_${cfg.id}` as "table_vip") })}</p>
        <div className="waiting-seats">
          {seats.map((s, i) => (
            <div key={i} className={`waiting-seat ${s ? "taken" : ""}`}>{s ? s.name : t("emptySeat")}</div>
          ))}
        </div>
        <p className="muted">{t("waitingDesc", { n: left })}</p>
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
      chatEnabled={settings.chat}
      dict={dict}
      state={state}
      level={cfg.level}
      speed={settings.speed}
      turnSeconds={30}
      sound={settings.sound}
      vibration={settings.vibration}
      onChange={() => {}}
      onExit={onExit}
      onNewGame={onDone}
      onLeave={doc_.status === "playing" ? leave : undefined}
      tableName={t("tableTitle", { name: t(`table_${cfg.id}` as "table_vip") })}
      payout={doc_.payouts?.[uid]}
    />
  );
}
