import { appStoreUrl, openStoreReview, playUrl } from "../rate";
import { loadSettings, saveSettings, type Settings } from "../storage";

/** Ayarlar oyun içinden (masadaki profil kartı) değişince uygulamaya haber verilir. */
export const SETTINGS_EVENT = "wordokey:settings";
import { blockedList, deleteAccount, unblockPlayer } from "../online/social";
import { CLOUD } from "../online/cloud";
import { wallet } from "../economy/wallet";
import { useEffect, useState } from "react";
import type { GameState } from "../game/engine";
import { handWinsOf, placedValue, totals, wordString } from "../game/engine";
import { COLORS, type Tile } from "../game/tiles";
import { errorText, formatNumber, t, uiLocale } from "../i18n";
import { loadStats, winRate, type PlayerStats } from "../stats";
import { TileView } from "./TileView";
import { FriendsPanel } from "./Friends";
import { MyGiftsPanel } from "./Gifts";

const AVATAR_COLORS = ["#C62828", "#1565C0", "#E09100", "#2E7D32", "#6A1B9A", "#00838F"];
const PHOTO_KEY = "wordokey.avatar";

/** Sizin profil fotoğrafınız (cihazda saklanır, küçültülmüş). */
export function loadPhoto(): string | null {
  if (loadSettings().showPhoto === false) return null;
  try {
    return localStorage.getItem(PHOTO_KEY);
  } catch {
    return null;
  }
}

/** Seçilen resmi 160 piksel kare olarak küçültüp kaydeder. */
function savePhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const size = 160;
      const c = document.createElement("canvas");
      c.width = c.height = size;
      const g = c.getContext("2d")!;
      const s = Math.min(img.width, img.height);
      g.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      const url = c.toDataURL("image/jpeg", 0.85);
      URL.revokeObjectURL(img.src);
      try {
        localStorage.setItem(PHOTO_KEY, url);
      } catch {
        /* depolama doluysa yalnızca bu oturumda görünür */
      }
      resolve(url);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/** Profil resmi: fotoğraf (sizin için) ya da adın baş harfi. Dokununca profil açılır. */
/** VIP rozeti: üyelik sürerken avatarda altın çerçeve ve taç; üyelik bitince kendiliğinden kalkar. */
export const vipActive = (until: number | null | undefined) => !!until && until > Date.now();

export function Avatar({ name, seat, size = "md", onClick, photo, vip = false }: { name: string; seat: number; size?: "sm" | "md" | "lg"; onClick?: () => void; photo?: string | null; vip?: boolean }) {
  const pic = photo !== undefined ? photo : seat === 0 ? loadPhoto() : null;
  const letter = ([...name.trim()][0] ?? "?").toLocaleUpperCase();
  const style = pic ? { backgroundImage: `url(${pic})` } : { background: AVATAR_COLORS[seat % AVATAR_COLORS.length] };
  const cls = `avatar avatar-${size} ${pic ? "avatar-photo" : ""} ${vip ? "avatar-vip" : ""}`;
  const crown = vip ? <span className="vip-crown" title={t("vipBadge")}>👑</span> : null;
  return onClick ? (
    <button type="button" className={cls} style={style} onClick={onClick} aria-label={t("profileOf", { name }) + (vip ? ` · ${t("vipBadge")}` : "")}>
      {pic ? "" : letter}{crown}
    </button>
  ) : (
    <span className={cls} style={style} aria-hidden>{pic ? "" : letter}{crown}</span>
  );
}

function Box({ label, value, cls = "" }: { label: string; value: string | number; cls?: string }) {
  return (
    <div className={`stat ${cls}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{typeof value === "number" ? formatNumber(value) : value}</div>
    </div>
  );
}

/** Pasta grafik: oranı renkli dilim olarak gösterir. */
function Pie({ part, total, color }: { part: number; total: number; color: string }) {
  const deg = total ? (part / total) * 360 : 0;
  return <div className="pie" style={{ background: `conic-gradient(${color} 0deg ${deg}deg, var(--pie-rest) ${deg}deg 360deg)` }} />;
}

/** Kelimeyi renkli harf taşlarıyla gösterir. */
function WordTiles({ word }: { word: string }) {
  const tiles: Tile[] = [...word].map((letter, i) => ({ id: -1 - i, letter, color: COLORS[i % COLORS.length] }) as Tile);
  return <div className="word-tiles">{tiles.map((tl) => <TileView key={tl.id} tile={tl} size="sm" />)}</div>;
}


/** Ayrıntılı istatistikler: galibiyet/yenilgi, kelime sayısı, kazanılan çip, en uzun kelime (oyun puanları karta işlenmez). */
function StatsDetail({ s }: { s: PlayerStats }) {
  const finished = s.gamesPlayed;
  return (
    <div className="stats-detail">
      <div className="stats-row2">
        <div className="stat"><div className="stat-label">{t("stWins")}</div><Pie part={s.gamesWon} total={finished} color="#4CAF50" /><div className="stat-value">{formatNumber(s.gamesWon)}</div></div>
        <div className="stat"><div className="stat-label">{t("stLosses")}</div><Pie part={s.gamesLost} total={finished} color="#E53935" /><div className="stat-value">{formatNumber(s.gamesLost)}</div></div>
      </div>
      <Box cls="stat-line" label={t("stFinished")} value={finished} />
      {/* Rekor kelimeler: kalıcıdır, yalnızca daha iyisi bulununca değişir */}
      <div className="stat stat-hl">
        <div className="stat-label">{t("stBestWord")}</div>
        {s.bestWord ? <><WordTiles word={s.bestWord.word} /><div className="stat-value">{t("pointsN", { n: s.bestWord.value })}</div></> : <div className="stat-value">–</div>}
      </div>
      <div className="stat">
        <div className="stat-label">{t("stLongestWord")}</div>
        {s.longestWord ? <WordTiles word={s.longestWord} /> : <div className="stat-value">–</div>}
      </div>
    </div>
  );
}

/** Sizin profil kartınız: fotoğraf, başarı yüzdesi, özet ve ayrıntılı istatistikler. */
export function MyStatsModal({ name, onClose, onJoin, gender: genderProp, onGender: onGenderProp, settings: settingsProp, onSettings: onSettingsProp, standalone = false }: { name: string; onClose: () => void; onJoin?: (code: string) => void; gender?: "erkek" | "kadin"; onGender?: (g: "erkek" | "kadin") => void; settings?: Settings; onSettings?: (s: Settings) => void; standalone?: boolean }) {
  // Oyun masasından açılınca ayarlar doğrudan kaydedilir ve uygulamaya olayla bildirilir
  const [localSettings, setLocalSettings] = useState<Settings>(() => settingsProp ?? loadSettings());
  const settings = settingsProp ?? (standalone ? localSettings : undefined);
  const onSettings = onSettingsProp ?? (standalone ? (s: Settings) => { setLocalSettings(s); saveSettings(s); window.dispatchEvent(new CustomEvent(SETTINGS_EVENT)); } : undefined);
  const gender = genderProp ?? (standalone ? settings?.gender : undefined);
  const onGender = onGenderProp ?? (standalone && onSettings && settings ? (g: "erkek" | "kadin") => onSettings({ ...settings, gender: g }) : undefined);
  const s = loadStats();
  const shown = name || t("defaultName");
  const [photo, setPhoto] = useState(loadPhoto);
  const [tab, setTab] = useState<"summary" | "detail" | "friends" | "gifts" | "settings">("summary");
  const [msg, setMsg] = useState<string | null>(null);
  const rate = winRate(s.gamesWon, s.gamesPlayed);
  const share = async () => {
    const text = t("shareStats", { name: shown, rate, wins: s.gamesWon, games: s.gamesPlayed });
    try {
      if (navigator.share) await navigator.share({ title: "Word Okey", text });
      else {
        await navigator.clipboard.writeText(text);
        setMsg(t("copied"));
      }
    } catch {
      /* paylaşım iptal edildi */
    }
  };
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal profile-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="profile-close" onClick={onClose} aria-label={t("close")}>✕</button>
        <div className="profile-banner">
          <label className="photo-pick" title={t("changePhoto")}>
            <Avatar name={shown} seat={0} size="lg" photo={settings?.showPhoto === false ? null : photo} vip={wallet.isVip()} />
            <span className="photo-edit" aria-hidden>📷</span>
            <input type="file" accept="image/*" hidden onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setPhoto(await savePhoto(f).catch(() => photo));
            }} />
          </label>
          <div className="profile-name">{shown}</div>
          {wallet.isVip() && <div className="vip-badge-line">👑 {t("vipBadge")}{wallet.snapshot.vipUntil && wallet.snapshot.vipUntil > Date.now() ? ` · ${t("vipUntilDate", { date: new Date(wallet.snapshot.vipUntil).toLocaleDateString(uiLocale()) })}` : ""}</div>}
          {onGender && (
            <div className="gender-toggle" role="radiogroup" aria-label={t("genderLabel")}>
              <button type="button" role="radio" aria-checked={gender === "kadin"} className={gender === "kadin" ? "on" : ""} onClick={() => onGender("kadin")}>👩 {t("genderF")}</button>
              <button type="button" role="radio" aria-checked={gender === "erkek"} className={gender === "erkek" ? "on" : ""} onClick={() => onGender("erkek")}>👨 {t("genderM")}</button>
            </div>
          )}
        </div>
        {tab === "settings" && settings && onSettings ? (
          <SettingsPanel settings={settings} onSettings={onSettings} />
        ) : tab === "gifts" ? (
          <MyGiftsPanel />
        ) : tab === "friends" ? (
          <FriendsPanel onJoin={onJoin && ((c) => { onClose(); onJoin(c); })} />
        ) : tab === "detail" ? (
          <StatsDetail s={s} />
        ) : (
          <div className="profile-summary">
            <div className="stat stat-rate">
              <div className="rate-circle">%{rate}</div>
              <div className="stat-label big-label">{t("stWinRate")}</div>
            </div>
            <div className="stats-row2">
              <Box label={t("stWins")} value={s.gamesWon} />
              <Box label={t("stLosses")} value={s.gamesLost} />
            </div>
            <GamesBar s={s} />
          </div>
        )}
        {msg && <div className="toast">{msg}</div>}
        <div className={`profile-actions ${settings && onSettings ? "five" : "four"}`}>
          <button type="button" onClick={share}>🔗 {t("share")}</button>
          {settings && onSettings && (
            <button type="button" className={tab === "settings" ? "primary" : ""} onClick={() => setTab(tab === "settings" ? "summary" : "settings")}>
              ⚙️ {tab === "settings" ? t("summary") : t("settingsTitle")}
            </button>
          )}
          <button type="button" className={tab === "gifts" ? "primary" : ""} onClick={() => setTab(tab === "gifts" ? "summary" : "gifts")}>
            🎁 {tab === "gifts" ? t("summary") : t("myGifts")}
          </button>
          <button type="button" className={tab === "friends" ? "primary" : ""} onClick={() => setTab(tab === "friends" ? "summary" : "friends")}>
            👥 {tab === "friends" ? t("summary") : t("friends")}
          </button>
          <button type="button" className={tab === "detail" ? "" : "primary"} onClick={() => setTab(tab === "detail" ? "summary" : "detail")}>
            📈 {tab === "detail" ? t("summary") : t("statistics")}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Profildeki ayarlar: fotoğraf, davetler, sohbet, ses ve hesabı silme. */
function SettingsPanel({ settings, onSettings }: { settings: Settings; onSettings: (s: Settings) => void }) {
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const rows: { key: keyof Settings; label: string; hint: string; on: boolean }[] = [
    { key: "showPhoto", label: t("setShowPhoto"), hint: t("setShowPhotoHint"), on: settings.showPhoto !== false },
    { key: "invites", label: t("setInvites"), hint: t("setInvitesHint"), on: settings.invites !== false },
    { key: "chatInvite", label: t("setChatInvite"), hint: t("setChatInviteHint"), on: settings.chatInvite !== false },
    { key: "chat", label: t("setChatRandom"), hint: t("setChatRandomHint"), on: settings.chat },
    { key: "sound", label: t("setSound"), hint: t("setSoundHint"), on: settings.sound },
  ];
  const remove = async () => {
    setBusy(true);
    setErr(null);
    try {
      if (CLOUD) await deleteAccount();
      wipeLocalData();
      location.reload();
    } catch (e) {
      setErr(errorText(e));
      setBusy(false);
    }
  };
  return (
    <div className="settings-panel">
      <button type="button" className="link delete-account" onClick={() => setAsk(true)}>{t("deleteAccount")}</button>
      {ask && (
        <div className="delete-ask" role="alertdialog" aria-label={t("deleteAccount")}>
          <p><b>⚠️ {t("deleteAccountAsk")}</b></p>
          <p className="muted small">{t("deleteAccountInfo")}</p>
          {err && <p className="login-err">{err}</p>}
          <div className="modal-actions">
            <button type="button" className="danger" disabled={busy} onClick={() => void remove()}>{t("deleteAccountYes")}</button>
            <button type="button" disabled={busy} onClick={() => setAsk(false)}>{t("cancel")}</button>
          </div>
        </div>
      )}
      <div className="settings-head">{t("setGameSection")}</div>
      <ul className="settings-list">
        {rows.map((r) => (
          <li key={r.key}>
            <span className="settings-label">{r.label}<small>{r.hint}</small></span>
            <button type="button" role="switch" aria-checked={r.on} aria-label={r.label} className={`switch ${r.on ? "on" : ""}`}
              onClick={() => onSettings({ ...settings, [r.key]: !r.on })}><i /></button>
          </li>
        ))}
      </ul>
      <BlockedList />
      <RateRow />
    </div>
  );
}

/** "Word Okey'i Değerlendir": Google Play / App Store sayfası. */
function RateRow() {
  const [choose, setChoose] = useState(false);
  return (
    <>
      <button type="button" className="rate-row" onClick={() => { if (!openStoreReview()) setChoose(true); }}>
        <span className="rate-star" aria-hidden>⭐</span>
        <span className="settings-label">{t("rateTitle")}<small>{t("rateSub")}</small></span>
      </button>
      {choose && (
        <div className="rate-stores">
          <a className="store-btn" href={playUrl} target="_blank" rel="noopener noreferrer">▶ Google Play</a>
          {appStoreUrl
            ? <a className="store-btn" href={appStoreUrl} target="_blank" rel="noopener noreferrer">App Store</a>
            : <span className="store-btn off">App Store · {t("soon")}</span>}
        </div>
      )}
      <p className="muted small app-version">Word Okey · v {typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : ""}</p>
    </>
  );
}

/** Engellenen oyuncular: sunucudan listelenir, engel buradan kaldırılır. */
function BlockedList() {
  const [list, setList] = useState<{ uid: string; name: string }[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = () => blockedList().then((r) => setList(r.blocked), (e) => setErr(errorText(e)));
  useEffect(() => {
    if (CLOUD) void load();
  }, []);
  return (
    <>
      <div className="settings-head">🚫 {t("blockedTitle")}</div>
      <p className="muted small blocked-hint">{t("blockedHint")}</p>
      {!CLOUD ? <p className="muted small">{t("blockedLocal")}</p> : err ? <p className="login-err">{err}</p> : list === null ? <p className="muted small">…</p> : list.length === 0 ? (
        <p className="muted small">{t("blockedEmpty")}</p>
      ) : (
        <ul className="settings-list">
          {list.map((b) => (
            <li key={b.uid}>
              <span className="settings-label">{b.name}</span>
              <button type="button" onClick={() => void unblockPlayer(b.uid).then(load, (e) => setErr(errorText(e)))}>{t("unblock")}</button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** Cihazdaki bütün oyun verilerini siler (hesap silinince). */
function wipeLocalData() {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith("wordokey.") || k.startsWith("cinali.")) localStorage.removeItem(k);
    sessionStorage.clear();
  } catch {
    /* depolama kapalı */
  }
}

/** Oynanan oyun cetveli: galibiyet / yenilgi oranlı; beraberlik galibiyettir çubuk (oyundan çıkmak yenilgidir). */
function GamesBar({ s }: { s: PlayerStats }) {
  const total = s.gamesPlayed;
  const parts = [
    { k: "win", n: s.gamesWon, label: t("stWins") },
    { k: "loss", n: s.gamesLost, label: t("stLosses") },
  ];
  return (
    <div className="stat games-bar-box">
      <div className="games-bar-head"><span className="stat-label big-label">{t("stPlayedGames")}</span><b className="games-bar-total">{formatNumber(total)}</b></div>
      <div className="games-bar" role="img" aria-label={parts.map((p) => `${p.label} ${p.n}`).join(", ")}>
        {total === 0 ? <span className="gb-empty" /> : parts.filter((p) => p.n > 0).map((p) => (
          <span key={p.k} className={`gb gb-${p.k}`} style={{ flexGrow: p.n }}>{p.n}</span>
        ))}
      </div>
      <div className="games-bar-legend">
        {parts.map((p) => <span key={p.k}><i className={`gb-dot gb-${p.k}`} />{p.label} {p.n}</span>)}
      </div>
    </div>
  );
}

/** Masadaki bir oyuncunun bu oyundaki istatistikleri. */
export function SeatStatsModal({ state, seat, onClose, onAddFriend, onGift, vip = false }: { state: GameState; seat: number; onClose: () => void; onAddFriend?: () => void; onGift?: () => void; vip?: boolean }) {
  if (seat === 0) return <MyStatsModal name={state.players[0].name} onClose={onClose} standalone />;
  const p = state.players[seat];
  const sums = totals(state);
  const active = state.phase === "draw" || state.phase === "play";
  const score = sums[seat] + (active ? p.points ?? 0 : 0);
  const live = sums.map((v, i) => v + (active ? state.players[i].points ?? 0 : 0));
  const rank = [...live].sort((a, b) => b - a).indexOf(score) + 1;
  const words = state.table.filter((w) => w.owner === seat && !w.pair);
  const best = words.reduce<{ word: string; value: number } | null>((b, w) => {
    const v = placedValue(w.tiles);
    return !b || v > b.value ? { word: wordString(w.tiles), value: v } : b;
  }, null);
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal profile-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="profile-close" onClick={onClose} aria-label={t("close")}>✕</button>
        <div className="profile-banner">
          <Avatar name={p.name} seat={seat} size="lg" vip={vip} />
          <div className="profile-name">{p.name}</div>
          {vip && <div className="vip-badge-line">👑 {t("vipBadge")}</div>}
          <div className="muted small">{p.isBot ? t("computerPlayer") : t("thisGame")}</div>
        </div>
        <div className="profile-summary">
          <div className="stat stat-rate">
            <div className="rate-circle">{formatNumber(score)}</div>
            <div className="stat-label big-label">{t("stGameTotal")} · {rank}.</div>
          </div>
          <div className="stats-row2">
            <Box label={t("stHandsWon")} value={`${handWinsOf(state, seat)} / ${state.results?.length ?? 0}`} />
            <Box label={t("stHandPoints")} value={active ? p.points ?? 0 : "–"} />
          </div>
          <div className="stats-row2">
            <Box label={t("stWordsNow")} value={words.length} />
            <Box label={t("stBestMove")} value={active ? p.bestPlay ?? 0 : "–"} />
          </div>
          {best && (
            <div className="stat"><div className="stat-label">{t("stBestWordNow")} ({best.value})</div><WordTiles word={best.word} /></div>
          )}
        </div>
        {onGift && (
          <button type="button" className="gift-btn add-friend-btn" onClick={() => { onClose(); onGift(); }}>🎁 {t("giftSendShort")}</button>
        )}
        {onAddFriend && (
          <button type="button" className="primary add-friend-btn" onClick={() => { onAddFriend(); onClose(); }}>👥 {t("addFriend")}</button>
        )}
      </div>
    </div>
  );
}
