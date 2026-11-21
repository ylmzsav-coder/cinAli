# Cinali

Harflerle oynanan, okey tarzı kelime oyunu. Taşlarla anlamlı kelimeler kurulur;
web tarayıcısında, Android ve iOS'ta oynanır.

## Diller

| Dil | Arayüz | Kelime oyunu | Alfabe | Sözlük |
|---|---|---|---|---|
| Türkçe | ✅ | ✅ | 29 harf (A=1 … Z=29) | 47.300 kelime |
| English | ✅ | ✅ | 26 harf | 38.000 kelime |
| Français | ✅ | ✅ | 26 harf (aksanlar katlanır: É→E) | 64.000 kelime |
| Español | ✅ | ✅ | 27 harf (Ñ ayrı harf) | 53.000 kelime |
| Português (BR) | ✅ | ✅ | 26 harf (Ç→C, aksanlar katlanır) | 234.000 kelime |
| Deutsch | ✅ | ✅ | 26 harf + Ä Ö Ü (27–29); ß → SS | 133.000 kelime |
| Italiano | ✅ | ✅ | 21 harflik İtalyan alfabesi (J K W X Y yok) | 52.000 kelime |

Arayüz dili cihaz dilinden otomatik seçilir; ana menüden arayüz dili ve kelime dili ayrı ayrı
değiştirilebilir. Her dilin taş dağılımı (toplam 94 harf + 2 joker) `src/game/lang.ts` içindedir ve
bot simülasyonuyla dengelenmiştir. Çeviriler `src/i18n/` klasöründedir; testler her dilde tüm
anahtarların ve yer tutucuların bulunduğunu doğrular.

## Kurallar (özet)

- **Taşlar:** 94 harf taşı + 2 joker, 4 renk (kırmızı, mavi, sarı, siyah). Renkler görseldir.
  A ve E her renkten birer tane (4'er adet). Dağılım `src/game/tiles.ts` içindeki `LETTER_COUNTS`'tadır.
- **Harf değeri:** Alfabedeki sıra: A=1, B=2, C=3, Ç=4 … Z=29.
- **Dağıtım:** 4 oyuncu, 14'er taş; başlayan 15 taş alır.
- **Sıra:** Desteden ya da soldakinin attığı taştan çek → oyna → bir taş at.
- **Kelime:** En az 3 harfli, sözlükte olan kelime. Kelimeler ıstakada gizlidir.
- **El açma:** Yere açılan kelimelerin toplamı en az **101** olmalı.
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
- `src/game/lang.ts` – diller: alfabe, taş dağılımı
- `src/i18n/` – arayüz çevirileri
- `public/dict/<dil>.txt` – sözlükler (yaygın kelimeler önce)
- `tools/build_dict.py` – sözlükleri üreten betik

## Sözlük kaynakları ve lisanslar

| Dil | Kelimeler | Sıklık sırası |
|---|---|---|
| tr | [Vikisözlük](https://tr.wiktionary.org/) / [mertemin/turkish-word-list](https://github.com/mertemin/turkish-word-list) (CC BY-SA) | `an-array-of-turkish-words` (MIT) |
| en | Hunspell `dictionary-en` / SCOWL (MIT ve BSD) | [FrequencyWords](https://github.com/hermitdave/FrequencyWords) (CC BY-SA 4.0) |
| fr | Hunspell `dictionary-fr` (MPL-2.0) | FrequencyWords (CC BY-SA 4.0) |
| es | Hunspell `dictionary-es` (MPL-1.1 seçeneği) | FrequencyWords (CC BY-SA 4.0) |
| pt | Hunspell `dictionary-pt` (MPL-2.0 seçeneği) | FrequencyWords (CC BY-SA 4.0) |
| de | [Vikisözlük](https://de.wiktionary.org/) veri dosyası (CC BY-SA), `tools/wiktionary_lemmas.py` | FrequencyWords (CC BY-SA 4.0) |
| it | [Vikisözlük](https://it.wiktionary.org/) veri dosyası (CC BY-SA), `tools/wiktionary_lemmas.py` | FrequencyWords (CC BY-SA 4.0) |

Hunspell sözlüklerinden yalnızca kök kelimeler alınır; özel adlar çıkarılır. Almanca ve İtalyanca
Hunspell sözlükleri yalnızca GPL lisanslı olduğu için (App Store dağıtımıyla uyumsuz) kullanılmadı;
bu diller Vikisözlük'ten temel sözcük türleriyle (çekimli hâller, özel adlar, kısaltmalar hariç) üretilir.
