# Word Okey

Harflerle oynanan, okey tarzı kelime oyunu. Taşlarla anlamlı kelimeler kurulur;
web tarayıcısında, Android ve iOS'ta oynanır.

## Oynanış

- **Yatay, tam ekran:** Uygulama yatay açılır; açılışta "Başlamak için dokunun" ile tam ekran ve
  oyuna özel giriş müziği (hicaz makamı, darbuka ritmi; kod içinde üretilir) başlar.
- **Okey ıstakası:** 2 raf × 16 yuva. Taşlar parmakla istenen yuvaya sürüklenir; yan yana duran
  taşlar bir kelimedir, kelimeler arasında boşluk bırakılır. Istakanın üstünde her kelimenin değeri
  ve toplam (101'e göre) canlı görünür; "Eli Aç" geçerli kelimelerin hepsini açar.
- **Sürükle-bırak:** desteden/soldan çekilen taşı istenen yuvaya bırakma, taşı atma alanına
  sürükleyerek atma, rakibin kelimesinin başına/sonuna sürükleyerek işleme (seçili taşlar birlikte).
- **Taş sesleri:** tutma, bırakma, atma ve kelime açmada gerçekçi taş sesleri (kod içinde üretilir).

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
değiştirilebilir. Her dilin taş dağılımı (toplam 94 harf + 1 joker = 95 taş) `src/game/lang.ts` içindedir ve
bot simülasyonuyla dengelenmiştir. Çeviriler `src/i18n/` klasöründedir; testler her dilde tüm
anahtarların ve yer tutucuların bulunduğunu doğrular.

## Kurallar (özet)

- **Taşlar:** 94 harf taşı + 1 joker = 95 taş, harfler 4 renk (kırmızı, mavi, sarı, siyah). Renkler görseldir.
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
- **Hamle süresi:** Çipli masalarda 30 sn (pratikte 15/30/45/60 sn veya kapalı). Süre çerçevede
  yeşil → sarı → kırmızı gösterilir; son 5 saniyede tık sesi ve titreşim (menüden kapatılabilir);
  bitince gerekirse desteden çekilir ve bir taş otomatik atılır.
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

## Sunucu (Firebase)

Firebase yapılandırılmışsa çipler ve çipli masalar sunucuda yönetilir; yapılandırılmamışsa
(ör. şu anki GitHub Pages sürümü) çipler cihazda tutulur ve masalar botlarla cihazda oynanır.

- **Cüzdan:** `functions/src/wallet.ts`: hoş geldin çipi, günlük ödül, reklam ödülü, satın alma.
  Bakiye yalnızca sunucuda değişir; her değişiklik `wallets/{uid}/tx` altında kayıtlıdır.
- **Çevrimiçi masalar:** `functions/src/tables.ts`. Aynı dil ve seviyedeki oyuncular aynı
  masaya oturur; 8 sn içinde dolmayan koltuklara sunucudaki botlar oturur. Her hamle sunucuda
  oyun motoruyla doğrulanır; hamle süresini sunucu tutar; ödüller oyun sonunda sunucuda ödenir.
- **Arkadaşla özel masa:** Kurucu masa seviyesini seçip 6 haneli kod alır, "Davet et" ile linki
  paylaşır (`…#join=KOD`). Özel masalar rastgele eşleşmeye karışmaz; kurucu istediği an başlatır,
  boş koltuklara bot oturur.
- **Sohbet:** 10 hazır mesaj ve 8 emoji (`src/online/chat.ts`). Masaya yalnızca kimlik gider,
  her oyuncu mesajı kendi dilinde görür; serbest metin yoktur. Kurallar yalnızca masadaki
  oyuncuların, yalnızca izinli kimliklerle yazmasına izin verir. Pratikte botlar cevap verir.
- **Yazılı sohbet (yalnızca arkadaş masaları):** `functions/src/chat.ts`. Her mesaj sunucuda
  7 dilde küfür filtresinden geçer (`functions/src/profanity.ts`; "s1k", "a.m.k", "siiik" gibi
  kandırmalar dahil, "sıkıldım/şikayet" gibi masum kelimeler hariç). Küfürlü mesaj masaya hiç
  gitmez ve kaydedilmez; 3 denemede 10 dk sohbet kapanır. En fazla 120 karakter, bağlantı yok,
  hız sınırı var. Her oyuncunun adına dokununca **Sustur** ve **Şikâyet et** (şikâyetler son
  mesajlarla `reports` koleksiyonuna denetim için kaydedilir).
- **Gizlilik:** `firestore.rules`. Herkes yalnızca kendi ıstakasını ve cüzdanını okur;
  deste ve tam oyun durumu istemciye kapalıdır. Hiçbir şey istemciden yazılamaz.

Yerel geliştirme (emülatör, gerçek proje gerekmez):

```bash
(cd functions && npm install && npm run build)
npx firebase emulators:start --project demo-cinali
VITE_FIREBASE_EMULATOR=1 npm run dev
node tests/emulator/wallet.mjs     # cüzdan testi
node tests/emulator/tables.mjs     # iki oyunculu masa testi
node tests/emulator/chat.mjs       # sohbet güvenlik kuralları testi
```

### Yayın (Firebase Hosting + Functions)

Otomatik: `main` dalına her gönderimde `.github/workflows/firebase.yml` web sürümünü, sunucu
fonksiyonlarını ve güvenlik kurallarını yayınlar. Bunun için GitHub'da
**Settings → Secrets and variables → Actions** altında:

- **Secret** `FIREBASE_SERVICE_ACCOUNT`: Firebase konsolu → Proje ayarları → Hizmet hesapları →
  "Yeni özel anahtar oluştur" ile indirilen JSON dosyasının içeriği
- **Variables** `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
  `VITE_FIREBASE_APP_ID`: Firebase web uygulaması yapılandırması

Tanımlı değilse iş hata vermeden atlanır. Android APK derlemesi de aynı değişkenleri kullanır.
Elle yayın: `.env.example` → `.env.production.local`, ardından `npx firebase deploy --project <proje>`.
Cloud Functions için Firebase projesinin **Blaze** (kullandıkça öde) planında olması gerekir.

GitHub Pages yayını yalnızca depo herkese açıkken çalışır; depo gizlendiğinde otomatik atlanır.

## Lisans

Tescilli yazılım, tüm hakları saklıdır (`LICENSE`). Üçüncü taraf bileşenler ve sözlük
kaynakları için `THIRD_PARTY_NOTICES.md`.

## Proje yapısı

- `src/game/tiles.ts` – harfler, değerler, taş seti
- `src/game/engine.ts` – oyun kuralları ve puanlama
- `src/game/bot.ts` – bilgisayar oyuncuları (kolay/orta/zor)
- `src/ui/` – arayüz bileşenleri
- `src/game/lang.ts` – diller: alfabe, taş dağılımı
- `src/i18n/` – arayüz çevirileri
- `public/dict/<dil>.txt` – sözlükler (yaygın kelimeler önce)
- `tools/build_dict.py` – sözlükleri üreten betik
- `src/online/` – Firebase bağlantısı, çevrimiçi masa görünümü
- `functions/` – Cloud Functions (cüzdan, çevrimiçi masalar)

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

Küfür listeleri: [LDNOOBW](https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words)
(CC BY 4.0) + ekler (`tools/build_profanity.py`).

Hunspell sözlüklerinden yalnızca kök kelimeler alınır; özel adlar çıkarılır. Almanca ve İtalyanca
Hunspell sözlükleri yalnızca GPL lisanslı olduğu için (App Store dağıtımıyla uyumsuz) kullanılmadı;
bu diller Vikisözlük'ten temel sözcük türleriyle (çekimli hâller, özel adlar, kısaltmalar hariç) üretilir.
