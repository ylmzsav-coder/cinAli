# Cinali

Harflerle oynanan, okey tarzı kelime oyunu. Taşlarla anlamlı Türkçe kelimeler kurulur;
web tarayıcısında ve telefonda (PWA olarak "Ana ekrana ekle") oynanır.

## Kurallar (özet)

- **Taşlar:** 94 harf taşı + 2 joker, 4 renk (kırmızı, mavi, sarı, siyah). Renkler görseldir.
  A ve E her renkten birer tane (4'er adet). Dağılım `src/game/tiles.ts` içindeki `LETTER_COUNTS`'tadır.
- **Harf değeri:** Alfabedeki sıra: A=1, B=2, C=3, Ç=4 … Z=29.
- **Dağıtım:** 4 oyuncu, 14'er taş; başlayan 15 taş alır.
- **Sıra:** Desteden ya da soldakinin attığı taştan çek → oyna → bir taş at.
- **Kelime:** En az 3 harfli, sözlükte olan kelime. Kelimeler ıstakada gizlidir.
- **El açma:** Yere açılan kelimelerin toplamı en az **76** olmalı.
- **Açtıktan sonra:** Yeni kelime koyulabilir; yerdeki kelimelerin başına/sonuna harf eklenebilir.
- **Joker:** Her harfin yerine geçer, o harfin değerini alır.
- **Bitirme:** Son taşı atan biter. Çift bitirme yoktur.
- **Puan:** Bitiren **-100**; diğerleri elde kalan harflerin toplamı (joker 30); açamayan **200**.
- **Renk Bitirme:** Bitirenin yere koyduğu taşların hepsi aynı renkse **-200**.
- Belirlenen el sayısı sonunda en düşük toplam puan kazanır.

Kural değerleri `src/game/engine.ts` içindeki `RULES` nesnesinden değiştirilebilir.

## Geliştirme

```bash
npm install
npm run dev      # yerel geliştirme sunucusu
npm test         # kural motoru testleri
npm run build    # dist/ klasörüne üretim derlemesi
```

## Proje yapısı

- `src/game/tiles.ts` – harfler, değerler, taş seti
- `src/game/engine.ts` – oyun kuralları ve puanlama
- `src/game/bot.ts` – bilgisayar oyuncuları (kolay/orta/zor)
- `src/ui/` – arayüz bileşenleri
- `public/kelimeler.txt` – sözlük (yaygın kelimeler önce)
- `tools/build_dict.py` – sözlüğü üreten betik

## Sözlük kaynağı

Kelime listesi [Vikisözlük](https://tr.wiktionary.org/) tabanlı
[mertemin/turkish-word-list](https://github.com/mertemin/turkish-word-list) listesinden
(CC BY-SA) üretilmiştir. Kelime sıklık sırası `an-array-of-turkish-words` (MIT) paketinden alınmıştır.
