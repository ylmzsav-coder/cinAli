import { useState } from "react";
import { MIN_AGE, ageOf, setBirthYear } from "../age";
import { t } from "../i18n";

/** Doğum yılı sorusu (girişte bir kez). 13 yaşından küçükse oyuna devam edilemez. */
export function AgeGate({ onDone, onClose }: { onDone: () => void; onClose: () => void }) {
  const now = new Date().getFullYear();
  const [year, setYear] = useState<number | "">("");
  const [blocked, setBlocked] = useState(false);
  const submit = () => {
    if (year === "") return;
    setBirthYear(year);
    if (ageOf(year) < MIN_AGE) setBlocked(true);
    else onDone();
  };
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal age-gate" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t("ageTitle")}>
        {blocked ? (
          <>
            <h3>🙏 {t("ageTooYoungTitle")}</h3>
            <p>{t("ageTooYoung", { n: MIN_AGE })}</p>
          </>
        ) : (
          <>
            <h3>🎂 {t("ageTitle")}</h3>
            <p className="muted small">{t("ageWhy")}</p>
            <select value={year} onChange={(e) => setYear(e.target.value ? Number(e.target.value) : "")} aria-label={t("ageTitle")}>
              <option value="">{t("ageSelect")}</option>
              {Array.from({ length: 100 }, (_, i) => now - i).map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <div className="modal-actions">
              <button type="button" className="primary" disabled={year === ""} onClick={submit}>{t("continue")}</button>
              <button type="button" onClick={onClose}>{t("cancel")}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
