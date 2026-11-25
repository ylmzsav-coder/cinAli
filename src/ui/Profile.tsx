import { appStoreUrl, openStoreReview, playUrl } from "../rate";
import { loadSettings, saveSettings, type Settings } from "../storage";

/** Ayarlar oyun içinden (masadaki profil kartı) değişince uygulamaya haber verilir. */
export const SETTINGS_EVENT = "wordokey:settings";
import { blockedList, deleteAccount, unblockPlayer } from "../online/social";
import { CLOUD } from "../online/cloud";
import { wallet } from "../economy/wallet";
import { useEffect, useState } from "react";
import type { GameState } from "../game/engine";
import { handWinsOf, totals } from "../game/engine";
import { COLORS, type Tile } from "../game/tiles";
import { errorText, formatNumber, t, uiLocale } from "../i18n";
import { loadStats, myChipsWon, myRate, winRate, type PlayerStats } from "../stats";
import { RateCard } from "./RateRing";
import { Chips } from "./Chips";
import { loadAccount } from "../account";
import { rateTier } from "../economy/tables";
import { TileView } from "./TileView";
import { FriendsPanel } from "./Friends";
import { MyGiftsPanel } from "./Gifts";

const AVATAR_COLORS = ["#C62828", "#1565C0", "#E09100", "#2E7D32", "#6A1B9A", "#00838F"];
const PHOTO_KEY = "wordokey.avatar";

/**
 * Profil resmi: yalnızca sosyal medya (Facebook) ile bağlanan oyuncuda o hesabın resmi.
 * E-posta (Gmail) ya da misafir girişinde resim yoktur; adın baş harfi görünür.
 * Uygulamada resim yükleme/değiştirme yoktur.
 */
export function loadPhoto(): string | null {
  if (loadSettings().showPhoto === false || loadAccount()?.method !== "facebook") return null;
  try {
    const p = localStorage.getItem(PHOTO_KEY);
    // Eski sürümde cihazdan yüklenen resimler (data:) artık kullanılmaz
    if (p?.startsWith("data:")) {
      localStorage.removeItem(PHOTO_KEY);
      return null;
    }
    return p;
  } catch {
    return null;
  }
}

/** Facebook profil resmi: her Facebook girişinde güncellenir. */
export function setFacebookPhoto(url: string | null) {
  try {
    if (url) localStorage.setItem(PHOTO_KEY, url);
    else localStorage.removeItem(PHOTO_KEY);
  } catch {
    /* depolama yok */
  }
}

/** Profil resmi: fotoğraf (sizin için) ya da adın baş harfi. Dokununca profil açılır. */
/** VIP rozeti: üyelik sürerken avatarda altın çerçeve ve taç; üyelik bitince kendiliğinden kalkar. */
export const vipActive = (until: number | null | undefined) => !!until && until > Date.now();

export function Avatar({ name, seat, size = "md", onClick, photo, vip = false, rate }: { name: string; seat: number; size?: "sm" | "md" | "lg"; onClick?: () => void; photo?: string | null; vip?: boolean; rate?: number | null }) {
  const pic = photo !== undefined ? photo : seat === 0 ? loadPhoto() : null;
  const letter = ([...name.trim()][0] ?? "?").toLocaleUpperCase();
  const style = pic ? { backgroundImage: `url(${pic})` } : { background: AVATAR_COLORS[seat % AVATAR_COLORS.length] };
  const cls = `avatar avatar-${size} ${pic ? "avatar-photo" : ""} ${vip ? "avatar-vip" : ""} ${rate != null ? "avatar-rated" : ""}`;
  const crown = vip ? <span className="vip-crown" title={t("vipBadge")}>👑</span> : null;
  // Başarı oranı: avatarın altında, seviyesinin renginde (Çayhane turuncu … Sosyete kırmızı)
  const badge = rate != null ? <span className="avatar-rate" style={{ background: rateTier(rate).tier.color, color: rateTier(rate).tier.table === "usta" ? "#fff" : "#111" }} title={t("stWinRate")}>{rate}</span> : null;
  return onClick ? (
    <button type="button" className={cls} style={style} onClick={onClick} aria-label={t("profileOf", { name }) + (vip ? ` · ${t("vipBadge")}` : "") + (rate != null ? ` · ${t("stWinRate")} %${rate}` : "")}>
      {pic ? "" : letter}{crown}{badge}
    </button>
  ) : (
    <span className={cls} style={style} aria-hidden>{pic ? "" : letter}{crown}{badge}</span>
  );
}

/** Toplam kazanılan çip: oyuncunun hayatı boyunca masalardan kazandığı çip. */
function TotalChips({ value }: { value: number | null }) {
  return (
    <div className="stat stat-line total-chips">
      <div className="stat-label">{t("stTotalChipsWon")}</div>
      <div className="stat-value">{value == null ? "–" : <Chips amount={value} />}</div>
    </div>
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
/** Kelime taşları (profilde): harflerin altında puan yazmaz. */
function WordTiles({ word }: { word: string }) {
  const tiles: Tile[] = [...word].map((letter, i) => ({ id: -1 - i, letter, color: COLORS[i % COLORS.length] }) as Tile);
  return <div className="word-tiles no-values">{tiles.map((tl) => <TileView key={tl.id} tile={tl} size="sm" />)}</div>;
}


/** Ayrıntılı istatistikler: galibiyet/yenilgi, oynanan oyun, en uzun kelime (puanlar karta işlenmez). */
function StatsDetail({ s }: { s: PlayerStats }) {
  const finished = s.gamesPlayed;
  return (
    <div className="stats-detail">
      <div className="stats-row2">
        <div className="stat"><div className="stat-label">{t("stWins")}</div><Pie part={s.gamesWon} total={finished} color="#4CAF50" /><div className="stat-value">{formatNumber(s.gamesWon)}</div></div>
        <div className="stat"><div className="stat-label">{t("stLosses")}</div><Pie part={s.gamesLost} total={finished} color="#E53935" /><div className="stat-value">{formatNumber(s.gamesLost)}</div></div>
      </div>
      <Box cls="stat-line" label={t("stFinished")} value={finished} />
      {/* Rekor kelime: en uzun kelime kalıcıdır (puan gösterilmez) */}
      <div className="stat stat-hl">
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
  const [editName, setEditName] = useState(false);
  const shown = (settings?.name ?? name) || t("defaultName");
  const photo = settings?.showPhoto === false ? null : loadPhoto();
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
          <Avatar name={shown} seat={0} size="lg" photo={photo} vip={wallet.isVip()} rate={myRate().rate} />
          {editName && settings && onSettings ? (
            <form className="name-edit" onSubmit={(e) => { e.preventDefault(); setEditName(false); }}>
              <input autoFocus value={settings.name} maxLength={12} placeholder={t("defaultName")} aria-label={t("yourName")}
                onChange={(e) => onSettings({ ...settings, name: e.target.value })} onBlur={() => setEditName(false)} />
              <button type="submit" className="primary">✓</button>
            </form>
          ) : (
            <button type="button" className="profile-name name-btn" disabled={!settings || !onSettings} onClick={() => setEditName(true)} title={t("changeName")}>
              {shown}{settings && onSettings && <span className="name-pen" aria-hidden> ✏️</span>}
            </button>
          )}
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
            {(() => { const me = myRate(); return <RateCard rate={me.rate} won={me.won} played={me.played} />; })()}
            <TotalChips value={myChipsWon()} />
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

/** Profildeki ayarlar: fotoğraf, davetler, ses ve hesabı silme (sohbet masada açılıp kapatılır). */
function SettingsPanel({ settings, onSettings }: { settings: Settings; onSettings: (s: Settings) => void }) {
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const rows: { key: keyof Settings; label: string; hint: string; on: boolean }[] = [
    { key: "showPhoto", label: t("setShowPhoto"), hint: t("setShowPhotoHint"), on: settings.showPhoto !== false },
    { key: "invites", label: t("setInvites"), hint: t("setInvitesHint"), on: settings.invites !== false },
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
      <button type="button" className="rate-row" onClick={() => {
        if (!openStoreReview()) return setChoose(true);
        // Mağaza açılmadıysa (sayfa hâlâ önde) bağlantıları da göster
        setTimeout(() => { if (document.visibilityState === "visible") setChoose(true); }, 1500);
      }}>
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
export function SeatStatsModal({ state, seat, onClose, onAddFriend, onGift, vip = false, vipRoom = false, rate, chipsWon }: { state: GameState; seat: number; onClose: () => void; onAddFriend?: () => void; onGift?: () => void; vip?: boolean; vipRoom?: boolean; rate?: number | null; chipsWon?: number | null }) {
  if (seat === 0) return <MyStatsModal name={state.players[0].name} onClose={onClose} standalone />;
  const p = state.players[seat];
  const sums = totals(state);
  const active = state.phase === "draw" || state.phase === "play";
  const score = sums[seat] + (active ? p.points ?? 0 : 0);
  const live = sums.map((v, i) => v + (active ? state.players[i].points ?? 0 : 0));
  const rank = [...live].sort((a, b) => b - a).indexOf(score) + 1;
  const words = state.table.filter((w) => w.owner === seat && !w.pair);
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal profile-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="profile-close" onClick={onClose} aria-label={t("close")}>✕</button>
        <div className="profile-banner">
          <Avatar name={p.name} seat={seat} size="lg" vip={vip} rate={rate} />
          <div className="profile-name">{p.name}</div>
          {vip && <div className="vip-badge-line">👑 {t("vipBadge")}</div>}
          {vipRoom && !vip && !p.isBot && <div className="opp-vip">{t("oppNotVip")}</div>}
          <div className="muted small">{p.isBot ? t("computerPlayer") : t("thisGame")}</div>
        </div>
        <div className="profile-summary">
          <div className="stat stat-rate">
            <div className="rate-circle">{formatNumber(score)}</div>
            <div className="stat-label big-label">{t("stGameTotal")} · {rank}.</div>
          </div>
          {/* Hayatı boyunca masalardan kazandığı çip (bilgisayar oyuncusunda yok) */}
          <TotalChips value={chipsWon ?? null} />
          <div className="stats-row2">
            <Box label={t("stHandsWon")} value={`${handWinsOf(state, seat)} / ${state.results?.length ?? 0}`} />
            <Box label={t("stHandPoints")} value={active ? p.points ?? 0 : "–"} />
          </div>
          <div className="stats-row2">
            <Box label={t("stWordsNow")} value={words.length} />
            <Box label={t("stBestMove")} value={active ? p.bestPlay ?? 0 : "–"} />
          </div>
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
