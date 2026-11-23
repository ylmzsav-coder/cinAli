import { t } from "../i18n";

export type TwoMode = "random" | "friend" | "bot";

/** İki kişilik odalarda (Özel Oda ve VIP) ortak oyun düğmeleri. */
export function TwoPlayerChoices({ onRandom, onFriend, onBot, disabled }: { onRandom: () => void; onFriend: () => void; onBot: () => void; disabled?: boolean }) {
  return (
    <div className="two-choices">
      <button type="button" className="primary" disabled={disabled} onClick={onRandom}>🎲 {t("tpRandom")}</button>
      <button type="button" disabled={disabled} onClick={onFriend}>👥 {t("tpFriend")}</button>
      <button type="button" disabled={disabled} onClick={onBot}>🤖 {t("tpBot")}</button>
    </div>
  );
}
