import { t } from "../i18n";
import { BrandLogo } from "./BrandLogo";

/** Açılış: dokununca tam ekran, yatay mod ve giriş müziği başlar. */
export function Splash({ onStart }: { onStart: () => void }) {
  return (
    <button type="button" className="splash" onClick={onStart} aria-label={t("tapToStart")}>
      <BrandLogo size="lg" />
      <span className="splash-tap">{t("tapToStart")}</span>
    </button>
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
