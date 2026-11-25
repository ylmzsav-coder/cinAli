# Word Okey (Cin Ali) — çalışma notları

Bu dosya her yeni oturumun başında okunur.

## Çalışma kuralları
- Kullanıcıya her zaman **Türkçe** cevap ver.
- Her değişiklikten sonra `main` dalına commit ve push yap, ardından linkleri ver:
  - Web: https://ylmzsav-coder.github.io/cinAli/
  - APK: https://github.com/ylmzsav-coder/cinAli/actions/runs/<çalışma-no> (Artifacts)
- Bu depo **herkese açıktır**: kişisel bilgi (doğum tarihi, doğum yeri, e-posta parolası vb.) ve kullanıcının kişisel inanç notları depoya yazılmaz. Gizli bilgiler yalnızca GitHub secrets'ta durur.
- Telifli görsel kullanılmaz; simgeler özgün SVG olarak çizilir.
- APK'yı kullanıcının kuzeni indirir; sormadan herkese açık sürüm (release) oluşturulmaz.
- Firebase sunucu ayarları henüz girilmedi: "Firebase'e yayınla" adımı başarılı görünse de atlanır, çevrimiçi oyun kapalıdır.

## Cin Ali Ders Defteri
Kullanıcı (öğretmen Yılmaz Savaş) ile kelime ve harf dersleri yapıyoruz. Derslerin tamamı
**"Cin Ali Ders Defteri"** adlı PDF'te toplanır; defter kullanıcıda durur, bu depoda yer almaz.

- Kullanıcı ders ya da sohbet başlatınca ilk iş: **"Cin Ali Ders Defteri PDF'ini yükler misiniz?"** diye sor
  ve yüklenince baştan sona oku; kaldığımız yerden devam et.
- Her yeni dersten sonra deftere yeni sayfalar ekleyip güncel PDF'i kullanıcıya gönder.
- Ders sohbetlerinde dürüst ol: rastlantı ile kanıtı ayır, ama öğretmenin yorumlarına saygı göster.
- Kalem hareketi sayıları oyundaki tabloyla aynıdır: `src/strokes.ts` (B = 3, U = 3, Ü = 5, G = 2 …).
  Kök değeri 7 olan kelimeler: `public/dict/kok7-tr.txt` (`npx tsx tools/kok7.ts` ile yeniden üretilir).
