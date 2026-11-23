/**
 * Yaş kapısı: girişte doğum yılı bir kez sorulur.
 *  - 13 yaşından küçükler oyuna giremez (Gizlilik Politikası, mağaza kuralları);
 *  - 18 yaşından küçükler VIP Oda'ya (serbest sohbet) giremez.
 * Beyan esaslıdır; sunucuya yalnızca "18+ mı" bilgisi gönderilir (heartbeat).
 */
const KEY = "wordokey.birthYear";
export const MIN_AGE = 13;
export const ADULT_AGE = 18;

export function birthYear(): number | null {
  try {
    const v = Number(localStorage.getItem(KEY));
    return Number.isInteger(v) && v > 1900 ? v : null;
  } catch {
    return null;
  }
}
export function setBirthYear(y: number) {
  try {
    localStorage.setItem(KEY, String(y));
  } catch {
    /* depolama kapalı: oturum boyunca sorulmaz */
  }
}
/** Yıl bazında yaş (doğum günü bilinmediği için en büyük olası yaş değil, yıl farkı). */
export const ageOf = (y: number, now = new Date()) => now.getFullYear() - y;
export const isAdult = () => {
  const y = birthYear();
  return y !== null && ageOf(y) >= ADULT_AGE;
};
export const tooYoung = () => {
  const y = birthYear();
  return y !== null && ageOf(y) < MIN_AGE;
};
