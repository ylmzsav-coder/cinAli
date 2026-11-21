/**
 * Hazır mesajlar ve emoji tepkileri. Masaya yalnızca kimlik (id) gönderilir;
 * her oyuncu mesajı kendi dilinde görür. Serbest metin yoktur, bu yüzden
 * küfür/taciz riski ve dil engeli yoktur.
 */
export const CHAT_MESSAGES = [
  "hello", "goodLuck", "niceWord", "wellPlayed", "thinking",
  "hurry", "almost", "oops", "thanks", "gg",
] as const;
export type ChatMessageId = (typeof CHAT_MESSAGES)[number];

export const EMOJIS = ["👍", "👏", "😂", "😮", "😅", "😢", "😡", "🔥"] as const;

export interface ChatEvent {
  /** Görünümdeki oyuncu sırası (0 = siz). */
  seat: number;
  kind: "msg" | "emoji";
  id: string;
  at: number;
}

/** Balonun ekranda kalma süresi. */
export const BUBBLE_MS = 3500;
/** Art arda gönderme arası en az süre. */
export const CHAT_COOLDOWN_MS = 2000;

export const isValidChat = (kind: string, id: string) =>
  kind === "msg" ? (CHAT_MESSAGES as readonly string[]).includes(id) : kind === "emoji" && (EMOJIS as readonly string[]).includes(id);

/** Bilgisayar oyuncularının olası cevapları. */
export const BOT_REPLIES: Partial<Record<ChatMessageId, ChatMessageId[]>> = {
  hello: ["hello", "goodLuck"],
  goodLuck: ["thanks", "goodLuck"],
  niceWord: ["thanks"],
  wellPlayed: ["thanks"],
  hurry: ["thinking"],
  thanks: [],
  gg: ["thanks", "wellPlayed"],
};
