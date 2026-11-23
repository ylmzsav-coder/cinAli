import { doc, onSnapshot } from "firebase/firestore";
import { WatchersBadge, watcherNamesOf } from "./Watchers";
import { useEffect, useState } from "react";
import { tableById } from "../economy/tables";
import { errorText, t } from "../i18n";
import { firestore } from "../online/cloud";
import { stopWatching, takeSeat, watchTable } from "../online/social";
import type { PublicView, SeatInfo } from "../online/view";
import type { TableConfig } from "../economy/tables";
import { Avatar } from "./Profile";
import { TileView } from "./TileView";

interface WatchedTable {
  type: string;
  status: "waiting" | "playing" | "finished" | "abandoned";
  seats: SeatInfo[];
  view: string | null;
  watchers?: string[];
  watcherNames?: Record<string, string>;
  vacant?: { seat: number; until: number }[];
}

/**
 * Arkadaşın masasını izleyici olarak açar: kelimeler, puanlar, sıra ve izleyici
 * sayısı görünür (ıstakalar gizli). Oyun sürerken boşalan koltuğa 10 saniye
 * içinde oturulabilir; oturunca oyuna dahil olunur.
 */
export function Spectator({ tableId, name, onLeave, onSeated }: { tableId: string; name: string; onLeave: () => void; onSeated: (cfg: TableConfig) => void }) {
  const [data, setData] = useState<WatchedTable | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let off: (() => void) | null = null;
    let alive = true;
    watchTable(tableId).then(
      () => {
        if (!alive) return;
        off = onSnapshot(doc(firestore(), "tables", tableId), (s) => setData((s.data() as WatchedTable) ?? null), (e) => setErr(errorText(e)));
      },
      (e) => alive && setErr(errorText(e)),
    );
    return () => {
      alive = false;
      off?.();
      void stopWatching(tableId).catch(() => {});
    };
  }, [tableId]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  if (err)
    return (
      <div className="page">
        <button type="button" className="link" onClick={onLeave}>{t("back")}</button>
        <p className="toast error-toast">{err}</p>
      </div>
    );
  if (!data) return <div className="page"><p className="muted">{t("connecting")}</p></div>;

  const cfg = tableById(data.type);
  const view = data.view ? (JSON.parse(data.view) as PublicView) : null;
  const vacantAt = (seat: number) => (data.vacant ?? []).find((v) => v.seat === seat && v.until > now);
  const totalOf = (i: number) => (view ? view.history.reduce((s, h) => s + h[i], 0) + (view.phase === "draw" || view.phase === "play" ? view.players[i].points ?? 0 : 0) : 0);

  const sit = async (seat: number) => {
    if (!cfg) return;
    setBusy(true);
    try {
      await takeSeat(tableId, seat, name);
      onSeated(cfg);
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const seatCard = (i: number) => {
    const s = data.seats[i];
    const p = view?.players[i];
    const v = vacantAt(i);
    const active = view && (view.phase === "draw" || view.phase === "play") && view.current === i;
    return (
      <div key={i} className={`spec-seat spec-seat-${i} ${active ? "active" : ""} ${v ? "vacant" : ""}`}>
        {v ? (
          <>
            <div className="spec-name">{t("emptySeat")}</div>
            <button type="button" className="primary" disabled={busy} onClick={() => void sit(i)}>
              {t("takeSeat", { n: Math.max(0, Math.ceil((v.until - now) / 1000)) })}
            </button>
            <div className="muted small">{t("takeSeatCost", { n: cfg?.entry ?? 0 })}</div>
          </>
        ) : (
          <>
            <div className="spec-name"><Avatar name={s?.name ?? "?"} seat={i} size="sm" /> {s?.name ?? "?"}{s?.bot && <span className="muted small"> ({t("bot")})</span>}</div>
            {p && <div className="muted small">{t("tilesN", { n: p.rackCount })} · {t("pointsN", { n: totalOf(i) })}</div>}
            {view && view.discards[i].length > 0 && <TileView tile={view.discards[i][view.discards[i].length - 1]} size="sm" />}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="spectator">
      <header className="topbar">
        <button type="button" className="link" onClick={onLeave}>{t("stopWatchingBtn")}</button>
        <div className="title">👁 {t("spectating")} {cfg ? `· ${t(`table_${cfg.id}` as "table_vip")}` : ""}</div>
        <WatchersBadge names={watcherNamesOf(data)} />
      </header>
      {data.status === "waiting" && <p className="muted center">{t("waitingTitle")}</p>}
      {(data.status === "finished" || data.status === "abandoned") && <p className="center">{t("tableOverMsg")}</p>}
      <div className="spec-board">
        {[0, 1, 2, 3].map(seatCard)}
        <div className="spec-table">
          {view && view.table.length === 0 && <p className="muted">{t("noWordsYet")}</p>}
          {view?.table.map((w) => (
            <div key={w.id} className="spec-word">
              {w.tiles.map((pt) => <TileView key={pt.tile.id} tile={pt.tile} as={pt.letter} size="sm" />)}
              <small className="muted">{data.seats[w.owner]?.name}</small>
            </div>
          ))}
          {view && <div className="spec-deck">{t("deckN", { n: view.deckCount })}</div>}
        </div>
      </div>
    </div>
  );
}
