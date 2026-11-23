import { t, uiLang } from "../i18n";
import { acceptVipTerms, termsFor } from "../terms";

/** Kullanım Koşulları ve Gizlilik sayfası. */
export function Terms({ onBack }: { onBack: () => void }) {
  const doc = termsFor(uiLang());
  return (
    <div className="page terms-page">
      <button type="button" className="link" onClick={onBack}>{t("back")}</button>
      <h1>{doc.title}</h1>
      <p className="muted small">{doc.updated}</p>
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
export function VipTermsModal({ onAccept, onClose, onRead }: { onAccept: () => void; onClose: () => void; onRead: () => void }) {
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
        <button type="button" className="link" onClick={onRead}>{t("termsLink")}</button>
        <div className="modal-actions">
          <button type="button" className="primary" onClick={() => { acceptVipTerms(); onAccept(); }}>{t("vipTermsAccept")}</button>
          <button type="button" onClick={onClose}>{t("cancel")}</button>
        </div>
      </div>
    </div>
  );
}
