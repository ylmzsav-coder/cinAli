import { canCloseGame, closeGame } from "../exit";
import { FEEDBACK_EMAIL, FEEDBACK_MAX, type FeedbackType, feedbackMailto, submitFeedback } from "../feedbackBox";
import { stopMusic } from "../music";
import { buzz, tileSound } from "../feedback";
import { useEffect, useRef, useState } from "react";
import { useWallet } from "../economy/useWallet";
import { DAILY_BONUS, REFILL_CHIPS, WELCOME_CHIPS, WELCOME_GAMES, isOwner, setOwner, wallet } from "../economy/wallet";
import type { BotLevel } from "../game/bot";
import { LANGS, LANG_ORDER, LangCode, PLAYABLE_LANGS } from "../game/lang";
import { errorText, formatNumber, t } from "../i18n";
import { type Gender, Settings } from "../storage";
import { BrandLogo } from "./BrandLogo";
import { CartIcon } from "./CartIcon";
import { type TwoMode } from "./TwoPlayer";
import { TwoLobby } from "./Lobby";
import { Chips } from "./Chips";
import { type TableConfig, isVipType, tableById, winnerPrize } from "../economy/tables";
import { VipModal } from "./Vip";
import { CLOUD } from "../online/cloud";
import { type TableInvite, declineInvite, friendsStatus } from "../online/social";
import { Avatar, MyStatsModal } from "./Profile";

interface HubProps {
  settings: Settings;
  onSettings: (s: Settings) => void;
  canResume: boolean;
  resumeLabel: string;
  onResume: () => void;
  onTables: () => void;
  /** Masaya doğrudan otur (Çaylak / Usta). */
  onSitTable: (tb: TableConfig, want?: Gender) => void;
  /** İki kişilik oda: rastgele oyuncu, arkadaşla ya da bilgisayara karşı. */
  onTwo: (tb: TableConfig, mode: TwoMode) => void;
  onPractice: () => void;
  onShop: () => void;
  onRules: () => void;
  /** Arkadaşın masasını izle. */
  onWatch?: (tableId: string) => void;
  /** Gelen masa davetine katıl (davet kodu). */
  onJoinInvite?: (code: string) => void;
}

/** Gülen oyuncu simgesi (koyu daire içinde gülen yüz ve omuzlar; özgün çizim). */
function PlayerIcon() {
  return (
    <svg viewBox="0 0 64 64" className="player-ico">
      <defs><clipPath id="piClip"><circle cx="32" cy="32" r="30" /></clipPath></defs>
      <circle cx="32" cy="32" r="30" fill="#3a3a3a" />
      <g clipPath="url(#piClip)">
        <ellipse cx="32" cy="64" rx="24" ry="20" fill="#ffffff" />
      </g>
      <circle cx="32" cy="25" r="12" fill="#ffffff" />
      <circle cx="27.5" cy="23" r="1.9" fill="#3a3a3a" />
      <circle cx="36.5" cy="23" r="1.9" fill="#3a3a3a" />
      <path d="M26.5 28 Q32 34.5 37.5 28 Z" fill="#3a3a3a" />
      <circle cx="32" cy="32" r="30" fill="none" stroke="#2a2a2a" strokeWidth="1.5" />
    </svg>
  );
}

export function Hub({ settings, onSettings, canResume, resumeLabel, onResume, onTables, onSitTable, onTwo, onPractice, onShop, onRules, onWatch, onJoinInvite }: HubProps) {
  const w = useWallet();
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(id);
  }, [toast]);
  const [statsOpen, setStatsOpen] = useState(false);
  const [vipOpen, setVipOpen] = useState(false);
  const [ozelOpen, setOzelOpen] = useState(false);
  const [vipLobby, setVipLobby] = useState(false);
  const ownerTaps = useRef(0);
  // Gelen masa davetleri (sunucu açıkken yarım dakikada bir bakılır)
  const [invite, setInvite] = useState<TableInvite | null>(null);
  useEffect(() => {
    if (!CLOUD || !onJoinInvite) return;
    const check = () => friendsStatus().then((r) => setInvite(r.invites?.[0] ?? null), () => {});
    check();
    const id = setInterval(check, 10_000);
    return () => clearInterval(id);
  }, [onJoinInvite]);
  // Çipi biten oyuncunun hediye sayacı (dakikada bir güncellenir)
  const refillAt = w.ready ? wallet.refillAt() : null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (refillAt === null) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 20_000);
    return () => clearInterval(id);
  }, [refillAt]);
  const [closeAsk, setCloseAsk] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  // Yeni oyuncuya hoş geldin hediyesi (bir kez gösterilir)
  const [welcomeSeen, setWelcomeSeen] = useState(() => {
    try {
      return localStorage.getItem("wordokey.welcomeSeen") === "1";
    } catch {
      return false;
    }
  });
  const closeWelcome = () => {
    setWelcomeSeen(true);
    try {
      localStorage.setItem("wordokey.welcomeSeen", "1");
    } catch {
      /* yok say */
    }
  };
  const [closed, setClosed] = useState(false);
  const doClose = async () => {
    setCloseAsk(false);
    stopMusic(0.3);
    if (!(await closeGame())) setClosed(true);
  };

  // Tarayıcı sekmeyi kapatmaya izin vermediyse: kapandı ekranı
  if (closed)
    return (
      <div className="page closed-screen">
        <p className="closed-title">👋 {t("closedTitle")}</p>
        <p className="muted">{t("closedHint")}</p>
        <button type="button" className="primary big" onClick={() => setClosed(false)}>{t("reopen")}</button>
      </div>
    );

  const changeUi = (code: LangCode) =>
    onSettings({ ...settings, uiLang: code, gameLang: LANGS[code].playable ? code : settings.gameLang });

  return (
    <div className="page hub">
      <div className="hub-top">
        <div className="lang-bar">
          <label>
            <span aria-hidden>🌐</span>
            <span className="sr-only">{t("language")}</span>
            <select value={settings.uiLang} onChange={(e) => changeUi(e.target.value as LangCode)} aria-label={t("language")}>
              {LANG_ORDER.map((c) => <option key={c} value={c}>{LANGS[c].name}</option>)}
            </select>
          </label>
          <label>
            <span className="muted small">{t("wordLanguage")}</span>
            <select value={settings.gameLang} aria-label={t("wordLanguage")}
              onChange={(e) => onSettings({ ...settings, gameLang: e.target.value as LangCode })}>
              {PLAYABLE_LANGS.map((c) => <option key={c} value={c}>{LANGS[c].name}</option>)}
            </select>
          </label>
        </div>
        <div className="daily-slot">
        {wallet.canClaimDaily() && (
          <button type="button" className="gift big daily-top" onClick={async () => {
            try {
              await wallet.claimDaily();
              setToast(t("dailyToast", { n: DAILY_BONUS }));
            } catch (e) {
              setToast(errorText(e));
            }
          }}>
            {t("dailyClaim")}
          </button>
        )}
        {refillAt !== null && (refillAt <= now ? (
          <button type="button" className="gift big daily-top" onClick={async () => {
            try {
              await wallet.claimRefill();
              setToast(t("refillToast", { n: REFILL_CHIPS }));
            } catch (e) {
              setToast(errorText(e));
            }
          }}>
            {t("refillClaim", { n: REFILL_CHIPS })}
          </button>
        ) : (
          <p className="muted refill-wait">{t("refillWait", { n: REFILL_CHIPS, t: refillLeft(refillAt - now) })}</p>
        ))}
        </div>
        <div className="toggles">
          {([
            ["music", "🎵", "🎵"],
            ["sound", "🔊", "🔇"],
            ["vibration", "📳", "📴"],
          ] as const).map(([key, onIco, offIco]) => {
            const on = !!settings[key];
            return (
              <button key={key} type="button" className={`toggle ${on ? "on" : "off"}`} aria-pressed={on} title={t(key)}
                onClick={() => {
                  const next = !on;
                  onSettings({ ...settings, [key]: next });
                  // Menüde etkisi görünmeyen ayarlar için anında geri bildirim
                  if (next && key === "sound") tileSound("drop");
                  if (next && key === "vibration") buzz(true);
                  setToast(t(next ? "toggleOn" : "toggleOff", { name: t(`${key}Setting` as "soundSetting") }));
                }}>
                {on ? onIco : offIco}<span className="toggle-label"> {t(key)}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="hub-main">
        <div className="hub-left">
          <Logo />
          <p className="muted tagline">{t("tagline")}</p>
          <div className="hub-me">
            <button type="button" className="profile-chip" onClick={() => setStatsOpen(true)} aria-label={t("myProfile")}>
              <Avatar name={settings.name || t("defaultName")} seat={0} size="md" />
              <span>{t("myProfile")}</span>
            </button>
            <button type="button" className="balance" onClick={onShop} aria-label={t("balanceAria")}>
              <Chips amount={w.balance} big loading={!w.ready} />
              <span className="plus-chip">+</span>
            </button>
          </div>
          {ozelOpen && (
            <TwoLobby name={settings.name || t("defaultName")} onClose={() => setOzelOpen(false)}
              onPick={(tb, mode) => { setOzelOpen(false); onTwo(tb, mode); }} />
          )}
          {vipLobby && (
            <TwoLobby vip name={settings.name || t("defaultName")} gender={settings.gender}
              onGender={(g) => onSettings({ ...settings, gender: g })} onClose={() => setVipLobby(false)}
              onPick={(tb, mode) => { setVipLobby(false); onTwo(tb, mode); }}
              onSeek={(tb, want) => { setVipLobby(false); onSitTable(tb, want); }} />
          )}
          {vipOpen && <VipModal onClose={() => setVipOpen(false)} onSubscribed={() => setTimeout(() => { setVipOpen(false); setVipLobby(true); }, 1200)} />}
          {statsOpen && <MyStatsModal name={settings.name} onClose={() => setStatsOpen(false)} onWatch={onWatch} onJoin={onJoinInvite}
            gender={settings.gender} onGender={(g) => onSettings({ ...settings, gender: g })} />}
        </div>
        <div className="hub-right">
          {/* Özel Oda (2 kişilik): rastgele oyuncu, arkadaş ya da bilgisayar */}
          <button type="button" className="big vip-hub caylak-hub" onClick={() => (wallet.isVip() ? setVipLobby(true) : setVipOpen(true))}>
            <span>👑 {t("vipShort")}</span>
            <span className="caylak-sub">💬 {t("vipChatGame")} · {t("twoPlayers")}</span>
          </button>
          {invite && onJoinInvite && (
            <div className="modal-bg">
              <div className="modal invite-modal" role="alertdialog" aria-label={t("inviteTitle")}>
                <div className="invite-icon" aria-hidden>{isVipType(invite.type) ? "👑" : "🎲"}</div>
                <h3>{t("inviteTitle")}</h3>
                <p className="invite-text">{t("inviteWaiting", { name: invite.name, table: isVipType(invite.type) ? t("vipShort") : invite.type.startsWith("ozel") ? t("ozelShort") : t(`table_${invite.type}` as "table_vip") })}</p>
                {isVipType(invite.type) && <p className="muted small">{t("inviteVipFree")}</p>}
                <div className="modal-actions">
                  <button type="button" className="primary" onClick={() => { const c = invite.code; setInvite(null); onJoinInvite(c); }}>✅ {t("inviteAccept")}</button>
                  <button type="button" className="danger" onClick={() => { void declineInvite(invite.tableId); setInvite(null); }}>✖ {t("decline")}</button>
                </div>
              </div>
            </div>
          )}
          {toast && <div className="toast">{toast}</div>}
          {canResume && <button type="button" className="primary big" onClick={onResume}>{resumeLabel}</button>}
          <div className="hub-row">
            {(["caylak", "usta"] as const).map((id) => {
              const tb = tableById(id)!;
              return (
                <button key={id} type="button" className={`${canResume ? "big" : "primary big"} caylak-hub ${id}-hub`} onClick={() => onSitTable(tb)}>
                  <span>{id === "caylak" ? "🫖 " : "🏎️ "}{t(id === "caylak" ? "playCaylak" : "playUsta")}</span>
                  <span className="caylak-sub">{t("entry")} <Chips amount={tb.entry} /> · {t("toWinner")} <Chips amount={winnerPrize(tb)} /></span>
                </button>
              );
            })}
          </div>
          <div className="hub-row">
            <button type="button" className="big practice-hub" onClick={onPractice}>{t("practice")}</button>
            <button type="button" className="big ozel-hub caylak-hub" onClick={() => setOzelOpen(true)}>
              <span className="ozel-top"><span className="duo-icons" aria-hidden><PlayerIcon /><PlayerIcon /></span> {t("ozelShort")}</span>
            </button>
          </div>
          <div className="hub-row">
            <button type="button" className="big shop-hub" onClick={onShop}><CartIcon /> {t("shop")}</button>
            <button type="button" className="big rules-hub" onClick={onRules}>📖 {t("rules")}</button>
          </div>
          <div className="hub-row">
            <button type="button" className="big" onClick={() => setFeedbackOpen(true)}>✉️ {t("feedback")}</button>
            {canCloseGame() && (
              <button type="button" className="big close-game" onClick={() => setCloseAsk(true)}><svg className="power-ico" viewBox="0 0 24 24" aria-hidden><path d="M12 3v8" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" fill="none" /><path d="M6.3 6.8a8 8 0 1 0 11.4 0" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" fill="none" /></svg> {t("closeGame")}</button>
            )}
          </div>
        </div>
      </div>
      {!LANGS[settings.uiLang].playable && (
        <p className="muted small">{t("wordLangSoon", { lang: LANGS[settings.uiLang].name })}</p>
      )}
      {w.welcome && !welcomeSeen && (
        <div className="modal-bg" onClick={closeWelcome}>
          <div className="modal welcome-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t("welcomeTitle")}>
            <p className="welcome-gift" aria-hidden>🎁</p>
            <h3>{t("welcomeTitle")}</h3>
            <p>{t("welcomeText", { games: WELCOME_GAMES, chips: formatNumber(WELCOME_CHIPS) })}</p>
            <div className="modal-actions">
              <button type="button" className="primary" onClick={() => { closeWelcome(); onTables(); }}>{t("welcomePlay")}</button>
              <button type="button" onClick={closeWelcome}>{t("welcomeOk")}</button>
            </div>
          </div>
        </div>
      )}
      {feedbackOpen && <FeedbackDialog lang={settings.uiLang} onClose={() => setFeedbackOpen(false)} />}
      {closeAsk && (
        <div className="modal-bg" onClick={() => setCloseAsk(false)}>
          <div className="modal quit-modal" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-label={t("closeAsk")}>
            <h3><svg className="power-ico" viewBox="0 0 24 24" aria-hidden><path d="M12 3v8" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" fill="none" /><path d="M6.3 6.8a8 8 0 1 0 11.4 0" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" fill="none" /></svg> {t("closeAsk")}</h3>
            <div className="modal-actions">
              <button type="button" className="danger" onClick={() => void doClose()}>{t("closeYes")}</button>
              <button type="button" onClick={() => setCloseAsk(false)}>{t("cancel")}</button>
            </div>
          </div>
        </div>
      )}
      <p className="muted small legal" onClick={() => {
        // Sahip (kontrol) modu: sürüm yazısına 7 kez dokun
        const n = (ownerTaps.current = ownerTaps.current + 1);
        if (n < 7) return;
        ownerTaps.current = 0;
        const on = !isOwner();
        setOwner(on);
        setToast(on ? "🔓 Sahip modu açık: bütün masalar ve VIP açık, çip bitmez (yalnızca bu cihaz)" : "🔒 Sahip modu kapalı");
      }}>{t("legal")} {t("copyright", { year: COPYRIGHT_YEAR })}{typeof __APP_VERSION__ !== "undefined" && ` · v ${__APP_VERSION__}`}{isOwner() && " · 🔓 Sahip modu"}</p>
    </div>
  );
}

/** Telif yılı (sayı biçimlendirmesi uygulanmasın diye metin). */
export const COPYRIGHT_YEAR = "2026";

export function Logo() {
  return <BrandLogo size="lg" />;
}

interface PracticeProps {
  settings: Settings;
  onStart: (s: Settings) => void;
  onBack: () => void;
}

export function Practice({ settings, onStart, onBack }: PracticeProps) {
  const [s, setS] = useState(settings);
  return (
    <div className="page menu">
      <button type="button" className="link back" onClick={onBack}>{t("back")}</button>
      <h1>{t("practiceTitle")}</h1>
      <p className="muted">{t("practiceDesc")}</p>
      <div className="form">
        <label>
          {t("yourName")}
          <input value={s.name} placeholder={t("defaultName")} maxLength={12} onChange={(e) => setS({ ...s, name: e.target.value })} />
        </label>
        <label>
          {t("opponentLevel")}
          <select value={s.level} onChange={(e) => setS({ ...s, level: e.target.value as BotLevel })}>
            <option value="kolay">{t("level_kolay")}</option>
            <option value="orta">{t("level_orta")}</option>
            <option value="zor">{t("level_zor")}</option>
          </select>
        </label>
        <label>
          {t("turnTime")}
          <select value={s.turnSeconds} onChange={(e) => setS({ ...s, turnSeconds: Number(e.target.value) })}>
            {[45, 60, 90, 120].map((n) => <option key={n} value={n}>{t("secondsN", { n })}</option>)}
            <option value={0}>{t("timerOff")}</option>
          </select>
        </label>
        <label>
          {t("gameSpeed")}
          <select value={s.speed} onChange={(e) => setS({ ...s, speed: e.target.value as Settings["speed"] })}>
            <option value="yavas">{t("speed_yavas")}</option>
            <option value="normal">{t("speed_normal")}</option>
            <option value="hizli">{t("speed_hizli")}</option>
          </select>
        </label>
      </div>
      <button type="button" className="primary big" onClick={() => onStart({ ...s, name: s.name.trim() })}>
        {t("start")}
      </button>
    </div>
  );
}

const FEEDBACK_TYPES: FeedbackType[] = ["oneri", "sikayet", "hata", "kelime"];

/** Şikâyet / öneri formu. */
function FeedbackDialog({ lang, onClose }: { lang: string; onClose: () => void }) {
  const [type, setType] = useState<FeedbackType>("oneri");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<"mail" | null>(null);
  const [lastItem, setLastItem] = useState<Parameters<typeof feedbackMailto>[0] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const send = async () => {
    const body = text.trim();
    if (!body) {
      setErr(t("feedbackEmpty"));
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const version = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "";
      const item = { type, text: body, lang, version, sentAt: Date.now() };
      setLastItem(item);
      setResult(await submitFeedback(item));
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="modal-bg feedback-bg" onClick={onClose}>
      <div className="modal feedback-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t("feedback")}>
        {result ? (
          <>
            <h3>✉️ {t("feedbackTitle")}</h3>
            <p>{t("feedbackMailOpened")}</p>
            <p className="muted small">{t("feedbackMailHint", { email: FEEDBACK_EMAIL })}</p>
            <div className="modal-actions">
              {lastItem && <a className="button-like" href={feedbackMailto(lastItem)}>{t("feedbackMailAgain")}</a>}
              <button type="button" className="primary" onClick={onClose}>{t("close")}</button>
            </div>
          </>
        ) : (
          <>
            {/* Düğmeler konu satırında: telefonda klavye açılınca da görünür kalır */}
            <h3 className="fb-title">✉️ {t("feedbackTitle")}</h3>
            <div className="fb-types" role="radiogroup">
              {FEEDBACK_TYPES.map((k) => (
                <button type="button" key={k} role="radio" aria-checked={type === k} className={type === k ? "on" : ""} onClick={() => setType(k)}>
                  {t(`fb_${k}`)}
                </button>
              ))}
              <span className="fb-count muted small">{[...text].length}/{FEEDBACK_MAX}</span>
              <div className="fb-actions">
                <button type="button" className="primary" disabled={busy} onClick={() => void send()}>{busy ? "…" : t("feedbackSend")}</button>
                <button type="button" onClick={onClose}>{t("cancel")}</button>
              </div>
            </div>
            {err && <p className="error fb-err">{err}</p>}
            <textarea value={text} maxLength={FEEDBACK_MAX} rows={2} placeholder={t("feedbackPlaceholder")}
              onChange={(e) => { setText(e.target.value); setErr(null); }} aria-label={t("feedbackPlaceholder")} />
          </>
        )}
      </div>
    </div>
  );
}

/** Kalan süre: "11 sa 42 dk". */
function refillLeft(ms: number): string {
  const min = Math.max(1, Math.ceil(ms / 60_000));
  return t("refillTime", { h: Math.floor(min / 60), m: min % 60 });
}
