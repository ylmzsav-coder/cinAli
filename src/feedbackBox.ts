/**
 * Şikâyet / öneri kutusu. Sunucu (Firebase) varsa mesaj hemen iletilir;
 * yoksa cihazda bekletilir ve sunucu kurulduğunda ilk açılışta iletilir.
 */
import { CLOUD, call } from "./online/cloud";

export type FeedbackType = "sikayet" | "oneri" | "hata" | "kelime";
export const FEEDBACK_MAX = 250;

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

/** Mesajı gönderir; "sent" sunucuya ulaştı, "saved" cihazda bekliyor. */
export async function submitFeedback(item: FeedbackItem): Promise<"sent" | "saved"> {
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
