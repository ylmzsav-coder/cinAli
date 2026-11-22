import { useEffect, useState } from "react";
import type { TableConfig } from "../economy/tables";
import { winnerPrize } from "../economy/tables";
import { formatNumber, t } from "../i18n";
import { Avatar } from "./Profile";
import { Chips } from "./Chips";

/** Bekleme süresi: bu sürede gelen olmazsa boş koltuklara bilgisayar oyuncuları oturur. */
const WAIT_SECONDS = 10;

/** Oyun bağlantısını (davet) paylaşır; paylaşım yoksa panoya kopyalar. Sonuç mesajını döndürür. */
export async function shareInvite(code?: string): Promise<string | null> {
  const base = `${location.origin}${location.pathname}`;
  const link = code ? `${base}#join=${code}` : base;
  const text = code ? t("inviteText", { code }) : t("inviteAppText");
  try {
    if (navigator.share) {
      await navigator.share({ title: "Word Okey", text, url: link });
      return null;
    }
    await navigator.clipboard.writeText(`${text}\n${link}`);
    return t("copied");
  } catch {
    return null; // paylaşım iptal edildi
  }
}

/** Boş koltuk: "+ DAVET ET". */
export function InviteSeat({ onInvite, className = "" }: { onInvite: () => void; className?: string }) {
  return (
    <button type="button" className={`invite-seat ${className}`} onClick={onInvite}>
      <span className="invite-plus" aria-hidden>+</span>
      <span className="invite-label">{t("inviteSeat")}</span>
    </button>
  );
}

/**
 * Masaya oturunca bekleme ekranı (cihazda oynanan çipli masa). Boş koltuklara
 * arkadaş davet edilebilir; süre dolunca ya da "Şimdi başlat" ile boş koltuklara
 * bilgisayar oyuncuları oturur ve oyun başlar. Giriş ücreti oyun başlarken alınır.
 */
export function TableLobby({ table, name, onStart, onLeave }: { table: TableConfig; name: string; onStart: () => void; onLeave: () => void }) {
  const [left, setLeft] = useState(WAIT_SECONDS);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (left <= 0) {
      onStart();
      return;
    }
    const id = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(id);
  }, [left]); // eslint-disable-line react-hooks/exhaustive-deps

  const invite = async () => setMsg(await shareInvite());

  return (
    <div className="lobby">
      <div className={`lobby-felt ${table.vip ? "vip" : ""}`}>
        <button type="button" className="leave-round" onClick={onLeave}>{t("leaveTableShort")}</button>
        {table.vip ? (
          <div className="seat-top vip-search-seat"><span className="vip-radar small" aria-hidden><span>👑</span></span> {t("vipSearchSeat")}</div>
        ) : (
          <InviteSeat className="seat-top" onInvite={() => void invite()} />
        )}
        {(table.players ?? 4) > 2 && <InviteSeat className="seat-left" onInvite={() => void invite()} />}
        {(table.players ?? 4) > 2 && <InviteSeat className="seat-right" onInvite={() => void invite()} />}
        <div className="lobby-me">
          <Avatar name={name} seat={0} size="md" />
          <span>{name}</span>
        </div>

        <div className="lobby-panel">
          <div className="lobby-info">
            <div className="lobby-row"><span className="muted small">{t("entry")}</span><Chips amount={table.entry} /></div>
            <div className="lobby-row"><span className="muted small">{t("toWinner")}</span><Chips amount={winnerPrize(table)} /></div>
            {table.vip && <div className="vip-chat-tag">💬 {t("vipChatGame")}</div>}
            {table.vip ? (
              <>
                <div className="lobby-wait">🔎 {t("vipSearching")}</div>
                <div className="muted small">{t("vipSearchingLocal", { n: formatNumber(Math.max(0, left)) })}</div>
              </>
            ) : (
              <>
                <div className="lobby-wait">{t("lobbyWaiting")}</div>
                <div className="muted small">{t("lobbyBots", { n: formatNumber(Math.max(0, left)) })}</div>
              </>
            )}
            <button type="button" className="primary" onClick={onStart}>{table.vip ? `🤖 ${t("vipPlayBotNow")}` : t("startNow")}</button>
            {msg && <div className="toast">{msg}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
