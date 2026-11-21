"""Vikisözlük kelime listesinden Cinali sözlüğünü üretir.

Kaynaklar:
- Kelimeler: https://github.com/mertemin/turkish-word-list (Vikisözlük, CC BY-SA)
- Sıklık sırası: npm paketi an-array-of-turkish-words (MIT) içindeki words.json

Çıktıda yaygın kelimeler önce (sıklık sırasıyla), kalanlar alfabetik gelir.
Bilgisayar oyuncuları zorluk seviyesine göre listenin başından belirli
sayıda kelime "bilir".

Kullanım: python3 tools/build_dict.py words.txt words.json public/kelimeler.txt
"""
import json
import re
import sys

ALPHABET = "abcçdefgğhıijklmnoöprsştuüvyz"
UPPER = str.maketrans(ALPHABET, "ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ")
FOLD = str.maketrans({"â": "a", "î": "i", "û": "u"})


def main(src: str, freq_src: str, dst: str) -> None:
    words = set()
    with open(src, encoding="utf-8") as f:
        for line in f:
            w = line.strip().translate(FOLD)
            if not w or " " in w:
                continue
            if not re.fullmatch(f"[{ALPHABET}]+", w):
                continue
            if 3 <= len(w) <= 15:
                words.add(w.translate(UPPER))
    order = {c: i for i, c in enumerate("ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ")}
    rank = {}
    with open(freq_src, encoding="utf-8") as f:
        for i, w in enumerate(json.load(f)):
            rank.setdefault(w.translate(UPPER), i)
    common = sorted((w for w in words if w in rank), key=lambda w: rank[w])
    rest = sorted((w for w in words if w not in rank), key=lambda w: [order[c] for c in w])
    out = common + rest
    with open(dst, "w", encoding="utf-8") as f:
        f.write("\n".join(out) + "\n")
    print(f"{len(out)} kelime ({len(common)} yaygın) yazıldı -> {dst}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3])
