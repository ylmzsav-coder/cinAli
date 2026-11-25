/**
 * Kelimenin Sayısı: her harf, kalemin kaç hareketle yazıldığına göre sayılır (büyük harf).
 * Toplamın rakamları tek basamak kalana dek toplanır (sayı kökü).
 * U 3 hareket (sol dikey, alt yatay, sağ dikey: | _ |); Ü = U + iki nokta = 5.
 * B 3 hareket (dikey çizgi, üst kavis, alt kavis).
 */
export const STROKES: Record<string, number> = {
  C: 1, I: 1, J: 1, O: 1, S: 1,
  Ç: 2, D: 2, G: 2, İ: 2, L: 2, P: 2, Ş: 2, T: 2, V: 2, Q: 2, X: 2,
  A: 3, B: 3, F: 3, Ğ: 3, H: 3, K: 3, N: 3, Ö: 3, R: 3, U: 3, Y: 3, Z: 3,
  E: 4, M: 4, W: 4,
  Ü: 5,
};

/** Türkçe büyük harfe çevirir ve yalnızca sayılabilen harfleri bırakır. */
export function strokeLetters(word: string): string[] {
  return [...word.toLocaleUpperCase("tr")].filter((ch) => ch in STROKES);
}

/** Sayı kökü: 25 → 7, 16 → 7. */
export function digitalRoot(n: number): number {
  return n <= 0 ? 0 : 1 + ((n - 1) % 9);
}

export function wordNumber(word: string) {
  const letters = strokeLetters(word);
  const parts = letters.map((l) => STROKES[l]);
  const total = parts.reduce((s, n) => s + n, 0);
  return { letters, parts, total, root: digitalRoot(total) };
}

/** Uzayla ilgili altı kelime: hepsi 16 hareket, sayısı 7. */
export const SPACE_WORDS = ["ZAMAN", "GALAKSİ", "GÜNEŞ", "DÜNYA", "EVREN", "KAİNAT"];
