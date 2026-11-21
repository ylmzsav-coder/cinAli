"""Vikisözlük veri dosyasından (pages-articles.xml, stdin) bir dilin
madde başlıklarını ve sözcük türlerini çıkarır: "başlık<TAB>tür1,tür2".

Kullanım:
  curl -s https://dumps.wikimedia.org/dewiktionary/latest/dewiktionary-latest-pages-articles.xml.bz2 \
    | bzcat | python3 tools/wiktionary_lemmas.py de > de_lemmas.tsv
  (it için itwiktionary)

Vikisözlük içeriği CC BY-SA lisanslıdır.
"""
import re
import sys

CFG = {
    # de.wiktionary: "== Haus ({{Sprache|Deutsch}}) ==" ve "{{Wortart|Substantiv|Deutsch}}"
    "de": {
        "section": re.compile(r"^==\s*[^=].*\{\{Sprache\|Deutsch\}\}.*==\s*$", re.M),
        "pos": re.compile(r"\{\{Wortart\|([^|}]+)\|Deutsch\}\}"),
    },
    # it.wiktionary: "== {{-it-}} ==" ve "{{-sost-|it}}"
    "it": {
        "section": re.compile(r"^==\s*\{\{-it-\}\}\s*==\s*$", re.M),
        "pos": re.compile(r"\{\{-([a-z][a-z ]*)-\|it\}\}"),
    },
}
LEVEL2 = re.compile(r"^==[^=].*==\s*$", re.M)


def main(lang: str) -> None:
    cfg = CFG[lang]

    def handle(title: str, ns: str, text: str) -> None:
        if ns != "0" or not title:
            return
        m = cfg["section"].search(text)
        if not m:
            return
        nxt = LEVEL2.search(text, m.end())
        sec = text[m.end(): nxt.start() if nxt else len(text)]
        pos = sorted(set(cfg["pos"].findall(sec)))
        if pos:
            sys.stdout.write(f"{title}\t{','.join(pos)}\n")

    title, ns, buf, in_text = "", "", [], False
    for line in sys.stdin:
        if not in_text:
            s = line.strip()
            if s.startswith("<title>"):
                title = s[7:-8]
                continue
            if s.startswith("<ns>"):
                ns = s[4:-5]
                continue
            i = line.find("<text")
            if i < 0:
                continue
            line = line[line.find(">", i) + 1:]
            buf, in_text = [], True
        end = line.find("</text>")
        if end >= 0:
            buf.append(line[:end])
            handle(title, ns, "".join(buf))
            buf, in_text = [], False
        else:
            buf.append(line)


if __name__ == "__main__":
    main(sys.argv[1])
