/**
 * Şikâyet / öneri kutusu. Mesaj oyun sahibinin e-posta adresine gider:
 * oyuncunun e-posta uygulaması konu ve metin hazır şekilde açılır. Sunucu
 * (Firebase) varsa mesajın bir kopyası ayrıca sunucuya da kaydedilir.
 */
import { CLOUD, call } from "./online/cloud";

export type FeedbackType = "sikayet" | "oneri" | "hata" | "kelime";
export const FEEDBACK_MAX = 250;
/** Şikâyet ve önerilerin geleceği adres (oyun sahibinin isteğiyle). */
export const FEEDBACK_EMAIL = "ylmzsav@gmail.com";

const TYPE_TITLES: Record<FeedbackType, string> = { sikayet: "Şikayet", oneri: "Öneri", hata: "Hata bildirimi", kelime: "Kelime önerisi" };

/** E-posta bağlantısı: konu "Word Okey – <tür>", gövde mesaj + dil/sürüm bilgisi. */
export function feedbackMailto(item: FeedbackItem): string {
  const subject = `Word Okey – ${TYPE_TITLES[item.type]}`;
  const body = `${item.text}\n\n—\nDil: ${item.lang} · Sürüm: ${item.version}`;
  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Oyuncunun e-posta uygulamasını mesaj hazır şekilde açar. */
export function openFeedbackMail(item: FeedbackItem) {
  window.location.href = feedbackMailto(item);
}

export interface FeedbackItem {
  type: FeedbackType;
  text: string;
  lang: string;
  version: string;
  sentAt: number;
}

const KEY = "wordokey.feedback";

function readQueue(): FeedbackItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as FeedbackItem[];
  } catch {
    return [];
  }
}

function writeQueue(q: FeedbackItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(q.slice(-50)));
  } catch {
    /* depolama yoksa mesaj kaybolur */
  }
}

/** Mesajı e-postayla gönderir; sunucu varsa bir kopyasını da kaydeder. */
export async function submitFeedback(item: FeedbackItem): Promise<"mail"> {
  openFeedbackMail(item);
  if (CLOUD) void saveCopy(item);
  return "mail";
}

/** Sunucuya kopya; ulaşmazsa cihazda bekletilir. */
async function saveCopy(item: FeedbackItem): Promise<"sent" | "saved"> {
  if (CLOUD) {
    try {
      await call("sendFeedback", item);
      return "sent";
    } catch {
      /* bağlantı yoksa beklet */
    }
  }
  writeQueue([...readQueue(), item]);
  return "saved";
}

/** Bekleyen mesajları (sunucu varsa) iletir. Uygulama açılışında çağrılır. */
export async function flushFeedback(): Promise<void> {
  if (!CLOUD) return;
  const q = readQueue();
  if (!q.length) return;
  const left: FeedbackItem[] = [];
  for (const item of q) {
    try {
      await call("sendFeedback", item);
    } catch {
      left.push(item);
    }
  }
  writeQueue(left);
}

export const pendingFeedbackCount = () => readQueue().length;
