import { useEffect, useState } from "react";
import type { TableConfig } from "../economy/tables";
import { tableById, winnerPrize } from "../economy/tables";
import { TwoPlayerChoices, type TwoMode } from "./TwoPlayer";
import { GenderModal } from "./Vip";
import type { Gender } from "../storage";
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
export function TableLobby({ table, name, want, onStart, onLeave }: { table: TableConfig; name: string; want?: "erkek" | "kadin"; onStart: () => void; onLeave: () => void }) {
  const searchTitle = want ? t(want === "kadin" ? "vipSearchingF" : "vipSearchingM") : t("vipSearching");
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
          <div className="seat-top vip-search-seat"><span className="vip-radar small" aria-hidden><span>{want === "kadin" ? "👩" : want === "erkek" ? "👨" : "👑"}</span></span> {searchTitle}</div>
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
                <div className="lobby-wait">🔎 {searchTitle}</div>
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

/**
 * İki kişilik oda giriş ekranı (Özel Oda ve VIP): Çaylak/Usta bekleme masasıyla
 * aynı görünüm. Ortada giriş seçimi ve Rastgele oyuncu / Arkadaşla oyna /
 * Bilgisayara karşı oyna düğmeleri; VIP'te ayrıca Bayan / Erkek oyuncu ara.
 */
export function TwoLobby({ vip = false, name, gender, onGender, onClose, onPick, onSeek }: {
  vip?: boolean;
  name: string;
  gender?: Gender;
  onGender?: (g: Gender) => void;
  onClose: () => void;
  onPick: (tb: TableConfig, mode: TwoMode) => void;
  /** VIP: aranan cinsiyette oyuncu. */
  onSeek?: (tb: TableConfig, want: Gender) => void;
}) {
  const ids = vip ? (["vip2", "vip2m", "vip2u"] as const) : (["ozel2", "ozel2u", "ozel2b"] as const);
  const [id, setId] = useState<string>(ids[0]);
  const [askFor, setAskFor] = useState<Gender | null>(null);
  const tb = tableById(id)!;
  const seek = (want: Gender) => (gender ? onSeek?.(tb, want) : setAskFor(want));
  return (
    <div className={`lobby ozel-lobby ${vip ? "vip-lobby" : ""}`}>
      <div className={`lobby-felt ${vip ? "vip" : ""}`}>
        <button type="button" className="leave-round" onClick={onClose}>{t("leaveTableShort")}</button>
        <div className="seat-top vip-search-seat"><span className="vip-radar small" aria-hidden><span>{vip ? "👑" : "🎲"}</span></span> {vip ? t("table_vip2") : t("ozelTitle")}</div>
        <div className="lobby-me">
          <Avatar name={name} seat={0} size="md" />
          <span>{name}</span>
        </div>
        <div className="lobby-panel">
          <div className="lobby-info">
            {vip && <div className="vip-chat-tag">💬 {t("vipChatGame")}</div>}
            <div className="vip-stake ozel-stake" role="radiogroup" aria-label={t("vipStake")}>
              {ids.map((k) => {
                const x = tableById(k)!;
                return (
                  <button key={k} type="button" role="radio" aria-checked={id === k} className={id === k ? "on" : ""} onClick={() => setId(k)}>
                    <span><Chips amount={x.entry} /></span>
                    <span className="vip-stake-arrow">→ <Chips amount={winnerPrize(x)} /></span>
                  </button>
                );
              })}
            </div>
            {vip && (
              <div className="vip-search-row">
                <button type="button" className="primary vip-search-btn vip-f" onClick={() => seek("kadin")}>👩 {t("vipSearchF")}</button>
                <button type="button" className="primary vip-search-btn vip-m" onClick={() => seek("erkek")}>👨 {t("vipSearchM")}</button>
              </div>
            )}
            <TwoPlayerChoices onRandom={() => onPick(tb, "random")} onFriend={() => onPick(tb, "friend")} onBot={() => onPick(tb, "bot")} />
          </div>
        </div>
      </div>
      {askFor && (
        <GenderModal onClose={() => setAskFor(null)} onPick={(g) => { onGender?.(g); const w = askFor; setAskFor(null); onSeek?.(tb, w); }} />
      )}
    </div>
  );
}
