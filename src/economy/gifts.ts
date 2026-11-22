/**
 * Hediye mağazası: oyuncular çiple hediye alıp birbirine gönderir; hediye alan
 * isterse hediyesini çipe dönüştürür (değerin %80'i). Aradaki fark oyunda kalır.
 * İstemci ve sunucu (functions/) aynı kataloğu kullanır.
 */
export type GiftCategory = "erkek" | "kadin" | "herkes";

export interface Gift {
  id: string;
  emoji: string;
  category: GiftCategory;
  /** Çip değeri (100–1000). */
  value: number;
}

export const GIFTS: Gift[] = [
  // Erkeklere özel
  { id: "cay", emoji: "🍵", category: "erkek", value: 100 },
  { id: "sapka", emoji: "🎩", category: "erkek", value: 150 },
  { id: "top", emoji: "⚽", category: "erkek", value: 200 },
  { id: "gozluk", emoji: "🕶️", category: "erkek", value: 300 },
  { id: "parfum_e", emoji: "🧴", category: "erkek", value: 400 },
  { id: "gitar", emoji: "🎸", category: "erkek", value: 500 },
  { id: "saat", emoji: "⌚", category: "erkek", value: 750 },
  { id: "araba", emoji: "🏎️", category: "erkek", value: 1000 },
  // Kadınlara özel
  { id: "gul", emoji: "🌹", category: "kadin", value: 100 },
  { id: "cikolata", emoji: "🍫", category: "kadin", value: 150 },
  { id: "buket", emoji: "💐", category: "kadin", value: 200 },
  { id: "ruj", emoji: "💄", category: "kadin", value: 300 },
  { id: "elbise", emoji: "👗", category: "kadin", value: 400 },
  { id: "canta", emoji: "👜", category: "kadin", value: 500 },
  { id: "kolye", emoji: "📿", category: "kadin", value: 750 },
  { id: "yuzuk", emoji: "💍", category: "kadin", value: 1000 },
  // Herkese
  { id: "kahve", emoji: "☕", category: "herkes", value: 100 },
  { id: "pasta", emoji: "🎂", category: "herkes", value: 200 },
  { id: "ayicik", emoji: "🧸", category: "herkes", value: 250 },
  { id: "kupa", emoji: "🏆", category: "herkes", value: 500 },
  { id: "tac", emoji: "👑", category: "herkes", value: 1000 },
];

/** Hediye çipe dönüştürülünce değerin bu oranı verilir. */
export const GIFT_CONVERT_RATE = 0.8;

export const giftById = (id: string): Gift | undefined => GIFTS.find((g) => g.id === id);
export const convertValue = (g: Gift | { value: number }) => Math.floor(g.value * GIFT_CONVERT_RATE);
