"""Cinali sözlüklerini üretir: public/dict/<dil>.txt

Her satır bir kelime (BÜYÜK harf, oyunun alfabesine katlanmış). Yaygın
kelimeler önce (sıklık sırasıyla), kalanlar alfabetik gelir. Bilgisayar
oyuncuları zorluk seviyesine göre listenin başından belirli sayıda kelime
"bilir".

Kaynaklar (lisanslar README'de):
- tr: Vikisözlük kelime listesi (mertemin/turkish-word-list, CC BY-SA)
      + sıklık: an-array-of-turkish-words (MIT)
- de/it: Vikisözlük (CC BY-SA) madde başlıkları; tools/wiktionary_lemmas.py
      ile çıkarılır, yalnızca temel sözcük türleri (çekimli hâller, özel
      adlar ve kısaltmalar hariç)
      + sıklık: hermitdave/FrequencyWords (CC BY-SA 4.0)
- en/fr/es/pt: Hunspell sözlükleri (npm dictionary-xx; en: MIT/BSD,
      fr: MPL-2.0, es: MPL-1.1 seçeneği, pt: MPL-2.0 seçeneği) - yalnızca
      kök kelimeler (ek/çekim türetilmez), özel adlar hariç
      + sıklık: hermitdave/FrequencyWords (CC BY-SA 4.0)

Kullanım:
  python3 tools/build_dict.py tr words.txt words.json
  python3 tools/build_dict.py en index.dic en_50k.txt
  python3 tools/build_dict.py de de_lemmas.tsv de_50k.txt
"""
import json
import re
import sys
import unicodedata

LANGS = {
    "tr": {"alphabet": "ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ", "lower": "abcçdefgğhıijklmnoöprsştuüvyz",
           "fold": {"â": "a", "î": "i", "û": "u"}},
    "en": {"alphabet": "ABCDEFGHIJKLMNOPQRSTUVWXYZ"},
    "fr": {"alphabet": "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "fold": {"æ": "ae", "œ": "oe"}, "strip_accents": True},
    "es": {"alphabet": "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ", "keep": "ñ", "strip_accents": True},
    "pt": {"alphabet": "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "strip_accents": True},
    # Almanca: 26 harf + Ä Ö Ü (alfabenin sonunda, 27-29); ß -> SS. İsimler büyük harfle yazıldığı için
    # büyük harfle başlayan kelimeler kabul edilir, tamamı büyük harf olan kısaltmalar alınmaz.
    "de": {"alphabet": "ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ", "fold": {"ß": "ss"}, "capitalized": True,
           "pos": {"Substantiv", "Verb", "Adjektiv", "Adverb", "Präposition", "Konjunktion", "Subjunktion",
                   "Pronomen", "Personalpronomen", "Possessivpronomen", "Demonstrativpronomen",
                   "Interrogativpronomen", "Relativpronomen", "Indefinitpronomen", "Reflexivpronomen",
                   "Interjektion", "Numerale", "Kardinalzahl", "Ordinalzahl", "Partikel", "Artikel",
                   "Modalpartikel", "Gradpartikel", "Fokuspartikel", "Negationspartikel", "Antwortpartikel",
                   "Lokaladverb", "Temporaladverb", "Modaladverb", "Pronominaladverb", "Konjunktionaladverb",
                   "Hilfsverb", "Postposition", "Onomatopoetikum"},
           # Aynı başlık yer/kişi adıysa alınmaz (Berlin, Anna). "Nachname" hariç tutulmaz: Koch, Bauer gerçek isim.
           "exclude": {"Toponym", "Vorname", "Eigenname", "Göttername", "Bauwerksname", "Straßenname"}},
    # İtalyanca: 21 harflik İtalyan alfabesi (J K W X Y yabancı kelimelerde; alınmaz), aksanlar katlanır.
    "it": {"alphabet": "ABCDEFGHILMNOPQRSTUVZ", "strip_accents": True,
           "pos": {"sost", "agg", "verb", "avv", "agg num", "card", "ord", "inter", "cong", "prep",
                   "pronome", "adj", "art"}},
}

MIN_LEN, MAX_LEN = 3, 15


def normalizer(cfg):
    lower = cfg.get("lower", cfg["alphabet"].lower())
    upper_map = str.maketrans(lower, cfg["alphabet"])
    fold = cfg.get("fold", {})
    keep = set(cfg.get("keep", ""))
    valid = re.compile(f"[{re.escape(lower)}]+")

    def norm(w: str):
        w = w.strip()
        if not w:
            return None
        if cfg.get("capitalized"):
            if len(w) > 1 and w.isupper():  # kısaltma
                return None
            w = w.lower()
        elif w[0].isupper():  # özel adlar ve kısaltmalar
            return None
        w = "".join(fold.get(ch, ch) for ch in w)
        if cfg.get("strip_accents"):
            w = "".join(
                ch if ch in keep else "".join(c for c in unicodedata.normalize("NFD", ch) if unicodedata.category(c) != "Mn")
                for ch in w
            )
        if not valid.fullmatch(w) or not MIN_LEN <= len(w) <= MAX_LEN:
            return None
        return w.translate(upper_map)

    return norm


def read_words(lang: str, src: str):
    pos = LANGS[lang].get("pos")
    exclude = LANGS[lang].get("exclude", set())
    if pos:
        out = []
        with open(src, encoding="utf-8") as f:
            for line in f:
                title, _, kinds = line.rstrip("\n").partition("\t")
                k = set(kinds.split(","))
                if pos & k and not exclude & k:
                    out.append(title)
        return out
    if lang == "tr":
        with open(src, encoding="utf-8") as f:
            return [line for line in f if " " not in line.strip()]
    with open(src, encoding="utf-8", errors="ignore") as f:
        lines = f.read().split("\n")[1:]
    return [line.split("/")[0] for line in lines]


def read_freq(lang: str, src: str):
    if lang == "tr":
        with open(src, encoding="utf-8") as f:
            return json.load(f)
    with open(src, encoding="utf-8") as f:
        return [line.split(" ")[0] for line in f if line.strip()]


def add_tr_verb_stems(words: list[str]) -> list[str]:
    """Türkçe fiil kökleri (emir kipi: TUT, GİT, OKU…) sözlükte yalnızca mastar
    hâliyle (TUTMAK) bulunur; kökü mastarın hemen arkasına ekler (en az 3 harf)."""
    have = set(words)
    out = []
    for w in words:
        out.append(w)
        # -ebilmek / -ivermek gibi yardımcı fiillerin kökleri (DÖNEBİL) doğal değil: atlanır
        if w.endswith(("MAK", "MEK")) and len(w) - 3 >= 3 and not w.endswith(("ABİLMEK", "EBİLMEK", "IVERMEK", "İVERMEK", "UVERMEK", "ÜVERMEK", "ADURMAK", "EDURMAK")):
            stem = w[:-3]
            if stem not in have:
                have.add(stem)
                out.append(stem)
    return out


def main(lang: str, words_src: str, freq_src: str) -> None:
    cfg = LANGS[lang]
    norm = normalizer(cfg)
    words = {n for w in read_words(lang, words_src) if (n := norm(w))}
    rank = {}
    for i, w in enumerate(read_freq(lang, freq_src)):
        n = norm(w)
        if n:
            rank.setdefault(n, i)
    order = {c: i for i, c in enumerate(cfg["alphabet"])}
    common = sorted((w for w in words if w in rank), key=lambda w: rank[w])
    rest = sorted((w for w in words if w not in rank), key=lambda w: [order[c] for c in w])
    out = common + rest
    if lang == "tr":
        out = add_tr_verb_stems(out)
    dst = f"public/dict/{lang}.txt"
    with open(dst, "w", encoding="utf-8") as f:
        f.write("\n".join(out) + "\n")
    print(f"{lang}: {len(out)} kelime ({len(common)} yaygın) -> {dst}")


if __name__ == "__main__":
    if sys.argv[1:2] == ["tr-stems"]:
        # Var olan public/dict/tr.txt dosyasına fiil köklerini ekler
        path = "public/dict/tr.txt"
        with open(path, encoding="utf-8") as f:
            ws = [w for w in f.read().split("\n") if w]
        out = add_tr_verb_stems(ws)
        with open(path, "w", encoding="utf-8") as f:
            f.write("\n".join(out) + "\n")
        print(f"tr: {len(ws)} -> {len(out)} kelime (+{len(out) - len(ws)} fiil kökü)")
    elif sys.argv[1:2] == ["tr-ekler"]:
        # tools/tr_ekler.txt'deki elle eklenen kelimeleri tr.txt'ye ekler
        path = "public/dict/tr.txt"
        with open(path, encoding="utf-8") as f:
            ws = [w for w in f.read().split("\n") if w]
        have = set(ws)
        with open("tools/tr_ekler.txt", encoding="utf-8") as f:
            extra = [w.strip() for w in f if w.strip() and not w.startswith("#")]
        new = [w for w in extra if w not in have]
        with open(path, "w", encoding="utf-8") as f:
            f.write("\n".join(ws + new) + "\n")
        print(f"tr: +{len(new)} elle eklenen kelime: {' '.join(new)}")
    else:
        main(*sys.argv[1:4])
