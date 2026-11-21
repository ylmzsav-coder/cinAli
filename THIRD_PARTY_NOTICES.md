# Üçüncü Taraf Bileşenler / Third-Party Notices

Word Okey'in kendi kodu ve içeriği tescilli lisans altındadır (bkz. `LICENSE`).
Aşağıdaki bileşenler kendi lisanslarıyla dağıtılır.

## Sözlükler (`public/dict/*.txt`)

Sözlük dosyaları aşağıdaki kaynaklardan **uyarlanmıştır** (filtrelenmiş, büyük harfe çevrilmiş,
sıklık sırasına göre dizilmiştir). CC BY-SA kaynaklardan uyarlanan bu kelime listeleri aynı lisansla
(**CC BY-SA 4.0**) paylaşılır; bu yalnızca kelime listesi dosyalarını kapsar, uygulamanın geri
kalanını kapsamaz.

| Dosya | Kaynak | Lisans |
|---|---|---|
| `tr.txt` | Vikisözlük kelime listesi, [mertemin/turkish-word-list](https://github.com/mertemin/turkish-word-list) | CC BY-SA |
| `tr.txt` (sıklık sırası) | [an-array-of-turkish-words](https://www.npmjs.com/package/an-array-of-turkish-words) | MIT |
| `de.txt`, `it.txt` | [Vikisözlük / Wiktionary](https://www.wiktionary.org/) veri dosyaları (dumps.wikimedia.org) | CC BY-SA 4.0 |
| `en.txt` | Hunspell `dictionary-en` (SCOWL) | MIT ve BSD |
| `fr.txt` | Hunspell `dictionary-fr` | MPL-2.0 |
| `es.txt` | Hunspell `dictionary-es` | MPL-1.1 (seçilen seçenek) |
| `pt.txt` | Hunspell `dictionary-pt` | MPL-2.0 (seçilen seçenek) |
| tümü (sıklık sırası) | [hermitdave/FrequencyWords](https://github.com/hermitdave/FrequencyWords) | CC BY-SA 4.0 |

## Küfür filtresi listeleri (`functions/src/profanity_lists.json`)

[LDNOOBW — List of Dirty, Naughty, Obscene, and Otherwise Bad Words](https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words),
**CC BY 4.0**; Word Okey tarafından eklenen kelime ve köklerle genişletilmiştir.

## Açık kaynak kütüphaneler

React (MIT), Vite (MIT), vite-plugin-pwa (MIT), Firebase JS SDK ve Firebase Admin/Functions SDK
(Apache-2.0), Capacitor ve eklentileri (MIT), Workbox (MIT). Tam liste ve sürümler
`package.json`, `functions/package.json` ve `package-lock.json` dosyalarındadır.
