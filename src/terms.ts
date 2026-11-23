/**
 * Kullanım Koşulları ve KVKK / gizlilik aydınlatma metni (7 dil).
 * Metin genel bir çerçevedir; yayından önce bir hukukçunun gözden geçirmesi önerilir.
 */
import PRIVACY from "./legal/privacy.json";
import COMMUNITY from "./legal/community.json";
import LICENSES from "./legal/licenses.json";
import SALES from "./legal/sales.json";
import SELLER from "./legal/seller.json";


export interface TermsDoc {
  title: string;
  updated: string;
  sections: { h: string; items: string[] }[];
}

/** Sohbet kayıtlarının saklama süresi (functions/src/chat.ts CHAT_LOG_DAYS ile aynı). */
export const CHAT_LOG_YEARS = 2;
export const TERMS_VERSION = "2026-11-24";

const TR: TermsDoc = {
  title: "Kullanım Koşulları",
  updated: "Son güncelleme: 23.11.2026",
  sections: [
    { h: "1. Hizmet", items: [
      "Word Okey, harf taşlarıyla oynanan bir kelime oyunudur.",
      "Çipler sanal oyun parasıdır; gerçek paraya çevrilemez, devredilemez, satılamaz. Oyun kumar değildir ve gerçek para kazandırmaz.",
      "Uygulamayı kullanarak bu koşulları kabul etmiş olursun.",
    ] },
    { h: "2. Yasak davranışlar", items: [
      "Uyuşturucu, silah, yasa dışı bahis/kumar veya başka bir suçla ilgili içerik paylaşmak, bunların alım-satımını teklif etmek.",
      "Alım-satım teklifi, telefon numarası, IBAN, sosyal medya/mesajlaşma hesabı gibi iletişim veya ödeme bilgisi paylaşmak; oyuncuları oyun dışına çekmeye çalışmak.",
      "Tehdit, taciz, nefret söylemi, cinsel içerik; çocuklara yönelik her türlü istismar.",
      "Dolandırıcılık, hile, hesap paylaşımı veya hesap satışı, başkasının kimliğine bürünmek.",
      "Ayrıntılı davranış kuralları Topluluk Kuralları'nda yer alır ve bu koşulların bir parçasıdır.",
    ] },
    { h: "3. Denetim ve yaptırımlar", items: [
      "Mesajlar otomatik filtreden geçer; yasaklı içerik masaya gönderilmez ve ihlal olarak kaydedilir.",
      "İkinci ihlalde sohbet 24 saat, dördüncü ihlalde 30 gün kapatılır ve hesap incelemeye alınır.",
      "Ağır veya tekrarlanan ihlallerde hesap, uyarı yapılmadan kalıcı olarak engellenebilir; hesaptaki çipler iade edilmez.",
      "Oyuncuları profillerinden şikâyet edebilirsin; şikâyetler yönetici tarafından incelenir.",
    ] },
    { h: "4. Sohbet kayıtları ve yetkili makamlar", items: [
      `VIP Oda'daki mesajlar; gönderen hesap, oyuncu adı, masa, zaman ve IP adresiyle birlikte ${CHAT_LOG_YEARS} yıl saklanır, süre sonunda otomatik silinir.`,
      "Bu kayıtlar yalnızca yönetici tarafından ve şikâyet/ihlal incelemesi için görülür.",
      "5651 sayılı Kanun ve ilgili mevzuat gereği, mahkeme, savcılık veya yetkili kurumların talebi üzerine bu kayıtlar ilgili makamlarla paylaşılır.",
    ] },
    { h: "5. Kişisel veriler", items: ["Kişisel verilerinin nasıl işlendiği, saklandığı ve hakların Gizlilik Politikası'nda anlatılır."] },
    { h: "6. Yaş", items: [
      "VIP Oda sohbeti 18 yaşından büyükler içindir. 18 yaşından küçükler uygulamayı ebeveyn izniyle kullanmalıdır.",
    ] },
  ],
};

const EN: TermsDoc = {
  title: "Terms of Use",
  updated: "Last updated: 23 Nov 2026",
  sections: [
    { h: "1. The service", items: [
      "Word Okey is a word game played with letter tiles.",
      "Chips are virtual game currency; they cannot be exchanged for real money, transferred or sold. The game is not gambling and pays no real money.",
      "By using the app you accept these terms.",
    ] },
    { h: "2. Forbidden behaviour", items: [
      "Sharing content about drugs, weapons, illegal betting/gambling or any other crime, or offering to buy or sell them.",
      "Offering to buy or sell anything, or sharing contact or payment details such as phone numbers, IBANs or social/messaging accounts; trying to move players off the game.",
      "Threats, harassment, hate speech, sexual content; any form of child abuse.",
      "Fraud, cheating, sharing or selling accounts, impersonating others.",
      "Detailed rules of conduct are set out in the Community Guidelines, which form part of these terms.",
    ] },
    { h: "3. Moderation and sanctions", items: [
      "Messages pass an automatic filter; forbidden content is not delivered and is recorded as a violation.",
      "On the second violation chat is disabled for 24 hours, on the fourth for 30 days, and the account is reviewed.",
      "Serious or repeated violations may lead to a permanent ban without warning; chips on the account are not refunded.",
      "You can report players from their profile; reports are reviewed by an administrator.",
    ] },
    { h: "4. Chat logs and authorities", items: [
      `Messages in the VIP Room are stored for ${CHAT_LOG_YEARS} years with the sending account, player name, table, time and IP address, then deleted automatically.`,
      "These logs are seen only by the administrator, for reviewing reports and violations.",
      "Where required by law (including Turkish Law No. 5651), logs are shared with courts, prosecutors or competent authorities on their request.",
    ] },
    { h: "5. Personal data", items: ["How your personal data is processed and stored, and your rights, are explained in the Privacy Policy."] },
    { h: "6. Age", items: ["VIP Room chat is for people aged 18 and over. Under-18s should use the app with parental consent."] },
  ],
};

const DE: TermsDoc = {
  title: "Nutzungsbedingungen",
  updated: "Stand: 23.11.2026",
  sections: [
    { h: "1. Der Dienst", items: [
      "Word Okey ist ein Wortspiel mit Buchstabensteinen.",
      "Chips sind virtuelles Spielgeld; sie können nicht in echtes Geld umgetauscht, übertragen oder verkauft werden. Das Spiel ist kein Glücksspiel und zahlt kein echtes Geld aus.",
      "Mit der Nutzung der App akzeptierst du diese Bedingungen.",
    ] },
    { h: "2. Verbotenes Verhalten", items: [
      "Inhalte zu Drogen, Waffen, illegalen Wetten/Glücksspiel oder anderen Straftaten teilen oder deren Kauf/Verkauf anbieten.",
      "Kauf-/Verkaufsangebote oder das Teilen von Kontakt- und Zahlungsdaten (Telefonnummer, IBAN, Social-Media-/Messenger-Konten); Spieler aus dem Spiel locken.",
      "Drohungen, Belästigung, Hassrede, sexuelle Inhalte; jede Form von Kindesmissbrauch.",
      "Betrug, Schummeln, Teilen oder Verkaufen von Konten, Identitätsmissbrauch.",
    ] },
    { h: "3. Moderation und Sanktionen", items: [
      "Nachrichten durchlaufen einen automatischen Filter; verbotene Inhalte werden nicht zugestellt und als Verstoß gespeichert.",
      "Beim zweiten Verstoß wird der Chat für 24 Stunden gesperrt, beim vierten für 30 Tage, und das Konto wird geprüft.",
      "Bei schweren oder wiederholten Verstößen kann das Konto ohne Warnung dauerhaft gesperrt werden; Chips werden nicht erstattet.",
      "Du kannst Spieler über ihr Profil melden; Meldungen werden von einem Administrator geprüft.",
    ] },
    { h: "4. Chatprotokolle und Behörden", items: [
      `Nachrichten im VIP-Raum werden mit Konto, Spielername, Tisch, Zeit und IP-Adresse ${CHAT_LOG_YEARS} Jahre gespeichert und danach automatisch gelöscht.`,
      "Nur der Administrator sieht diese Protokolle, zur Prüfung von Meldungen und Verstößen.",
      "Soweit gesetzlich vorgeschrieben (u. a. türkisches Gesetz Nr. 5651), werden die Protokolle auf Anfrage an Gerichte, Staatsanwaltschaften oder zuständige Behörden weitergegeben.",
    ] },
    { h: "5. Personenbezogene Daten", items: ["Wie deine Daten verarbeitet und gespeichert werden und welche Rechte du hast, steht in der Datenschutzerklärung."] },
    { h: "6. Alter", items: ["Der Chat im VIP-Raum ist für Personen ab 18 Jahren. Minderjährige nutzen die App mit Zustimmung der Eltern."] },
  ],
};

const FR: TermsDoc = {
  title: "Conditions d’utilisation",
  updated: "Mise à jour : 23/11/2026",
  sections: [
    { h: "1. Le service", items: [
      "Word Okey est un jeu de mots joué avec des tuiles de lettres.",
      "Les jetons sont une monnaie virtuelle ; ils ne peuvent être ni convertis en argent réel, ni transférés, ni vendus. Le jeu n’est pas un jeu d’argent.",
      "En utilisant l’application, tu acceptes ces conditions.",
    ] },
    { h: "2. Comportements interdits", items: [
      "Partager des contenus liés aux drogues, aux armes, aux paris/jeux d’argent illégaux ou à tout autre délit, ou proposer d’en acheter ou d’en vendre.",
      "Proposer un achat/une vente ou partager des coordonnées ou moyens de paiement (téléphone, IBAN, comptes de réseaux sociaux/messagerie) ; attirer les joueurs hors du jeu.",
      "Menaces, harcèlement, discours de haine, contenu sexuel ; toute forme d’abus envers les enfants.",
      "Fraude, triche, partage ou vente de comptes, usurpation d’identité.",
    ] },
    { h: "3. Modération et sanctions", items: [
      "Les messages passent par un filtre automatique ; un contenu interdit n’est pas envoyé et est enregistré comme infraction.",
      "À la deuxième infraction le chat est désactivé 24 heures, à la quatrième 30 jours, et le compte est examiné.",
      "En cas d’infraction grave ou répétée, le compte peut être bloqué définitivement sans avertissement ; les jetons ne sont pas remboursés.",
      "Tu peux signaler un joueur depuis son profil ; les signalements sont examinés par un administrateur.",
    ] },
    { h: "4. Journaux de chat et autorités", items: [
      `Les messages du salon VIP sont conservés ${CHAT_LOG_YEARS} ans avec le compte, le nom, la table, l’heure et l’adresse IP, puis supprimés automatiquement.`,
      "Seul l’administrateur consulte ces journaux, pour examiner les signalements et infractions.",
      "Lorsque la loi l’exige (notamment la loi turque n° 5651), ils sont transmis aux tribunaux, parquets ou autorités compétentes sur demande.",
    ] },
    { h: "5. Données personnelles", items: ["Le traitement et la conservation de tes données ainsi que tes droits sont décrits dans la Politique de confidentialité."] },
    { h: "6. Âge", items: ["Le chat du salon VIP est réservé aux 18 ans et plus. Les mineurs utilisent l’application avec l’accord parental."] },
  ],
};

const ES: TermsDoc = {
  title: "Condiciones de uso",
  updated: "Actualizado: 23/11/2026",
  sections: [
    { h: "1. El servicio", items: [
      "Word Okey es un juego de palabras con fichas de letras.",
      "Las fichas de juego son moneda virtual; no se pueden cambiar por dinero real, transferir ni vender. El juego no es de apuestas.",
      "Al usar la aplicación aceptas estas condiciones.",
    ] },
    { h: "2. Conductas prohibidas", items: [
      "Compartir contenido sobre drogas, armas, apuestas/juego ilegal u otros delitos, u ofrecer comprarlos o venderlos.",
      "Ofrecer compraventa o compartir datos de contacto o pago (teléfono, IBAN, cuentas de redes sociales/mensajería); intentar sacar a los jugadores del juego.",
      "Amenazas, acoso, discurso de odio, contenido sexual; cualquier forma de abuso infantil.",
      "Fraude, trampas, compartir o vender cuentas, suplantar identidades.",
    ] },
    { h: "3. Moderación y sanciones", items: [
      "Los mensajes pasan un filtro automático; el contenido prohibido no se envía y se registra como infracción.",
      "En la segunda infracción el chat se desactiva 24 horas, en la cuarta 30 días, y la cuenta se revisa.",
      "Las infracciones graves o repetidas pueden suponer un bloqueo permanente sin aviso; las fichas no se reembolsan.",
      "Puedes denunciar a un jugador desde su perfil; un administrador revisa las denuncias.",
    ] },
    { h: "4. Registros de chat y autoridades", items: [
      `Los mensajes de la Sala VIP se guardan ${CHAT_LOG_YEARS} años con la cuenta, el nombre, la mesa, la hora y la IP, y luego se borran automáticamente.`,
      "Solo el administrador ve estos registros, para revisar denuncias e infracciones.",
      "Cuando la ley lo exija (incluida la Ley turca n.º 5651), se comparten con tribunales, fiscalías o autoridades competentes a petición de estas.",
    ] },
    { h: "5. Datos personales", items: ["Cómo se tratan y conservan tus datos y cuáles son tus derechos se explica en la Política de privacidad."] },
    { h: "6. Edad", items: ["El chat de la Sala VIP es para mayores de 18 años. Los menores deben usar la aplicación con permiso de sus padres."] },
  ],
};

const IT: TermsDoc = {
  title: "Condizioni d’uso",
  updated: "Aggiornato: 23/11/2026",
  sections: [
    { h: "1. Il servizio", items: [
      "Word Okey è un gioco di parole con tessere di lettere.",
      "I gettoni sono moneta virtuale; non si possono convertire in denaro reale, trasferire né vendere. Il gioco non è gioco d’azzardo.",
      "Usando l’app accetti queste condizioni.",
    ] },
    { h: "2. Comportamenti vietati", items: [
      "Condividere contenuti su droghe, armi, scommesse/gioco illegale o altri reati, o proporne l’acquisto o la vendita.",
      "Proporre compravendite o condividere contatti o dati di pagamento (telefono, IBAN, account social/messaggistica); portare i giocatori fuori dal gioco.",
      "Minacce, molestie, incitamento all’odio, contenuti sessuali; qualsiasi forma di abuso su minori.",
      "Frode, imbrogli, condivisione o vendita di account, furto d’identità.",
    ] },
    { h: "3. Moderazione e sanzioni", items: [
      "I messaggi passano un filtro automatico; i contenuti vietati non vengono inviati e sono registrati come violazione.",
      "Alla seconda violazione la chat viene disattivata per 24 ore, alla quarta per 30 giorni, e l’account viene esaminato.",
      "Violazioni gravi o ripetute possono comportare il blocco permanente senza preavviso; i gettoni non sono rimborsati.",
      "Puoi segnalare un giocatore dal suo profilo; le segnalazioni sono esaminate da un amministratore.",
    ] },
    { h: "4. Registri della chat e autorità", items: [
      `I messaggi della Sala VIP sono conservati ${CHAT_LOG_YEARS} anni con account, nome, tavolo, ora e indirizzo IP, poi cancellati automaticamente.`,
      "Solo l’amministratore vede questi registri, per esaminare segnalazioni e violazioni.",
      "Quando la legge lo richiede (inclusa la legge turca n. 5651), sono condivisi con tribunali, procure o autorità competenti su loro richiesta.",
    ] },
    { h: "5. Dati personali", items: ["Come vengono trattati e conservati i tuoi dati e quali sono i tuoi diritti è spiegato nell’Informativa sulla privacy."] },
    { h: "6. Età", items: ["La chat della Sala VIP è riservata ai maggiori di 18 anni. I minori usano l’app con il consenso dei genitori."] },
  ],
};

const PT: TermsDoc = {
  title: "Termos de utilização",
  updated: "Atualizado: 23/11/2026",
  sections: [
    { h: "1. O serviço", items: [
      "Word Okey é um jogo de palavras com peças de letras.",
      "As fichas são moeda virtual; não podem ser trocadas por dinheiro real, transferidas nem vendidas. O jogo não é jogo de azar.",
      "Ao usar a aplicação aceitas estes termos.",
    ] },
    { h: "2. Comportamentos proibidos", items: [
      "Partilhar conteúdo sobre drogas, armas, apostas/jogo ilegal ou outros crimes, ou oferecer a sua compra ou venda.",
      "Oferecer compra/venda ou partilhar contactos ou dados de pagamento (telefone, IBAN, contas de redes sociais/mensagens); tentar levar jogadores para fora do jogo.",
      "Ameaças, assédio, discurso de ódio, conteúdo sexual; qualquer forma de abuso de menores.",
      "Fraude, batota, partilha ou venda de contas, usurpação de identidade.",
    ] },
    { h: "3. Moderação e sanções", items: [
      "As mensagens passam por um filtro automático; o conteúdo proibido não é enviado e fica registado como infração.",
      "Na segunda infração o chat é desativado por 24 horas, na quarta por 30 dias, e a conta é analisada.",
      "Infrações graves ou repetidas podem levar ao bloqueio permanente sem aviso; as fichas não são reembolsadas.",
      "Podes denunciar um jogador a partir do perfil; as denúncias são analisadas por um administrador.",
    ] },
    { h: "4. Registos do chat e autoridades", items: [
      `As mensagens da Sala VIP são guardadas ${CHAT_LOG_YEARS} anos com a conta, o nome, a mesa, a hora e o IP, sendo depois apagadas automaticamente.`,
      "Só o administrador vê estes registos, para analisar denúncias e infrações.",
      "Quando a lei o exigir (incluindo a Lei turca n.º 5651), são partilhados com tribunais, Ministério Público ou autoridades competentes a pedido destes.",
    ] },
    { h: "5. Dados pessoais", items: ["A forma como os teus dados são tratados e guardados e os teus direitos estão descritos na Política de privacidade."] },
    { h: "6. Idade", items: ["O chat da Sala VIP é para maiores de 18 anos. Os menores devem usar a aplicação com autorização dos pais."] },
  ],
};

const DOCS: Record<string, TermsDoc> = { tr: TR, en: EN, de: DE, fr: FR, es: ES, it: IT, pt: PT };
export const termsFor = (lang: string): TermsDoc => DOCS[lang] ?? EN;

const VIP_KEY = "wordokey.vipTerms";
export function vipTermsAccepted(): boolean {
  try {
    return localStorage.getItem(VIP_KEY) === TERMS_VERSION;
  } catch {
    return false;
  }
}
export function acceptVipTerms() {
  try {
    localStorage.setItem(VIP_KEY, TERMS_VERSION);
  } catch {
    /* gizli sekme vb. */
  }
}


export interface PrivacyDoc extends TermsDoc {
  intro: string;
  /** Bu dilde çeviri yoksa İngilizce metnin üstünde gösterilen not. */
  note?: string;
}
const ONLY_EN: Record<string, string> = {
  de: "Die Datenschutzerklärung ist derzeit auf Englisch verfügbar.",
  fr: "La politique de confidentialité est actuellement disponible en anglais.",
  es: "La política de privacidad está disponible por ahora en inglés.",
  it: "L’informativa sulla privacy è al momento disponibile in inglese.",
  pt: "A política de privacidade está, por agora, disponível em inglês.",
};
/** Gizlilik Politikası (Türkçe ve İngilizce; diğer dillerde İngilizce metin + not). */
export function privacyFor(lang: string): PrivacyDoc {
  const docs = PRIVACY as Record<string, PrivacyDoc>;
  return fillDoc(docs[lang] ?? { ...docs.en, note: ONLY_EN[lang] }, lang);
}

const COMMUNITY_ONLY_EN: Record<string, string> = {
  de: "Die Community-Richtlinien sind derzeit auf Englisch verfügbar.",
  fr: "Les règles de la communauté sont actuellement disponibles en anglais.",
  es: "Las normas de la comunidad están disponibles por ahora en inglés.",
  it: "Le regole della community sono al momento disponibili in inglese.",
  pt: "As regras da comunidade estão, por agora, disponíveis em inglês.",
};
/** Topluluk Kuralları (Türkçe ve İngilizce; diğer dillerde İngilizce metin + not). */
export function communityFor(lang: string): PrivacyDoc {
  const docs = COMMUNITY as Record<string, PrivacyDoc>;
  return fillDoc(docs[lang] ?? { ...docs.en, note: COMMUNITY_ONLY_EN[lang] }, lang);
}

/** Lisanslar ve atıflar (Türkçe, diğer dillerde İngilizce). */
export function licensesFor(lang: string): PrivacyDoc {
  const docs = LICENSES as Record<string, PrivacyDoc>;
  return docs[lang] ?? docs.en;
}

/** Satıcı bilgileri (src/legal/seller.json): {{alan}} yer tutucularını doldurur; boşsa "[eklenecek]". */
export function fillSeller(text: string, lang: string): string {
  const seller = SELLER as Record<string, string>;
  const missing = lang === "tr" ? "[eklenecek]" : "[to be added]";
  return text.replace(/\{\{(\w+)\}\}/g, (_, k: string) => seller[k] || (k === "unvan" ? `${lang === "tr" ? "Word Okey uygulama sahibi" : "Owner of the Word Okey app"} ${missing}` : missing));
}
/** Şirket bilgileri (MERSİS, vergi, KEP) boşsa o satır hiç gösterilmez (şahıs satıcı). */
const OPTIONAL = ["mersis", "vergiDairesi", "vergiNo", "kep"];
const hiddenLine = (x: string) => OPTIONAL.some((k) => x.includes(`{{${k}}}`)) && OPTIONAL.every((k) => !(SELLER as Record<string, string>)[k]);
function fillDoc(d: PrivacyDoc, lang: string): PrivacyDoc {
  const f = (x: string) => fillSeller(x, lang);
  return { ...d, title: f(d.title), intro: f(d.intro), updated: f(d.updated), sections: d.sections.map((s) => ({ h: f(s.h), items: s.items.filter((x) => !hiddenLine(x)).map(f) })) };
}
/** Ön Bilgilendirme Formu ve Mesafeli Satış Sözleşmesi (Türkçe; diğer dillerde İngilizce özet). */
export function salesFor(lang: string): PrivacyDoc {
  const docs = SALES as Record<string, PrivacyDoc>;
  return fillDoc(docs[lang] ?? docs.en, lang === "tr" ? "tr" : "en");
}
const SALES_KEY = "wordokey.salesConsent";
/** Satın alma onayı: bu cihazda bu oturumda verildi mi. */
export function salesConsented(): boolean {
  try {
    return sessionStorage.getItem(SALES_KEY) === TERMS_VERSION;
  } catch {
    return false;
  }
}
export function setSalesConsent(on: boolean) {
  try {
    if (on) sessionStorage.setItem(SALES_KEY, TERMS_VERSION);
    else sessionStorage.removeItem(SALES_KEY);
  } catch {
    /* depolama kapalı */
  }
}
