/**
 * Yönetici paneli (yalnızca sunucuda yönetici olarak tanımlı hesap kullanabilir).
 * Menüde sahip modu açıkken görünür; asıl yetki kontrolü sunucudadır (functions/src/admin.ts).
 */
import { useCallback, useEffect, useState } from "react";
import { CLOUD, call } from "../online/cloud";
import { errorText } from "../i18n";

interface ModRow { id: string; uid: string; name: string; text: string; category: string; strikes: number; tableId: string; ip: string | null; at: number | null }
interface ReportRow { id: string; reporter: string; target: string; reason: string; tableId: string; at: number | null; recentChat: { uid: string; text: string }[] }
interface UserRow { uid: string; name: string; strikes: number; chatBannedUntil: number | null; banned: boolean; banReason: string }
interface Overview { moderation: ModRow[]; reports: ReportRow[]; review: UserRow[]; banned: UserRow[] }
interface ChatLog { uid: string; name: string; banned: boolean; strikes: number; messages: { text: string; tableId: string; tableType: string; ip: string | null; at: number | null }[] }

const CAT: Record<string, string> = { drugs: "💊 Uyuşturucu", weapons: "🔫 Silah", gambling: "🎰 Kumar", selling: "💰 Alım-satım", contact: "📵 İletişim/ödeme" };
const when = (n: number | null) => (n ? new Date(n).toLocaleString("tr-TR") : "–");
type Tab = "moderation" | "reports" | "review" | "banned";

export function Admin({ onBack }: { onBack: () => void }) {
  const [me, setMe] = useState<{ uid: string; admin: boolean } | null>(null);
  const [data, setData] = useState<Overview | null>(null);
  const [tab, setTab] = useState<Tab>("moderation");
  const [log, setLog] = useState<ChatLog | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setErr("");
    try {
      const who = await call<{ uid: string; admin: boolean }>("adminWhoAmI");
      setMe(who);
      if (who.admin) setData(await call<Overview>("adminOverview"));
    } catch (e) {
      setErr(errorText(e));
    }
  }, []);
  useEffect(() => {
    if (CLOUD) void load();
  }, [load]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setErr("");
    try {
      await fn();
      await load();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const openLog = (uid: string) => void call<ChatLog>("adminChatLog", { uid }).then(setLog, (e) => setErr(errorText(e)));
  const ban = (uid: string, name: string) => {
    const reason = prompt(`${name} kalıcı olarak engellensin mi? Sebep yaz:`, "Yasa dışı içerik");
    if (reason !== null) void run(() => call("adminSetBan", { uid, banned: true, reason }));
  };
  const unban = (uid: string, name: string) => {
    if (confirm(`${name} için engel kaldırılsın mı? İhlal sayacı da sıfırlanır.`)) void run(() => call("adminSetBan", { uid, banned: false }));
  };
  const resolve = (kind: "moderation" | "report", id: string) => void run(() => call("adminResolve", { kind, id }));

  const UserActions = ({ uid, name, banned }: { uid: string; name: string; banned?: boolean }) => (
    <span className="admin-actions">
      <button type="button" onClick={() => openLog(uid)}>🗂️ Sohbet kaydı</button>
      {banned
        ? <button type="button" onClick={() => unban(uid, name)} disabled={busy}>✅ Engeli kaldır</button>
        : <button type="button" className="danger" onClick={() => ban(uid, name)} disabled={busy}>⛔ Engelle</button>}
    </span>
  );

  return (
    <div className="page admin-page">
      <button type="button" className="link" onClick={onBack}>‹ Geri</button>
      <h1>🛡️ Yönetici paneli</h1>
      {!CLOUD && <p className="muted">Yönetici paneli oyunun sunucusu açıldığında çalışır. Şu an çipler ve oyunlar yalnızca cihazda.</p>}
      {err && <p className="admin-err" role="alert">{err}</p>}
      {CLOUD && me && !me.admin && (
        <div className="admin-help">
          <p>Bu hesap yönetici değil. Yönetici olmak için Firebase konsolunda <b>Firestore › config › admins</b> belgesindeki <b>uids</b> listesine şu kimliği ekle:</p>
          <code className="admin-uid">{me.uid}</code>
        </div>
      )}
      {data && (
        <>
          <div className="admin-tabs" role="tablist">
            {([
              ["moderation", `İhlaller (${data.moderation.length})`],
              ["reports", `Şikâyetler (${data.reports.length})`],
              ["review", `İncelemede (${data.review.length})`],
              ["banned", `Engelliler (${data.banned.length})`],
            ] as [Tab, string][]).map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{label}</button>
            ))}
            <button type="button" onClick={() => void load()} disabled={busy}>↻ Yenile</button>
          </div>
          {tab === "moderation" && (
            <ul className="admin-list">
              {data.moderation.length === 0 && <li className="muted">Açık ihlal yok.</li>}
              {data.moderation.map((m) => (
                <li key={m.id}>
                  <div><b>{m.name}</b> · {CAT[m.category] ?? m.category} · {m.strikes}. ihlal · <span className="muted">{when(m.at)}{m.ip ? ` · IP ${m.ip}` : ""}</span></div>
                  <blockquote>{m.text}</blockquote>
                  <UserActions uid={m.uid} name={m.name} />
                  <button type="button" onClick={() => resolve("moderation", m.id)} disabled={busy}>✔ İncelendi</button>
                </li>
              ))}
            </ul>
          )}
          {tab === "reports" && (
            <ul className="admin-list">
              {data.reports.length === 0 && <li className="muted">Açık şikâyet yok.</li>}
              {data.reports.map((r) => (
                <li key={r.id}>
                  <div>Şikâyet edilen: <code>{r.target}</code> · sebep: {r.reason} · <span className="muted">{when(r.at)}</span></div>
                  {r.recentChat.length > 0 && (
                    <blockquote>{r.recentChat.slice(0, 10).map((m, i) => <div key={i}>{m.uid === r.target ? "▶ " : ""}{m.text}</div>)}</blockquote>
                  )}
                  <UserActions uid={r.target} name={r.target} />
                  <button type="button" onClick={() => resolve("report", r.id)} disabled={busy}>✔ İncelendi</button>
                </li>
              ))}
            </ul>
          )}
          {(tab === "review" || tab === "banned") && (
            <ul className="admin-list">
              {(tab === "review" ? data.review : data.banned).length === 0 && <li className="muted">Liste boş.</li>}
              {(tab === "review" ? data.review : data.banned).map((u) => (
                <li key={u.uid}>
                  <div><b>{u.name}</b> · {u.strikes} ihlal{u.banReason ? ` · sebep: ${u.banReason}` : ""}{u.chatBannedUntil && u.chatBannedUntil > Date.now() ? ` · sohbet kapalı: ${when(u.chatBannedUntil)}` : ""}</div>
                  <UserActions uid={u.uid} name={u.name} banned={u.banned} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {log && (
        <div className="modal-bg" onClick={() => setLog(null)}>
          <div className="modal admin-log" onClick={(e) => e.stopPropagation()}>
            <h3>🗂️ {log.name} · sohbet kaydı</h3>
            <p className="muted small">{log.strikes} ihlal{log.banned ? " · ENGELLİ" : ""} · <code>{log.uid}</code></p>
            <ul className="admin-list">
              {log.messages.length === 0 && <li className="muted">Kayıtlı mesaj yok.</li>}
              {log.messages.map((m, i) => (
                <li key={i}><span className="muted">{when(m.at)} · {m.tableType}{m.ip ? ` · ${m.ip}` : ""}</span><div>{m.text}</div></li>
              ))}
            </ul>
            <div className="modal-actions"><button type="button" onClick={() => setLog(null)}>Kapat</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
