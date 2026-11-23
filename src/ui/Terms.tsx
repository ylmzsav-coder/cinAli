import { t, uiLang } from "../i18n";
import { useState } from "react";
import { acceptVipTerms, communityFor, licensesFor, privacyFor, salesConsented, salesFor, setSalesConsent, termsFor } from "../terms";

/** Kullanım Koşulları ya da Gizlilik Politikası sayfası. */
export type LegalKind = "terms" | "privacy" | "community" | "licenses" | "sales";
export function Terms({ onBack, kind = "terms" }: { onBack: () => void; kind?: LegalKind }) {
  const doc = kind === "privacy" ? privacyFor(uiLang()) : kind === "community" ? communityFor(uiLang()) : kind === "licenses" ? licensesFor(uiLang()) : kind === "sales" ? salesFor(uiLang()) : termsFor(uiLang());
  const extra = kind !== "terms" ? (doc as ReturnType<typeof privacyFor>) : null;
  return (
    <div className="page terms-page">
      <button type="button" className="link" onClick={onBack}>{t("back")}</button>
      {extra?.note && <p className="muted small">🌐 {extra.note}</p>}
      <h1>{doc.title}</h1>
      <p className="muted small">{doc.updated}</p>
      {extra && <p>{extra.intro}</p>}
      {doc.sections.map((s) => (
        <section key={s.h}>
          <h2>{s.h}</h2>
          <ul className="rules">{s.items.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </section>
      ))}
    </div>
  );
}

/** VIP Oda'ya ilk girişte gösterilen kurallar ve kayıt uyarısı: kabul edilmeden oda açılmaz. */
/** Tam ekran yasal metin (giriş ekranından açılır). */
export function LegalOverlay({ kind, onClose }: { kind: LegalKind; onClose: () => void }) {
  return <div className="legal-overlay"><Terms kind={kind} onBack={onClose} /></div>;
}

export function VipTermsModal({ onAccept, onClose, onRead, onPrivacy, onCommunity }: { onAccept: () => void; onClose: () => void; onRead: () => void; onPrivacy?: () => void; onCommunity?: () => void }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal vip-terms" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-label={t("vipTermsTitle")}>
        <h3>⚠️ {t("vipTermsTitle")}</h3>
        <ul>
          <li>🚫 {t("vipTerms1")}</li>
          <li>📵 {t("vipTerms2")}</li>
          <li>🗂️ {t("vipTerms3")}</li>
          <li>⛔ {t("vipTerms4")}</li>
          <li>🔞 {t("vipTerms5")}</li>
        </ul>
        <div className="legal-links">
          <button type="button" className="link" onClick={onRead}>{t("termsOnly")}</button>
          {onCommunity && <button type="button" className="link" onClick={onCommunity}>{t("communityLink")}</button>}
          {onPrivacy && <button type="button" className="link" onClick={onPrivacy}>{t("privacyLink")}</button>}
        </div>
        <div className="modal-actions">
          <button type="button" className="primary" onClick={() => { acceptVipTerms(); onAccept(); }}>{t("vipTermsAccept")}</button>
          <button type="button" onClick={onClose}>{t("cancel")}</button>
        </div>
      </div>
    </div>
  );
}

/**
 * Satın alma onayı (Mesafeli Sözleşmeler Yönetmeliği): işaretlenmeden satın alma düğmeleri çalışmaz.
 * Onay bu oturum boyunca hatırlanır.
 */
export function PurchaseConsent({ onChange }: { onChange?: (ok: boolean) => void }) {
  const [ok, setOk] = useState(salesConsented);
  const [show, setShow] = useState(false);
  return (
    <div className="purchase-consent">
      <label>
        <input type="checkbox" checked={ok} onChange={(e) => { setOk(e.target.checked); setSalesConsent(e.target.checked); onChange?.(e.target.checked); }} />
        <span>
          <button type="button" className="link" onClick={(e) => { e.preventDefault(); setShow(true); }}>{t("salesLink")}</button>{" "}
          {t("salesConsent")}
        </span>
      </label>
      {show && <LegalOverlay kind="sales" onClose={() => setShow(false)} />}
    </div>
  );
}
