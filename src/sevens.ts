/**
 * Ünlü 7'liler: yaygın olarak bilinen, kaynaklarla doğrulanabilen yedililer.
 * Metinler Türkçe (tr) ve İngilizce (en); diğer arayüz dilleri İngilizceyi gösterir.
 */
export type SevenGroup = "world" | "human" | "turkey" | "time" | "faith" | "culture";

export interface Seven {
  group: SevenGroup;
  icon: string;
  tr: { title: string; items: string };
  en: { title: string; items: string };
}

export const SEVEN_GROUPS: Record<SevenGroup, { tr: string; en: string }> = {
  world: { tr: "Dünya ve Gök", en: "World and Sky" },
  human: { tr: "İnsan", en: "Human" },
  turkey: { tr: "Türkiye ve İstanbul", en: "Türkiye and Istanbul" },
  time: { tr: "Zaman, Müzik ve Bilim", en: "Time, Music and Science" },
  faith: { tr: "İnanç ve Gelenek", en: "Faith and Tradition" },
  culture: { tr: "Kültür ve Söz", en: "Culture and Sayings" },
};

export const FAMOUS_SEVENS: Seven[] = [
  // Dünya ve Gök
  { group: "world", icon: "🌍", tr: { title: "7 kıta", items: "Asya, Afrika, Kuzey Amerika, Güney Amerika, Antarktika, Avrupa, Avustralya" }, en: { title: "7 continents", items: "Asia, Africa, North America, South America, Antarctica, Europe, Australia" } },
  { group: "world", icon: "🏛️", tr: { title: "Dünyanın 7 harikası (Antik Çağ)", items: "Giza Piramidi, Babil'in Asma Bahçeleri, Olympia Zeus Heykeli, Efes Artemis Tapınağı, Halikarnas Mozolesi (Bodrum), Rodos Heykeli, İskenderiye Feneri. İkisi bugünkü Türkiye'de." }, en: { title: "7 Wonders of the Ancient World", items: "Great Pyramid of Giza, Hanging Gardens of Babylon, Statue of Zeus at Olympia, Temple of Artemis at Ephesus, Mausoleum at Halicarnassus (Bodrum), Colossus of Rhodes, Lighthouse of Alexandria. Two are in today's Türkiye." } },
  { group: "world", icon: "🗺️", tr: { title: "Dünyanın yeni 7 harikası (2007)", items: "Çin Seddi, Petra, Kurtarıcı İsa Heykeli, Machu Picchu, Chichén Itzá, Kolezyum, Tac Mahal" }, en: { title: "New 7 Wonders of the World (2007)", items: "Great Wall of China, Petra, Christ the Redeemer, Machu Picchu, Chichén Itzá, Colosseum, Taj Mahal" } },
  { group: "world", icon: "🌈", tr: { title: "Gökkuşağının 7 rengi", items: "Kırmızı, turuncu, sarı, yeşil, mavi, lacivert, mor" }, en: { title: "7 colours of the rainbow", items: "Red, orange, yellow, green, blue, indigo, violet" } },
  { group: "world", icon: "✨", tr: { title: "Ülker: Yedi Kız Kardeş", items: "Boğa takımyıldızındaki Ülker yıldız kümesi, birçok kültürde \"yedi kardeş\" diye anılır." }, en: { title: "The Pleiades: Seven Sisters", items: "The Pleiades star cluster in Taurus is called the \"seven sisters\" in many cultures." } },
  { group: "world", icon: "🌌", tr: { title: "Büyük Kepçe'nin 7 yıldızı", items: "Büyükayı takımyıldızındaki kepçe biçimini yedi parlak yıldız çizer." }, en: { title: "7 stars of the Big Dipper", items: "Seven bright stars in Ursa Major draw the dipper shape." } },
  { group: "world", icon: "🪐", tr: { title: "Eski çağın 7 gök cismi", items: "Çıplak gözle izlenen Güneş, Ay, Merkür, Venüs, Mars, Jüpiter, Satürn. Birçok dilde haftanın gün adları bunlardan gelir." }, en: { title: "7 classical heavenly bodies", items: "Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, seen with the naked eye. Many languages name the weekdays after them." } },
  // İnsan
  { group: "human", icon: "🙂", tr: { title: "Yüzdeki 7 delik", items: "2 göz, 2 kulak, 2 burun deliği, 1 ağız" }, en: { title: "7 openings in the face", items: "2 eyes, 2 ears, 2 nostrils, 1 mouth" } },
  { group: "human", icon: "🦒", tr: { title: "Boyunda 7 omur", items: "İnsanda da zürafada da boyun omuru 7 tanedir; memelilerin neredeyse hepsinde böyledir." }, en: { title: "7 neck vertebrae", items: "Humans and giraffes both have 7 neck vertebrae, as do almost all mammals." } },
  { group: "human", icon: "👪", tr: { title: "Yedi göbek (yedi ceddi)", items: "Geçmiş yedi kuşak. Göçebe Türk boylarında yedi atasını sayabilmek bir erdem sayılırdı." }, en: { title: "Seven generations", items: "Seven generations of ancestors. In nomadic Turkic tribes, knowing them by name was a virtue." } },
  { group: "human", icon: "🧠", tr: { title: "Hafızada 7 ± 2", items: "Psikolog George Miller'a (1956) göre kısa süreli bellek bir kerede ortalama yedi (artı eksi iki) şey tutar." }, en: { title: "Memory: 7 ± 2", items: "Psychologist George Miller (1956): short-term memory holds about seven (plus or minus two) items." } },
  // Türkiye ve İstanbul
  { group: "turkey", icon: "🇹🇷", tr: { title: "Türkiye'nin 7 coğrafi bölgesi", items: "Marmara, Ege, Akdeniz, İç Anadolu, Karadeniz, Doğu Anadolu, Güneydoğu Anadolu" }, en: { title: "7 geographical regions of Türkiye", items: "Marmara, Aegean, Mediterranean, Central Anatolia, Black Sea, Eastern Anatolia, Southeastern Anatolia" } },
  { group: "turkey", icon: "🕌", tr: { title: "İstanbul'un 7 tepesi", items: "Tarihi yarımadada: Sarayburnu, Çemberlitaş, Beyazıt–Süleymaniye, Fatih, Yavuz Selim, Edirnekapı, Kocamustafapaşa. Bu yüzden İstanbul'a \"Yedi Tepeli Şehir\" denir." }, en: { title: "7 hills of Istanbul", items: "On the historic peninsula: Sarayburnu, Çemberlitaş, Beyazıt–Süleymaniye, Fatih, Yavuz Selim, Edirnekapı, Kocamustafapaşa. Hence \"City of Seven Hills\"." } },
  { group: "turkey", icon: "🏰", tr: { title: "Yedikule Hisarı", items: "İstanbul surlarının güneyinde, adını yedi kulesinden alan hisar." }, en: { title: "Yedikule Fortress", items: "Fortress on Istanbul's southern walls, named after its seven towers." } },
  { group: "turkey", icon: "💤", tr: { title: "Yedi Uyurlar (Ashab-ı Kehf)", items: "Gelenekte mağarada yıllarca uyuyan yedi genç; anlatının en bilinen yeri Efes'tir." }, en: { title: "Seven Sleepers", items: "In tradition, seven youths who slept for years in a cave; the best-known site is Ephesus." } },
  // Zaman, Müzik ve Bilim
  { group: "time", icon: "📅", tr: { title: "Haftanın 7 günü", items: "Pazartesi, salı, çarşamba, perşembe, cuma, cumartesi, pazar" }, en: { title: "7 days of the week", items: "Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday" } },
  { group: "time", icon: "🎵", tr: { title: "7 nota", items: "Do, re, mi, fa, sol, la, si" }, en: { title: "7 notes", items: "Do, re, mi, fa, sol, la, ti" } },
  { group: "time", icon: "🎲", tr: { title: "Zarın karşı yüzleri: hep 7", items: "Bir zarda karşılıklı yüzlerin toplamı her zaman 7'dir: 1+6, 2+5, 3+4." }, en: { title: "Opposite faces of a die: always 7", items: "On a die, opposite faces always add up to 7: 1+6, 2+5, 3+4." } },
  { group: "time", icon: "➗", tr: { title: "1/7 = 0,142857…", items: "7 bir asal sayıdır. 1/7'nin ondalık açılımı altı haneyi (142857) sonsuza dek tekrarlar." }, en: { title: "1/7 = 0.142857…", items: "7 is a prime. The decimal of 1/7 repeats six digits (142857) forever." } },
  // İnanç ve Gelenek
  { group: "faith", icon: "☁️", tr: { title: "Yedi kat gök", items: "Kur'an'da göklerin yedi kat olarak yaratıldığı anlatılır (örneğin Mülk suresi, 3. ayet)." }, en: { title: "Seven heavens", items: "The Quran describes the heavens as created in seven layers (e.g. Surah al-Mulk 67:3)." } },
  { group: "faith", icon: "📖", tr: { title: "Fatiha'nın 7 ayeti", items: "Kur'an'ın ilk suresi Fatiha yedi ayettir; \"seb'ul-mesânî\" (tekrarlanan yedi) diye de anılır." }, en: { title: "7 verses of al-Fatiha", items: "The Quran's opening surah has seven verses, also called \"the seven oft-repeated\"." } },
  { group: "faith", icon: "🕋", tr: { title: "Hacda 7", items: "Kâbe'nin etrafında 7 tur (tavaf), Safa ile Merve arasında 7 kez (sa'y), her şeytan taşlamada 7 taş." }, en: { title: "Sevens of the Hajj", items: "7 circuits around the Kaaba (tawaf), 7 walks between Safa and Marwa (sa'y), 7 pebbles at each stoning." } },
  { group: "faith", icon: "🕯️", tr: { title: "Yaratılışın 7. günü", items: "Tevrat'ta dünya altı günde yaratılır, yedinci gün dinlenme günüdür." }, en: { title: "The seventh day of creation", items: "In Genesis the world is made in six days; the seventh is the day of rest." } },
  { group: "faith", icon: "⚖️", tr: { title: "Yedi ölümcül günah", items: "Hristiyan geleneğinde: kibir, açgözlülük, şehvet, kıskançlık, oburluk, öfke, tembellik." }, en: { title: "Seven deadly sins", items: "In Christian tradition: pride, greed, lust, envy, gluttony, wrath, sloth." } },
  // Kültür ve Söz
  { group: "culture", icon: "🏺", tr: { title: "Roma'nın 7 tepesi", items: "Roma da İstanbul gibi yedi tepe üzerine kurulmuş bir şehir olarak bilinir." }, en: { title: "7 hills of Rome", items: "Like Istanbul, Rome is known as a city built on seven hills." } },
  { group: "culture", icon: "🦉", tr: { title: "Yunan'ın Yedi Bilgesi", items: "Antik Yunan'da bilgelikleriyle anılan yedi düşünür; aralarında Miletli Thales de vardır." }, en: { title: "Seven Sages of Greece", items: "Seven ancient Greek wise men, among them Thales of Miletus." } },
  { group: "culture", icon: "⛏️", tr: { title: "Pamuk Prenses ve Yedi Cüceler", items: "Grimm Kardeşler'in masalındaki yedi cüce." }, en: { title: "Snow White and the Seven Dwarfs", items: "The seven dwarfs of the Brothers Grimm tale." } },
  { group: "culture", icon: "🗣️", tr: { title: "Dilimizde 7", items: "\"Yedi iklim dört bucak\" (bütün dünya), \"yedi kat yerin dibi\", \"yedi düvel\" (bütün devletler), \"yedi canlı\"." }, en: { title: "7 in Turkish sayings", items: "\"Seven climes, four corners\" (the whole world), \"seven layers under the ground\", \"seven states\" (all nations), \"seven-lived\"." } },
  // Ek liste
  { group: "world", icon: "🏔️", tr: { title: "7 Zirve", items: "Her kıtanın en yüksek dağı: Everest, Aconcagua, Denali, Kilimanjaro, Elbrus, Vinson, Kosciuszko (bazı listelerde Puncak Jaya)." }, en: { title: "Seven Summits", items: "The highest peak of each continent: Everest, Aconcagua, Denali, Kilimanjaro, Elbrus, Vinson, Kosciuszko (or Puncak Jaya in some lists)." } },
  { group: "world", icon: "🐞", tr: { title: "Yedi noktalı uğur böceği", items: "En yaygın uğur böceği türünün sırtında 7 nokta vardır; Latince adı bile \"yedi noktalı\" demektir (Coccinella septempunctata)." }, en: { title: "Seven-spot ladybird", items: "The most common ladybird has 7 spots; its Latin name means \"seven-spotted\" (Coccinella septempunctata)." } },
  { group: "turkey", icon: "⛪", tr: { title: "Anadolu'nun 7 kilisesi", items: "İncil'in Vahiy kitabındaki yedi kilisenin hepsi bugünkü Türkiye'de: Efes, İzmir, Bergama, Akhisar (Tiyatira), Sart (Sardes), Alaşehir (Filadelfya), Denizli (Laodikya)." }, en: { title: "Seven Churches of Asia", items: "All seven churches of the Book of Revelation are in today's Türkiye: Ephesus, Smyrna, Pergamon, Thyatira, Sardis, Philadelphia, Laodicea." } },
  { group: "turkey", icon: "🌲", tr: { title: "Yedigöller", items: "Bolu'daki Yedigöller Milli Parkı, adını ormanın içindeki yedi gölden alır." }, en: { title: "Yedigöller (Seven Lakes)", items: "Yedigöller National Park in Bolu is named after the seven lakes in its forest." } },
  { group: "turkey", icon: "🎶", tr: { title: "Yedi Ulu Ozan", items: "Alevi-Bektaşi geleneğinde: Seyyid Nesimi, Fuzuli, Hatayi, Pir Sultan Abdal, Kul Himmet, Virani, Yemini." }, en: { title: "Seven Great Poets", items: "In the Alevi-Bektashi tradition: Nesimi, Fuzuli, Hatayi, Pir Sultan Abdal, Kul Himmet, Virani, Yemini." } },
  { group: "time", icon: "📏", tr: { title: "7 temel ölçü birimi (SI)", items: "Metre, kilogram, saniye, amper, kelvin, mol, kandela. Bilimdeki bütün ölçüler bunlardan türetilir." }, en: { title: "7 SI base units", items: "Metre, kilogram, second, ampere, kelvin, mole, candela. All scientific units derive from them." } },
  { group: "time", icon: "⚗️", tr: { title: "Periyodik tablonun 7 periyodu", items: "Bilinen bütün elementler periyodik tabloda yedi satıra (periyoda) dizilir." }, en: { title: "7 periods of the periodic table", items: "All known elements are arranged in seven rows (periods) of the periodic table." } },
  { group: "time", icon: "🌉", tr: { title: "Königsberg'in 7 köprüsü", items: "Euler 1736'da, yedi köprünün her birinden bir kez geçerek dolaşmanın imkânsız olduğunu kanıtladı; bu, çizge kuramının başlangıcı sayılır." }, en: { title: "Seven Bridges of Königsberg", items: "In 1736 Euler proved you cannot cross all seven bridges exactly once; this is seen as the birth of graph theory." } },
  { group: "time", icon: "🏆", tr: { title: "7 Milenyum Problemi", items: "Clay Matematik Enstitüsü 2000'de çözülmemiş yedi büyük problem açıkladı; her biri için 1 milyon dolar ödül var. Bugüne dek yalnızca biri (Poincaré) çözüldü." }, en: { title: "7 Millennium Prize Problems", items: "In 2000 the Clay Institute named seven unsolved problems, each with a $1 million prize. Only one (Poincaré) has been solved." } },
  { group: "faith", icon: "🕎", tr: { title: "Yedi kollu şamdan (Menora)", items: "Yahudi geleneğinin en eski simgelerinden biri, yedi kollu kandil." }, en: { title: "Seven-branched menorah", items: "The seven-branched lampstand, one of the oldest symbols of Judaism." } },
  { group: "faith", icon: "📜", tr: { title: "Muallakât: Yedi Askı", items: "İslam öncesi Arap şiirinin en ünlü yedi kasidesi; rivayete göre Kâbe'ye asıldıkları için bu adı aldılar." }, en: { title: "The Mu'allaqat: Seven Hanging Odes", items: "The seven most famous pre-Islamic Arabic odes; tradition says they were hung on the Kaaba." } },
  { group: "culture", icon: "🎓", tr: { title: "Yedi özgür sanat", items: "Orta Çağ eğitiminin temeli: dil bilgisi, retorik, mantık, aritmetik, geometri, müzik, astronomi." }, en: { title: "Seven liberal arts", items: "The basis of medieval education: grammar, rhetoric, logic, arithmetic, geometry, music, astronomy." } },
  { group: "culture", icon: "🗾", tr: { title: "Japonya'nın 7 şans tanrısı", items: "Japon geleneğinde bolluk ve mutluluk getiren yedi tanrı (Shichifukujin)." }, en: { title: "Seven Lucky Gods of Japan", items: "Seven gods of fortune and happiness in Japanese tradition (Shichifukujin)." } },
  { group: "culture", icon: "⚔️", tr: { title: "Yedi Samuray", items: "Akira Kurosawa'nın 1954 yapımı, sinema tarihinin en ünlü filmlerinden biri." }, en: { title: "Seven Samurai", items: "Akira Kurosawa's 1954 film, one of the most famous films in cinema history." } },
  { group: "culture", icon: "🕵️", tr: { title: "007: James Bond", items: "Dünyanın en ünlü casusunun kod numarası." }, en: { title: "007: James Bond", items: "The code number of the world's most famous spy." } },
  { group: "culture", icon: "📚", tr: { title: "Harry Potter: 7 kitap", items: "J. K. Rowling'in serisi yedi kitaptan oluşur; Hogwarts'ta eğitim de yedi yıl sürer." }, en: { title: "Harry Potter: 7 books", items: "J. K. Rowling's series has seven books; Hogwarts schooling also lasts seven years." } },
];
