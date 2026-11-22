import { canCloseGame, closeGame } from "../exit";
import { FEEDBACK_EMAIL, FEEDBACK_MAX, type FeedbackType, feedbackMailto, submitFeedback } from "../feedbackBox";
import { stopMusic } from "../music";
import { useEffect, useState } from "react";
import { useWallet } from "../economy/useWallet";
import { DAILY_BONUS, REFILL_CHIPS, WELCOME_CHIPS, WELCOME_GAMES, wallet } from "../economy/wallet";
import type { BotLevel } from "../game/bot";
import { LANGS, LANG_ORDER, LangCode, PLAYABLE_LANGS } from "../game/lang";
import { errorText, formatNumber, t } from "../i18n";
import { Settings } from "../storage";
import { BrandLogo } from "./BrandLogo";
import { Chips } from "./Chips";
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
  onPractice: () => void;
  onShop: () => void;
  onRules: () => void;
  /** Arkadaşın masasını izle. */
  onWatch?: (tableId: string) => void;
  /** Gelen masa davetine katıl (davet kodu). */
  onJoinInvite?: (code: string) => void;
}

export function Hub({ settings, onSettings, canResume, resumeLabel, onResume, onTables, onPractice, onShop, onRules, onWatch, onJoinInvite }: HubProps) {
  const w = useWallet();
  const [toast, setToast] = useState<string | null>(null);
  const [statsOpen, setStatsOpen] = useState(false);
  const [vipOpen, setVipOpen] = useState(false);
  // Gelen masa davetleri (sunucu açıkken yarım dakikada bir bakılır)
  const [invite, setInvite] = useState<TableInvite | null>(null);
  useEffect(() => {
    if (!CLOUD || !onJoinInvite) return;
    const check = () => friendsStatus().then((r) => setInvite(r.invites?.[0] ?? null), () => {});
    check();
    const id = setInterval(check, 30_000);
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
        <div className="toggles">
          <button type="button" className={`toggle ${settings.music ? "on" : ""}`} aria-pressed={settings.music}
            onClick={() => onSettings({ ...settings, music: !settings.music })} title={t("music")}>
            🎵<span className="toggle-label"> {t("music")}</span>
          </button>
          <button type="button" className={`toggle ${settings.sound ? "on" : ""}`} aria-pressed={settings.sound}
            onClick={() => onSettings({ ...settings, sound: !settings.sound })} title={t("sound")}>
            {settings.sound ? "🔊" : "🔇"}<span className="toggle-label"> {t("sound")}</span>
          </button>
          <button type="button" className={`toggle ${settings.vibration ? "on" : ""}`} aria-pressed={settings.vibration}
            onClick={() => onSettings({ ...settings, vibration: !settings.vibration })} title={t("vibration")}>
            📳<span className="toggle-label"> {t("vibration")}</span>
          </button>
          <button type="button" className={`toggle ${settings.chat ? "on" : ""}`} aria-pressed={settings.chat}
            onClick={() => onSettings({ ...settings, chat: !settings.chat })} title={t("chat")}>
            💬<span className="toggle-label"> {t("chat")}</span>
          </button>
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
          {vipOpen && <VipModal onClose={() => setVipOpen(false)} onSubscribed={() => setTimeout(() => { setVipOpen(false); onTables(); }, 1200)} />}
          {statsOpen && <MyStatsModal name={settings.name} onClose={() => setStatsOpen(false)} onWatch={onWatch} onJoin={onJoinInvite}
            gender={settings.gender} onGender={(g) => onSettings({ ...settings, gender: g })} />}
        </div>
        <div className="hub-right">
          {wallet.canClaimDaily() && (
            <button type="button" className="gift big" onClick={async () => {
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
            <button type="button" className="gift big" onClick={async () => {
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
          {invite && onJoinInvite && (
            <div className="invite-banner">
              <span>📨 {t(invite.type === "vip2" ? "inviteBannerVip" : "inviteBanner", { name: invite.name })}</span>
              <button type="button" className="primary small-btn" onClick={() => onJoinInvite(invite.code)}>{t("joinFree")}</button>
              <button type="button" className="link small-btn" aria-label={t("decline")} onClick={() => { void declineInvite(invite.tableId); setInvite(null); }}>✕</button>
            </div>
          )}
          {toast && <div className="toast">{toast}</div>}
          {canResume && <button type="button" className="primary big" onClick={onResume}>{resumeLabel}</button>}
          <button type="button" className={canResume ? "big" : "primary big"} onClick={onTables}>{t("chipTables")}</button>
          <div className="hub-row">
            <button type="button" className="big" onClick={onPractice}>{t("practice")}</button>
            <button type="button" className="big vip-hub" onClick={() => (wallet.isVip() ? onTables() : setVipOpen(true))}>👑 {t("vipShort")}</button>
          </div>
          <div className="hub-row">
            <button type="button" className="big" onClick={onShop}>{t("shop")}</button>
            <button type="button" className="big" onClick={onRules}>{t("rules")}</button>
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
      <p className="muted small legal">{t("legal")} {t("copyright", { year: COPYRIGHT_YEAR })}{typeof __APP_VERSION__ !== "undefined" && ` · v ${__APP_VERSION__}`}</p>
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
