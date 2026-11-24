// Emülatöre karşı VIP oda testi: node tests/emulator/vip.mjs
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInAnonymously } from "firebase/auth";
import { collection, connectFirestoreEmulator, doc, getDoc, getDocs, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
async function client(name) {
  const app = initializeApp({ projectId: "demo-cinali", apiKey: "demo-key" }, name);
  const auth = getAuth(app); connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const db = getFirestore(app); connectFirestoreEmulator(db, "127.0.0.1", 8080);
  const fns = getFunctions(app, "europe-west3"); connectFunctionsEmulator(fns, "127.0.0.1", 5001);
  const { user } = await signInAnonymously(auth);
  const call = (n, d) => httpsCallable(fns, n)(d).then((r) => r.data);
  await call("bootstrap", { name }); await call("heartbeat", { name });
  const wallet = async () => (await getDoc(doc(db, "wallets", user.uid))).data();
  return { uid: user.uid, db, call, wallet };
}
const errCode = (p) => p.then(() => "BAŞARI", (e) => e.details?.code ?? e.code);
let ok = true;
const check = (l, c, x = "") => { console.log(`${c ? "✓" : "✗"} ${l}${x ? " — " + x : ""}`); if (!c) ok = false; };
const A = await client("Ali"), B = await client("Bea"), C = await client("Can");
const lang = "tr", type = "vip2";
check("abone olmayan VIP masaya oturamaz", (await errCode(A.call("joinTable", { type, lang, name: "Ali" }))) === "vipOnly");
const before = (await A.wallet()).balance;
await A.call("testSubscribeVip"); await B.call("testSubscribeVip");
const wa = await A.wallet();
check("abonelik: +1000 çip ve 7 gün", wa.balance === before + 1000 && Math.round((wa.vipUntil - Date.now()) / 864e5) === 7, `${before} → ${wa.balance}`);
// Ali (erkek) bayan arıyor, Bea (kadın) erkek arıyor: karşılıklı uyar
const ja = await A.call("joinTable", { type, lang, name: "Ali", gender: "erkek", want: "kadin" });
const jb = await B.call("joinTable", { type, lang, name: "Bea", gender: "kadin", want: "erkek" });
const t1 = (await getDoc(doc(A.db, "tables", ja.tableId))).data();
check("iki VIP aynı masada, oyun hemen başladı", ja.tableId === jb.tableId && t1.status === "playing" && t1.seats.length === 2 && t1.seats.every((s) => !s.bot), t1.seats.map((s) => s.name).join(" vs "));
check("VIP odada hamle süresi yok", t1.deadline === null, String(t1.deadline));
check("VIP üyelerin koltuğunda rozet (bitiş anı)", t1.seats.every((x) => x.vipUntil > Date.now()), JSON.stringify(t1.seats.map((x) => x.vipUntil)));
check("giriş 100 çip alındı", (await A.wallet()).balance === wa.balance - 100);
await C.call("sendFriendRequest", { targetUid: A.uid }); await A.call("sendFriendRequest", { targetUid: C.uid });
const fs = (await C.call("friendsStatus")).friends.find((f) => f.uid === A.uid);
check("arkadaş listesinde masada görünür", fs && fs.tableStatus === "playing");
const txt = await A.call("sendText", { tableId: ja.tableId, text: "merhaba, iyi oyunlar", uiLang: "tr" });
check("VIP odada serbest yazışma", !!txt && txt.ok !== false, JSON.stringify(txt));
// Yasa dışı içerik: gönderilmez; 2. ihlalde 24 saat sohbet yasağı
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));
// Küfür filtresi (hakaret serbest): B kullanır, A'nın yasa dışı testini etkilemesin
await sleepMs(1600);
const kf = await B.call("sendText", { tableId: ja.tableId, text: "s1kt1r git", uiLang: "tr" });
check("VIP odada küfür gönderilmez", kf.ok === false && kf.blocked === true && kf.strikesLeft === 2, JSON.stringify(kf));
await sleepMs(1600);
check("VIP odada hakaret serbest", (await B.call("sendText", { tableId: ja.tableId, text: "şerefsiz hamle yaptın", uiLang: "tr" })).ok === true);
await sleepMs(1600);
await B.call("sendText", { tableId: ja.tableId, text: "amk", uiLang: "tr" });
await sleepMs(1600);
const km = await B.call("sendText", { tableId: ja.tableId, text: "orospu", uiLang: "tr" });
check("3. küfürde 10 dk susturma", km.ok === false && km.muted === true, JSON.stringify(km));
check("susturulmuşken yazamaz", (await errCode(B.call("sendText", { tableId: ja.tableId, text: "merhaba", uiLang: "tr" }))) === "chatMuted");
await sleepMs(1600);
check("uyuşturucu mesajı engellenir", (await errCode(A.call("sendText", { tableId: ja.tableId, text: "k0kain var mı", uiLang: "tr" }))) === "illegalContent");
check("iletişim bilgisi engellenir (2. ihlal: yasak)", (await errCode(A.call("sendText", { tableId: ja.tableId, text: "telegramdan yaz 0532 123 45 67", uiLang: "tr" }))) === "illegalBanned");
check("yasaklıyken normal mesaj da gitmez", (await errCode(A.call("sendText", { tableId: ja.tableId, text: "merhaba", uiLang: "tr" }))) === "chatBanned");
// Sohbet kaydı: sunucuda saklanır (2 yıl), istemciler okuyamaz
const logs = await fetch("http://127.0.0.1:8080/v1/projects/demo-cinali/databases/(default)/documents/chatLogs?pageSize=50", { headers: { Authorization: "Bearer owner" } }).then((r) => r.json());
const logTexts = (logs.documents ?? []).map((d) => d.fields.text.stringValue);
check("gönderilen mesajlar kayıtta", logTexts.includes("merhaba, iyi oyunlar") && logTexts.includes("şerefsiz hamle yaptın") && !logTexts.includes("amk"), JSON.stringify(logTexts));
check("engellenen mesaj sohbet kaydına girmez", !logTexts.includes("k0kain var mı"));
const one = (logs.documents ?? [])[0]?.fields ?? {};
const days = (Date.parse(one.expireAt?.timestampValue) - Date.now()) / 864e5;
check("kayıt 2 yıl saklanır (TTL)", days > 728 && days < 731, String(days));
check("kayıtta gönderen, masa ve IP alanı", !!one.uid && !!one.tableId && "ip" in one);
const mods = await fetch("http://127.0.0.1:8080/v1/projects/demo-cinali/databases/(default)/documents/moderation", { headers: { Authorization: "Bearer owner" } }).then((r) => r.json());
check("ihlaller denetim kaydında", (mods.documents ?? []).length === 2, String((mods.documents ?? []).length));
check("istemci sohbet kaydını okuyamaz", (await getDocs(collection(B.db, "chatLogs")).then(() => "EVET", (e) => e.code)) === "permission-denied");
// Misafir: VIP abone arkadaşını davet eder; misafirden abonelik ve ücret istenmez
const G = await client("Gül");
await A.call("leaveTable", { tableId: ja.tableId });
await G.call("sendFriendRequest", { targetUid: A.uid }); await A.call("sendFriendRequest", { targetUid: G.uid });
const room = await A.call("createPrivateTable", { type, lang, name: "Ali" });
check("VIP abone özel oda açtı", !!room.code);
check("davet gönderildi", (await A.call("inviteFriend", { tableId: room.tableId, friendUid: G.uid })).ok === true);
const inv = (await G.call("friendsStatus")).invites;
check("misafir daveti görüyor", inv.length === 1 && inv[0].name === "Ali" && inv[0].code === room.code, JSON.stringify(inv));
const gBefore = (await G.wallet()).balance;
check("misafir abone değil", !(await G.wallet()).vipUntil);
await G.call("joinPrivateTable", { code: room.code, name: "Gül" });
const tr = (await getDoc(doc(A.db, "tables", room.tableId))).data();
check("misafir ücretsiz oturdu", (await G.wallet()).balance === gBefore && tr.seats[1].uid === G.uid && tr.seats[1].guest === true);
check("davet katılınca silindi", (await G.call("friendsStatus")).invites.length === 0);
await G.call("leaveTable", { tableId: room.tableId });
check("misafir kalkınca iade almaz (bedava çip yok)", (await G.wallet()).balance === gBefore);
await G.call("joinPrivateTable", { code: room.code, name: "Gül" });
await A.call("startTable", { tableId: room.tableId });
const ts = (await getDoc(doc(A.db, "tables", room.tableId))).data();
check("VIP oda abone + misafir ile başladı", ts.status === "playing" && ts.seats.length === 2 && ts.seats.every((s) => !s.bot));
check("misafir sohbet edebilir", (await G.call("sendText", { tableId: room.tableId, text: "davetin için sağ ol", uiLang: "tr" })).ok === true);
const H = await client("Hale");
check("davetsiz ve abonesiz kişi VIP masaya oturamaz", (await errCode(H.call("joinTable", { type, lang, name: "Hale" }))) === "vipOnly");
check("arkadaş olmayana davet gönderilemez", (await errCode(A.call("inviteFriend", { tableId: room.tableId, friendUid: B.uid }))) !== "BAŞARI");
// VIP oyuncu ara: tek başına oturan 60 sn rakip bekler, isterse bilgisayarla hemen başlar
const V = await client("Vural");
await V.call("testSubscribeVip");
const vs = await V.call("joinTable", { type, lang, name: "Vural", gender: "erkek", want: "kadin" });
const vt = (await getDoc(doc(V.db, "tables", vs.tableId))).data();
const waitSec = Math.round((vt.startAt - Date.now()) / 1000);
check("VIP aramada ~60 sn rakip beklenir", vt.status === "waiting" && waitSec >= 55 && waitSec <= 61, `${waitSec} sn`);
await V.call("startTable", { tableId: vs.tableId });
const vt2 = (await getDoc(doc(V.db, "tables", vs.tableId))).data();
check("VIP oyuncu beklemeden bilgisayarla başlatabilir", vt2.status === "playing" && vt2.seats.length === 2 && vt2.seats[1].bot === true);
// Yedek eşleşme: bayan bulunamazsa erkek oyuncuyla eşleşir
const M1 = await client("Murat"), M2 = await client("Mert");
await M1.call("testSubscribeVip"); await M2.call("testSubscribeVip");
const m1 = await M1.call("joinTable", { type, lang, name: "Murat", gender: "erkek", want: "kadin" });
const m2 = await M2.call("joinTable", { type, lang, name: "Mert", gender: "erkek", want: "kadin" });
const mt = (await getDoc(doc(M1.db, "tables", m1.tableId))).data();
check("bayan yoksa erkek oyuncuyla eşleşir", m1.tableId === m2.tableId && mt.status === "playing" && mt.seats.every((s) => !s.bot), mt.seats.map((s) => s.name).join(" vs "));
// Uyan masa varken yedeğe düşülmez: bayan arayan erkek, erkek arayan bayan masasına oturur
const K1 = await client("Kerem"), K2 = await client("Selin"), K3 = await client("Emre");
for (const c of [K1, K2, K3]) await c.call("testSubscribeVip");
const kOther = await K3.call("joinTable", { type, lang, name: "Emre", gender: "erkek", want: "erkek" });
const kSelin = await K2.call("joinTable", { type, lang, name: "Selin", gender: "kadin", want: "erkek" });
const kKerem = await K1.call("joinTable", { type, lang, name: "Kerem", gender: "erkek", want: "kadin" });
check("uyan masa yoksa bekleyen başka bir VIP masaya katılır", kSelin.tableId === kOther.tableId);
// Rastgele VIP oyuncu (cinsiyet seçmeden) ve herkese açık Özel Oda
const R1 = await client("Rıza"), R2 = await client("Rana");
await R1.call("testSubscribeVip"); await R2.call("testSubscribeVip");
const r1 = await R1.call("joinTable", { type, lang, name: "Rıza" });
const rt = (await getDoc(doc(R1.db, "tables", r1.tableId))).data();
// Bekleyen bir VIP masası (Kerem) varken cinsiyetsiz arayan ona katılır
check("rastgele VIP oyuncu bekleyen VIP oyuncuyla eşleşir (cinsiyetsiz)", rt.status === "playing" && rt.seats.length === 2 && rt.seats.every((x) => !x.bot), rt.seats.map((x) => x.name).join(" vs "));
await R2.call("joinTable", { type, lang, name: "Rana" });
const O1 = await client("Oya"), O2 = await client("Onur");
const o1 = await O1.call("joinTable", { type: "ozel2", lang, name: "Oya" });
const o2 = await O2.call("joinTable", { type: "ozel2", lang, name: "Onur" });
const ot = (await getDoc(doc(O1.db, "tables", o1.tableId))).data();
check("Özel Oda: abonesiz iki oyuncu rastgele eşleşir", o1.tableId === o2.tableId && ot.status === "playing" && ot.seats.length === 2 && ot.deadline !== null);
const O3 = await client("Ozan");
const o3 = await O3.call("joinTable", { type: "ozel2", lang, name: "Ozan" });
await O3.call("startTable", { tableId: o3.tableId });
const ob = (await getDoc(doc(O3.db, "tables", o3.tableId))).data();
check("Özel Oda: bilgisayara karşı hemen başlar", ob.status === "playing" && ob.seats[1].bot === true);
// VIP oyuncu yoksa: Özel Odada bekleyen (abonesiz) oyuncuyla eşleşir, masa VIP olur, sohbet açık
const Z1 = await client("Zeki"), Z2 = await client("Zara");
// (başka dilde: bekleyen VIP masası yokken)
const zo = await Z1.call("joinTable", { type: "ozel2", lang: "en", name: "Zeki" });
await Z2.call("testSubscribeVip");
const zv = await Z2.call("joinTable", { type, lang: "en", name: "Zara", gender: "kadin", want: "erkek" });
const zt = (await getDoc(doc(Z1.db, "tables", zo.tableId))).data();
check("VIP yoksa Özel Oda oyuncusuyla eşleşir", zv.tableId === zo.tableId && zt.status === "playing" && zt.type === "vip2" && zt.deadline === null, zt.seats.map((x) => x.name).join(" vs ") + " · " + zt.type);
check("Özel Oda oyuncusu (abonesiz) sohbet edebilir", (await Z1.call("sendText", { tableId: zo.tableId, text: "merhaba", uiLang: "tr" })).ok === true);
// VIP ve Teke Tek boşsa: Sosyete'de, o da yoksa Çayhane'de tek başına bekleyen oyuncuyla eşleşir
const tbl = async (c, id) => (await getDoc(doc(c.db, "tables", id))).data();
{
  const S1 = await client("Sefa"), V1 = await client("Vedat"), H1 = await client("Hakan");
  await V1.call("testSubscribeVip");
  // Yüksek girişli masada (Sosyete 1.000) bekleyen oyuncu VIP (100) ile eşleşmez
  await H1.call("testPurchase", { chips: 5000, productId: "wordokey_cip_5k" });
  const h0 = (await H1.wallet()).balance;
  const hj = await H1.call("joinTable", { type: "usta2", lang: "de", name: "Hakan" });
  const T1 = await client("Tamer");
  const tj = await T1.call("joinTable", { type: "ozel2u", lang: "de", name: "Tamer" });
  const s0 = (await S1.wallet()).balance;
  const sj = await S1.call("joinTable", { type: "usta", lang: "de", name: "Sefa" });
  const vj = await V1.call("joinTable", { type, lang: "de", name: "Vedat" });
  const st = await tbl(S1, sj.tableId), ht = await tbl(H1, hj.tableId);
  check("Teke Tek boşsa Sosyete'de (giriş 100) bekleyen oyuncuyla eşleşir", vj.tableId === sj.tableId && st.type === "vip2" && st.status === "playing" && st.seats.length === 2 && st.seats.every((x) => !x.bot) && st.deadline === null, `${st.type} · ${st.seats.map((x) => x.name).join(" vs ")}`);
  check("yüksek girişli Sosyete (1.000) oyuncusu VIP ile eşleşmez, masası bozulmaz", vj.tableId !== hj.tableId && ht.type === "usta2" && ht.seats.length === 1);
  const tt = await tbl(T1, tj.tableId);
  check("Teke Tek 500 oyuncusu VIP ile eşleşmez (yalnızca giriş 100 olan masalar)", vj.tableId !== tj.tableId && tt.type === "ozel2u" && tt.seats.length === 1);
  check("çip iadesi yok: Sosyete 100 oyuncusu yalnızca 100 öder, 1.000'lik oyuncunun çipi değişmez", (await S1.wallet()).balance === s0 - 100 && (await H1.wallet()).balance === h0 - 1000);
  check("Sosyete'den gelen oyuncu (abonesiz) sohbet edebilir", (await S1.call("sendText", { tableId: sj.tableId, text: "merhaba", uiLang: "tr" })).ok === true);
}
{
  const C1 = await client("Cemre"), V2 = await client("Veli");
  await V2.call("testSubscribeVip");
  const c0 = (await C1.wallet()).balance;
  const cj = await C1.call("joinTable", { type: "caylak", lang: "fr", name: "Cemre" });
  const vj = await V2.call("joinTable", { type, lang: "fr", name: "Veli", gender: "erkek", want: "kadin" });
  const ct = await tbl(C1, cj.tableId);
  check("Sosyete de boşsa en son Çayhane'de bekleyen oyuncuyla eşleşir", vj.tableId === cj.tableId && ct.type === "vip2" && ct.status === "playing" && ct.seats.length === 2, `${ct.type} · ${ct.seats.map((x) => x.name).join(" vs ")}`);
  check("Çayhane oyuncusundan fazladan çip alınmaz (giriş 100 = VIP 100)", (await C1.wallet()).balance === c0 - 100);
}
{
  // Sıra: Teke Tek → Sosyete → Çayhane
  const P1 = await client("Pelin"), P2 = await client("Polat"), P3 = await client("Peri");
  const VA = await client("Vusat"), VB = await client("Vildan"), VC = await client("Vecdi");
  for (const v of [VA, VB, VC]) await v.call("testSubscribeVip");
  const cj = await P3.call("joinTable", { type: "caylak", lang: "es", name: "Peri" });
  const sj = await P2.call("joinTable", { type: "usta", lang: "es", name: "Polat" });
  const oj = await P1.call("joinTable", { type: "ozel2", lang: "es", name: "Pelin" });
  const a = await VA.call("joinTable", { type, lang: "es", name: "Vusat" });
  const b = await VB.call("joinTable", { type, lang: "es", name: "Vildan" });
  const c = await VC.call("joinTable", { type, lang: "es", name: "Vecdi" });
  check("öncelik sırası: önce Teke Tek, sonra Sosyete, en son Çayhane", a.tableId === oj.tableId && b.tableId === sj.tableId && c.tableId === cj.tableId, JSON.stringify({ a: a.tableId === oj.tableId, b: b.tableId === sj.tableId, c: c.tableId === cj.tableId, ta: (await tbl(VA, a.tableId)).seats.map((x) => x.name), tb: (await tbl(VB, b.tableId)).seats.map((x) => x.name), tc: (await tbl(VC, c.tableId)).seats.map((x) => x.name) }));
}
{
  // 18 yaş altı Çayhane oyuncusu VIP odaya alınmaz; iki kişinin beklediği Çayhane masası bozulmaz
  const M1 = await client("Melih"), VM = await client("Vasfi");
  await M1.call("heartbeat", { name: "Melih", adult: false });
  await VM.call("testSubscribeVip");
  const mj = await M1.call("joinTable", { type: "caylak", lang: "it", name: "Melih" });
  const vj = await VM.call("joinTable", { type, lang: "it", name: "Vasfi" });
  check("18 yaş altı oyuncu VIP odaya eşlenmez", vj.tableId !== mj.tableId && (await tbl(M1, mj.tableId)).type === "caylak", JSON.stringify({ same: vj.tableId === mj.tableId, m: await tbl(M1, mj.tableId).then((x) => [x.type, x.seats.map((y) => y.name)]), v: await tbl(VM, vj.tableId).then((x) => [x.type, x.seats.map((y) => y.name)]) }));
  const D1 = await client("Duru"), D2 = await client("Doruk"), VD = await client("Vahit");
  await VD.call("testSubscribeVip");
  const d1 = await D1.call("joinTable", { type: "caylak", lang: "pt", name: "Duru" });
  await D2.call("joinTable", { type: "caylak", lang: "pt", name: "Doruk" });
  const vd = await VD.call("joinTable", { type, lang: "pt", name: "Vahit" });
  const dt = await tbl(D1, d1.tableId);
  check("iki kişinin beklediği Çayhane masası bozulmaz", vd.tableId !== d1.tableId && dt.type === "caylak" && dt.seats.length === 2);
}
const N = await client("Nur");
const cj = await N.call("joinTable", { type: "caylak", lang, name: "Nur" });
await N.call("startTable", { tableId: cj.tableId });
const ct = (await getDoc(doc(N.db, "tables", cj.tableId))).data();
check("Çaylak masada beklemeden başlatılabilir", ct.status === "playing" && ct.seats.length === 4 && ct.seats.slice(1).every((s) => s.bot));
// İki harfli kelime yalnızca Çayhane (ve Pratik) oyununda geçerli: VIP ve Teke Tek en az 3 harf
{
  const mw = (tb) => JSON.parse(tb.view ?? "{}").minWord ?? 2;
  check("VIP oyununda en az 3 harf (iki harfli kelime yok)", mw(t1) === 3, String(mw(t1)));
  check("Teke Tek oyununda en az 3 harf", mw(ot) === 3 && mw(ob) === 3, `${mw(ot)} / ${mw(ob)}`);
  check("Sosyete/Çayhane'den VIP'e dönen oyunda da en az 3 harf", mw(zt) === 3);
  check("Çayhane oyununda iki harfli kelime geçerli", mw(ct) === 2, String(mw(ct)));
}
console.log(ok ? "\nHEPSİ GEÇTİ" : "\nHATA VAR");
process.exit(ok ? 0 : 1);
