"""Uygulama simgesine W taşının iki yanına minik A-B-C taşları ekler (yukarıdan aşağıya).

A kırmızı, B sarı, C yeşil; harfler krem renkli minik okey taşlarının üstünde (yeşil zeminde
de okunur). Taşlar Android uyarlanabilir simgesinin güvenli alanında kalır.
Kullanım: python3 tools/icon_abc.py <kaynak.png> <çıktı.png>
"""
import sys
from PIL import Image, ImageDraw, ImageFont

FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
LETTERS = [("A", (198, 40, 40)), ("B", (232, 160, 0)), ("C", (46, 125, 50))]


def add_abc(img: Image.Image) -> Image.Image:
    scale = 4  # yumuşak kenarlar için büyük çizip küçült
    W, H = img.size
    layer = Image.new("RGBA", (W * scale, H * scale), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    s = W / 1024 * scale
    tile, gap, radius = 70 * s, 16 * s, 12 * s
    font = ImageFont.truetype(FONT, int(52 * s))
    total = 3 * tile + 2 * gap
    top = 360 * s - total / 2
    for cx in (214 * s, 810 * s):
        for i, (ch, col) in enumerate(LETTERS):
            x0, y0 = cx - tile / 2, top + i * (tile + gap)
            # gölge, taş, alt kenar (büyük W taşıyla aynı üslup)
            d.rounded_rectangle([x0 + 3 * s, y0 + 5 * s, x0 + tile + 3 * s, y0 + tile + 5 * s], radius, fill=(0, 0, 0, 90))
            d.rounded_rectangle([x0, y0, x0 + tile, y0 + tile], radius, fill=(251, 243, 223, 255), outline=(201, 185, 143, 255), width=int(4 * s))
            d.rounded_rectangle([x0 + 2 * s, y0 + tile - 9 * s, x0 + tile - 2 * s, y0 + tile - 2 * s], 4 * s, fill=(140, 123, 82, 255))
            bb = d.textbbox((0, 0), ch, font=font)
            tw, th = bb[2] - bb[0], bb[3] - bb[1]
            d.text((cx - tw / 2 - bb[0], y0 + (tile - 9 * s - th) / 2 - bb[1]), ch, font=font, fill=col + (255,))
    layer = layer.resize((W, H), Image.LANCZOS)
    out = img.convert("RGBA")
    out.alpha_composite(layer)
    return out


if __name__ == "__main__":
    src, dst = sys.argv[1], sys.argv[2]
    im = Image.open(src)
    res = add_abc(im)
    if im.mode == "RGB":
        res = res.convert("RGB")
    res.save(dst)
