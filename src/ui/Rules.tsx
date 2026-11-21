import { RULES } from "../game/engine";
import { ALPHABET, LETTER_COUNTS } from "../game/tiles";

export function Rules({ onBack }: { onBack: () => void }) {
  return (
    <div className="page">
      <button type="button" className="link" onClick={onBack}>‹ Geri</button>
      <h1>Cinali Kuralları</h1>
      <ol className="rules">
        <li><b>Taşlar:</b> 104 harf taşı ve 2 joker. Harfler 4 renktedir (kırmızı, mavi, sarı, siyah). Renkler görseldir, kelime kurarken renk şartı yoktur.</li>
        <li><b>Harf değeri:</b> Her harfin değeri alfabedeki sırasıdır: A=1, B=2, C=3, Ç=4 … Z=29. Örnek: KALEM = 14+1+15+6+16 = 52.</li>
        <li><b>Dağıtım:</b> 4 oyuncu. Herkese {RULES.handSize} taş, başlayan oyuncuya 15 taş verilir. Başlayan çekmeden oynar.</li>
        <li><b>Sıra:</b> Sıra gelen oyuncu desteden ya da solundaki oyuncunun attığı taştan bir taş çeker, oynar ve bir taş atar.</li>
        <li><b>Kelime:</b> En az 3 harfli, sözlükte olan Türkçe kelime. Kelimeler ıstakada gizli tutulur.</li>
        <li><b>El açma:</b> Yere açılan kelimelerin toplam değeri en az <b>{RULES.openThreshold}</b> olmalıdır.</li>
        <li><b>Açtıktan sonra:</b> Yere yeni kelimeler koyabilir, yerdeki (kendinizin veya rakiplerin) kelimelerin başına ya da sonuna harf ekleyerek yeni geçerli bir kelime yapabilirsiniz.</li>
        <li><b>Joker:</b> Her harfin yerine geçer ve temsil ettiği harfin değerini alır.</li>
        <li><b>Bitirme:</b> Elindeki son taşı atan oyuncu eli bitirir. Çift bitirme yoktur.</li>
        <li><b>Puanlama:</b> Bitiren <b>{RULES.winScore}</b> yazar. Diğerleri elinde kalan harflerin değer toplamı kadar ceza alır (joker 30). El açamayan oyuncu <b>{RULES.unopenedPenalty}</b> ceza alır. Deste biterse el kazanansız biter.</li>
        <li><b>Renk Bitirme:</b> Bitiren oyuncunun o elde yere koyduğu taşların hepsi aynı renkteyse (joker her renge uyar) puan tablosuna <b>{RULES.colorWinScore}</b> yazılır.</li>
        <li><b>Kazanan:</b> Belirlenen el sayısı sonunda toplam puanı en düşük olan oyuncu kazanır.</li>
      </ol>
      <h2>Nasıl oynanır?</h2>
      <ul className="rules">
        <li>Istakadaki taşlara harf sırasıyla dokunun; seçim sırası kelimedeki harf sırasıdır.</li>
        <li><b>Kelime Yap</b> ile kelimeyi hazırlayın. Toplam {RULES.openThreshold}'ya ulaşınca <b>Eli Aç</b>.</li>
        <li>Açtıktan sonra taş seçip yerdeki kelimenin yanındaki <b>+</b> ile başına/sonuna ekleyin.</li>
        <li>Tur sonunda tek taş seçip <b>Taş At</b>.</li>
      </ul>
      <h2>Taş dağılımı</h2>
      <div className="dist">
        {ALPHABET.map((l) => (
          <span key={l}>{l}×{LETTER_COUNTS[l]}</span>
        ))}
      </div>
      <p className="muted small">Sözlük: Vikisözlük kelime listesi (CC BY-SA).</p>
    </div>
  );
}
