import { useState } from "react";
import { useWallet } from "../economy/useWallet";
import { DAILY_BONUS, wallet } from "../economy/wallet";
import type { BotLevel } from "../game/bot";
import { LANGS, LANG_ORDER, LangCode, PLAYABLE_LANGS } from "../game/lang";
import { errorText, t } from "../i18n";
import { Settings } from "../storage";
import { BrandLogo } from "./BrandLogo";
import { Chips } from "./Chips";

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
}

export function Hub({ settings, onSettings, canResume, resumeLabel, onResume, onTables, onPractice, onShop, onRules }: HubProps) {
  const w = useWallet();
  const [toast, setToast] = useState<string | null>(null);

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
          <button type="button" className="balance" onClick={onShop} aria-label={t("balanceAria")}>
            <Chips amount={w.balance} big loading={!w.ready} />
            <span className="plus-chip">+</span>
          </button>
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
          {toast && <div className="toast">{toast}</div>}
          {canResume && <button type="button" className="primary big" onClick={onResume}>{resumeLabel}</button>}
          <button type="button" className={canResume ? "big" : "primary big"} onClick={onTables}>{t("chipTables")}</button>
          <button type="button" className="big" onClick={onPractice}>{t("practice")}</button>
          <div className="hub-row">
            <button type="button" className="big" onClick={onShop}>{t("shop")}</button>
            <button type="button" className="big" onClick={onRules}>{t("rules")}</button>
          </div>
        </div>
      </div>
      {!LANGS[settings.uiLang].playable && (
        <p className="muted small">{t("wordLangSoon", { lang: LANGS[settings.uiLang].name })}</p>
      )}
      <p className="muted small legal">{t("legal")} {t("copyright", { year: COPYRIGHT_YEAR })}</p>
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
          {t("handCount")}
          <select value={s.hands} onChange={(e) => setS({ ...s, hands: Number(e.target.value) })}>
            {[1, 3, 5, 7, 9].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
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
            {[15, 30, 45, 60].map((n) => <option key={n} value={n}>{t("secondsN", { n })}</option>)}
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
