import { LegalOverlay } from "./Terms";
import { useState } from "react";
import { type Account, type LoginMethod, loadAccount, saveAccount } from "../account";
import { errorText, t } from "../i18n";
import { CLOUD, connectEmail, connectFacebook } from "../online/cloud";
import { BrandLogo } from "./BrandLogo";

/**
 * Açılış ve giriş ekranı. İlk açılışta giriş yolu seçilir (Facebook, e-posta,
 * misafir); sonraki açılışlarda dokunmak yeterli. Her dokunuş tam ekran, yatay
 * mod ve giriş müziğini başlatır (tarayıcı bunu yalnızca dokunuşla izin verir).
 */
export function Splash({ onStart }: { onStart: () => void }) {
  const [account, setAccount] = useState<Account | null>(loadAccount);
  const [panel, setPanel] = useState<null | "email" | "soon">(null);
  const [legal, setLegal] = useState<null | "terms" | "privacy" | "community">(null);
  const [soonMethod, setSoonMethod] = useState<LoginMethod>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const finish = (a: Account) => {
    saveAccount(a);
    setAccount(a);
    onStart();
  };

  const facebook = async () => {
    if (!CLOUD) {
      setSoonMethod("facebook");
      setPanel("soon");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await connectFacebook();
      finish({ method: "facebook" });
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const emailLogin = async (create: boolean) => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim()) || password.length < 6) {
      setErr(t("loginEmailInvalid"));
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await connectEmail(email.trim(), password, create);
      finish({ method: "email", email: email.trim() });
    } catch {
      setErr(t(create ? "loginSignUpFailed" : "loginFailed"));
    } finally {
      setBusy(false);
    }
  };

  // Daha önce giriş yapılmışsa: dokun ve başla
  if (account && !panel)
    return (
      <div className="splash">
        <button type="button" className="splash-hit" onClick={onStart} aria-label={t("tapToStart")}>
          <BrandLogo size="lg" />
          <span className="splash-tap">{t("tapToStart")}</span>
        </button>
        <div className="splash-account">
          {account.method === "guest" ? t("accountGuest") : account.method === "facebook" ? t("accountFacebook") : t("accountEmail", { email: account.email ?? "" })}
          {" · "}
          <button type="button" className="link" onClick={() => { saveAccount(null); setAccount(null); }}>{t("changeAccount")}</button>
        </div>
      </div>
    );

  return (
    <div className="splash">
      <BrandLogo size="lg" />
      {panel === null && (
        <div className="login-buttons">
          <button type="button" className="login-btn login-fb" disabled={busy} onClick={() => void facebook()}>
            <span className="login-ico" aria-hidden>f</span><span className="login-text">{t("loginFacebook")}</span>
          </button>
          <button type="button" className="login-btn login-email" disabled={busy} onClick={() => { setErr(null); if (CLOUD) setPanel("email"); else { setSoonMethod("email"); setPanel("soon"); } }}>
            <span className="login-ico" aria-hidden>@</span><span className="login-text">{t("loginEmail")}</span>
          </button>
          <button type="button" className="login-btn login-guest" disabled={busy} onClick={() => finish({ method: "guest" })}>
            <span className="login-text">{t("loginGuest")}</span>
          </button>
        </div>
      )}
      {err && panel === null && <p className="login-err">{err}</p>}
      {panel === null && (
        <p className="login-agree">
          {t("loginAgree")}{" "}
          <button type="button" className="link" onClick={() => setLegal("terms")}>{t("termsOnly")}</button>{" · "}
          <button type="button" className="link" onClick={() => setLegal("community")}>{t("communityLink")}</button>{" · "}
          <button type="button" className="link" onClick={() => setLegal("privacy")}>{t("privacyLink")}</button>
        </p>
      )}
      {legal && <LegalOverlay kind={legal} onClose={() => setLegal(null)} />}

      {panel === "soon" && (
        <div className="login-panel">
          <h3>{soonMethod === "facebook" ? t("loginFacebook") : t("loginEmail")}</h3>
          <p>{t("loginSoon")}</p>
          <div className="login-panel-actions">
            <button type="button" className="login-btn login-guest" onClick={() => finish({ method: "guest" })}>
              <span className="login-text">{t("loginGuestContinue")}</span>
            </button>
            <button type="button" className="link" onClick={() => setPanel(null)}>{t("back")}</button>
          </div>
        </div>
      )}

      {panel === "email" && (
        <form className="login-panel" onSubmit={(e) => { e.preventDefault(); void emailLogin(false); }}>
          <h3>@ {t("loginEmail")}</h3>
          <input type="email" autoComplete="email" placeholder={t("emailLabel")} value={email} onChange={(e) => setEmail(e.target.value)} />
          <input type="password" autoComplete="current-password" placeholder={t("passwordLabel")} value={password} onChange={(e) => setPassword(e.target.value)} />
          {err && <p className="login-err">{err}</p>}
          <div className="login-panel-actions">
            <button type="submit" className="primary" disabled={busy}>{t("signIn")}</button>
            <button type="button" disabled={busy} onClick={() => void emailLogin(true)}>{t("signUp")}</button>
            <button type="button" className="link" onClick={() => setPanel(null)}>{t("back")}</button>
          </div>
        </form>
      )}
    </div>
  );
}

/** Telefon dikey tutulduğunda gösterilen uyarı (yalnızca CSS ile görünür olur). */
export function RotateHint() {
  return (
    <div className="rotate-hint" role="alert">
      <div className="rotate-phone" aria-hidden>📱</div>
      <p>{t("rotateDevice")}</p>
    </div>
  );
}
