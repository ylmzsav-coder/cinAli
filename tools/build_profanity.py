"""Küfür filtresi listelerini üretir: functions/src/profanity_lists.json

Kaynak: LDNOOBW "List of Dirty, Naughty, Obscene, and Otherwise Bad Words" (CC BY 4.0)
https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words
+ aşağıdaki elle eklenen kelimeler ve kökler.

- words: tam kelime eşleşmesi (çok kelimeli ifadeler boşlukla)
- stems: kelime başı eşleşmesi (çekimli hâlleri yakalamak için; yalnızca yanlış alarm riski düşük kökler)
- allow: bir kök tarafından yanlışlıkla yakalanmaması gereken kelimeler

Kullanım: python3 tools/build_profanity.py <LDNOOBW klasörü>
"""
import json
import sys

EXTRA = {
    "tr": {
        "words": ["amk", "aq", "amq", "amınakoyim", "amınakoyayım", "aminakoyim", "oç", "piç", "ibne", "gavat",
                  "puşt", "kahpe", "fahişe", "yavşak", "pezevenk", "dalyarak", "yarrak", "sikik", "sikim",
                  "sokayım", "sokarım", "amına", "amina", "göt", "götü", "götün", "götüne", "götünü",
                  "orospu çocuğu", "ananı sikeyim", "ananı", "avradını", "bacını",
                  # kısaltmalar ve sesli harfsiz yazımlar
                  "sktr", "siktr", "sktir", "sktrgt", "siktirgit", "sg", "skym", "skrm", "skerim", "sikiyim",
                  "amq", "amcik", "orspu", "orosbu", "oruspu", "yrk", "yarram"],
        "stems": ["orospu", "porno", "amcık", "yarak", "yarrak", "taşak", "kaltak", "götveren", "siktir", "sikerim",
                  "sikeyim", "sikiş", "sikis", "sikti", "sikmek", "siker", "sikik", "amına", "pezeven", "yavşa",
                  "gavat", "ibne", "kahpe", "puşt", "dalyara", "piç", "fahişe", "kevaşe", "sürtük", "şerefsiz"],
        "allow": ["sikke", "sikkeler"],
    },
    "en": {
        "words": ["wtf", "stfu", "fck", "fuk", "sh1t", "bs"],
        "stems": ["fuck", "shit", "bitch", "cunt", "motherf", "asshole", "nigg", "bastard", "whore", "slut", "dickhead"],
        "allow": [],
    },
    "de": {
        "words": ["scheiße", "scheisse"],
        "stems": ["fick", "scheiß", "scheiss", "hurens", "fotze", "wichser", "arschloch", "missgeburt", "spast", "schlampe"],
        "allow": [],
    },
    "fr": {
        "words": ["fdp", "ntm", "tg", "pd"],
        "stems": ["putain", "encul", "salope", "connard", "connasse", "merde", "batard", "bâtard", "nique", "pute"],
        "allow": [],
    },
    "es": {
        "words": ["hdp", "ptm", "coño"],
        "stems": ["puta", "joder", "jodid", "cabrón", "cabron", "gilipoll", "mierda", "pendej", "maric", "hijueput"],
        "allow": ["putativo"],
    },
    "it": {
        "words": ["vaffa"],
        "stems": ["cazz", "vaffanc", "stronz", "puttan", "merd", "coglion", "fottut", "bastard", "troia"],
        "allow": [],
    },
    "pt": {
        "words": ["vsf", "pqp", "fdp", "krl"],
        "stems": ["porra", "caralh", "puta", "merda", "foda", "fodid", "buceta", "viado", "cuzão", "arrombad", "babaca"],
        "allow": [],
    },
}


def main(src: str) -> None:
    out = {}
    for lang, extra in EXTRA.items():
        with open(f"{src}/{lang}.txt", encoding="utf-8") as f:
            base = [w.strip() for w in f if w.strip()]
        words = sorted({w.lower() for w in base + extra["words"]})
        out[lang] = {"words": words, "stems": sorted(set(extra["stems"])), "allow": sorted(set(extra["allow"]))}
    with open("functions/src/profanity_lists.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=0)
    print({k: (len(v["words"]), len(v["stems"])) for k, v in out.items()})


if __name__ == "__main__":
    main(sys.argv[1])
