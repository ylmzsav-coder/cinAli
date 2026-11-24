"""Türkçe sözlüğü (public/dict/tr.txt) yalnızca lisanslı kaynaklardan yeniden kurar.

Kaynaklar (hepsi lisanslı):
- Taban: Vikisözlük kelime listesi (mertemin/turkish-word-list) — CC BY-SA
- Sıklık sırası: an-array-of-turkish-words — MIT
- Doğrulama ve fiil kökleri: Zemberek-NLP sözlükleri (ahmetaa/zemberek-nlp) — Apache-2.0
- Doğrulama: hermitdave/FrequencyWords (tr) — CC BY-SA 4.0

Elle eklenen kelimeler (tools/tr_ekler.txt) yalnızca yukarıdaki lisanslı
kaynaklardan en az birinde bulunuyorsa sözlüğe girer. Fiillerin düzenli
türevleri (-ma, -maz, -abilmek, -ivermek…) lisanslı fiil köklerinden Türkçe
dil bilgisi kurallarıyla üretilir: tools/tr_turetilen.txt.

Kullanım:
  python3 tools/tr_lisansli.py <kaynak-klasörü>
Klasörde: words.txt (mertemin), words.json (an-array), tr_full.txt (FrequencyWords),
master-dictionary.dict, non-tdk.dict, proper.dict, proper-from-corpus.dict (Zemberek).
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(__file__))
from build_dict import LANGS, MAX_LEN, MIN_LEN, normalizer, remove_profane  # noqa: E402

VOWELS = set("aeıioöuü")
BACK = set("aıou")
HARMONY4 = {"a": "ı", "ı": "ı", "o": "u", "u": "u", "e": "i", "i": "i", "ö": "ü", "ü": "ü"}
VOICE = {"p": "b", "ç": "c", "t": "d", "k": "ğ"}
FOLD = str.maketrans("âîû", "aiu")
# Bu bölümlerdeki kelimeler yalnızca lisanslı bir kaynakta da bulunuyorsa sözlüğe girer
CHECKED = ("# Ek kelimeler", "# Önceki küfür", "# Özel adlar")
# Bu bölüm kuralla üretilmişti; artık tr_turetilen.txt'den (lisanslı köklerden) gelir
DROPPED = ("# Fiillerin -maz",)
# Vikisözlükte -mak/-mek ile biten ama fiil olmayan adlar (türetilmez)
NOT_VERBS = {"başmak"}


def up(w: str) -> str:
    return w.translate(FOLD).replace("i", "İ").replace("ı", "I").upper()


def zemberek(src: str):
    """Zemberek: fiiller (mastar → öznitelik), yalnızca ad/sıfat olan -mak kelimeleri, tüm kelimeler."""
    verbs, nouns, words = {}, set(), set()
    for name in ("master-dictionary.dict", "non-tdk.dict", "proper.dict", "proper-from-corpus.dict"):
        with open(os.path.join(src, name), encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                w, _, attr = line.partition(" ")
                words.add(up(w))
                # Yalnızca ana sözlük (TDK tabanlı) fiilleri türetmede kullanılır
                if name == "master-dictionary.dict" and re.fullmatch(r"[a-zçğıöşüâîû]+(mak|mek)", w):
                    if "P:" not in attr or "P:Verb" in attr:
                        verbs[w.translate(FOLD)] = attr
                    else:
                        nouns.add(w.translate(FOLD))
    return verbs, nouns - set(verbs), words


def derive(inf: str, attr: str, zemberek_verb: bool) -> list[str]:
    """Bir fiilin düzenli türevleri: -ma/-me, -maz/-mez, -abilmek/-abilme, -ivermek/-iverme."""
    stem, back = inf[:-3], inf.endswith("mak")
    vs = [c for c in stem if c in VOWELS]
    if not vs:
        return []
    last = vs[-1]
    out = [stem + ("ma" if back else "me"), stem + ("maz" if back else "mez")]
    vstem = stem
    if stem[-1] in VOICE:
        if "Voicing" in attr and "NoVoicing" not in attr:
            vstem = stem[:-1] + VOICE[stem[-1]]
        elif not zemberek_verb and len(vs) == 1:
            return out  # tek heceli, ünsüz yumuşaması belirsiz (git-/et-): yalnızca güvenli türevler
    y = "y" if stem[-1] in VOWELS else ""
    a = "a" if last in BACK else "e"
    for base in (vstem + y + a + "bil", vstem + y + HARMONY4[last] + "ver"):
        out += [base + "mek", base + "me"]
    return out


def main(src: str) -> None:
    norm = normalizer(LANGS["tr"])
    p = lambda n: os.path.join(src, n)  # noqa: E731
    with open(p("words.txt"), encoding="utf-8") as f:
        raw = [w.strip() for w in f if w.strip() and " " not in w.strip()]
    base = {n for w in raw if (n := norm(w))}
    with open(p("words.json"), encoding="utf-8") as f:
        an_array = json.load(f)
    rank = {}
    for i, w in enumerate(an_array):
        if (n := norm(w)):
            rank.setdefault(n, i)
    order = {c: i for i, c in enumerate(LANGS["tr"]["alphabet"])}
    common = sorted((w for w in base if w in rank), key=lambda w: rank[w])
    rest = sorted((w for w in base if w not in rank), key=lambda w: [order[c] for c in w])

    zverbs, znouns, zwords = zemberek(src)
    freq = set()
    with open(p("tr_full.txt"), encoding="utf-8") as f:
        for line in f:
            w, _, c = line.strip().partition(" ")
            if c.isdigit() and int(c) >= 3:
                freq.add(up(w))
    licensed = zwords | {up(w) for w in an_array} | freq

    # Elle eklenenler: lisanssız bölümlerden yalnızca lisanslı kaynakta da olanlar
    kept, removed, section = [], [], ""
    lines_out = []
    with open("tools/tr_ekler.txt", encoding="utf-8") as f:
        for line in f:
            s = line.rstrip("\n")
            if s.startswith("#"):
                section = s
                if s.startswith(CHECKED):
                    s = re.sub(r"\(.*\)", "(yalnızca lisanslı bir kaynakta — Zemberek, an-array-of-turkish-words ya da FrequencyWords — da bulunanlar)", s, count=1)
                if not s.startswith(DROPPED):
                    lines_out.append(s)
                continue
            if not s.strip():
                continue
            w = s.strip()
            if section.startswith(DROPPED):
                removed.append(w)
                continue
            if section.startswith(CHECKED) and w not in licensed:
                removed.append(w)
                continue
            kept.append(w)
            lines_out.append(w)
    with open("tools/tr_ekler.txt", "w", encoding="utf-8") as f:
        f.write("\n".join(lines_out) + "\n")

    # Lisanslı fiillerden kuralla üretilen türevler
    verbs = dict(zverbs)
    for w in raw:
        lw = w.translate(FOLD)
        if re.fullmatch(r"[a-zçğıöşü]+(mak|mek)", lw) and lw not in verbs and lw not in znouns and lw not in NOT_VERBS:
            verbs[lw] = None
    derived = []
    for inf in sorted(verbs):
        for w in derive(inf, verbs[inf] or "", verbs[inf] is not None):
            W = up(w)
            if MIN_LEN <= len(W) <= MAX_LEN:
                derived.append(W)
    derived = list(dict.fromkeys(derived))
    with open("tools/tr_turetilen.txt", "w", encoding="utf-8") as f:
        f.write("# Fiillerin düzenli türevleri (-ma, -maz, -abilmek, -abilme, -ivermek, -iverme), Türkçe dil bilgisi\n")
        f.write("# kurallarıyla lisanslı köklerden üretildi: Zemberek-NLP ana sözlüğü (Apache-2.0) ve Vikisözlük (CC BY-SA).\n")
        f.write("# Elle düzenlemeyin; python3 tools/tr_lisansli.py ile yeniden üretilir.\n")
        f.write("\n".join(derived) + "\n")

    # Fiil kökleri (TUT, GİT…): yalnızca gerçekten fiil olan mastarlardan
    out, have = [], set()
    verb_up = {up(v) for v in verbs}
    for w in common + rest + kept + derived:
        if w in have:
            continue
        have.add(w)
        out.append(w)
        if w in verb_up and len(w) - 3 >= 3:
            stem = w[:-3]
            if stem not in have:
                have.add(stem)
                out.append(stem)
    out, profane = remove_profane(out)
    with open("public/dict/tr.txt", "w", encoding="utf-8") as f:
        f.write("\n".join(out) + "\n")
    print(f"tr: {len(out)} kelime (taban {len(base)}, elle eklenen {len(kept)}, türetilen {len(derived)}); "
          f"lisanssız bölümden çıkarılan {len(removed)}, küfür {len(profane)}")


if __name__ == "__main__":
    main(sys.argv[1])
