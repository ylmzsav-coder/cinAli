// Emülatöre karşı VIP oda testi: node tests/emulator/vip.mjs
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInAnonymously } from "firebase/auth";
import { connectFirestoreEmulator, doc, getDoc, getFirestore } from "firebase/firestore";
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
check("abonelik: +1000 çip ve 30 gün", wa.balance === before + 1000 && Math.round((wa.vipUntil - Date.now()) / 864e5) === 30, `${before} → ${wa.balance}`);
// Ali (erkek) bayan arıyor, Bea (kadın) erkek arıyor: karşılıklı uyar
const ja = await A.call("joinTable", { type, lang, name: "Ali", gender: "erkek", want: "kadin" });
const jb = await B.call("joinTable", { type, lang, name: "Bea", gender: "kadin", want: "erkek" });
const t1 = (await getDoc(doc(A.db, "tables", ja.tableId))).data();
check("iki VIP aynı masada, oyun hemen başladı", ja.tableId === jb.tableId && t1.status === "playing" && t1.seats.length === 2 && t1.seats.every((s) => !s.bot), t1.seats.map((s) => s.name).join(" vs "));
check("VIP odada hamle süresi yok", t1.deadline === null, String(t1.deadline));
check("giriş 100 çip alındı", (await A.wallet()).balance === wa.balance - 100);
// Arkadaş olsalar bile VIP oda izlenemez
await C.call("sendFriendRequest", { targetUid: A.uid }); await A.call("sendFriendRequest", { targetUid: C.uid });
check("VIP oda izlenemez", (await errCode(C.call("watchTable", { tableId: ja.tableId }))) === "noWatchersVip");
const fs = (await C.call("friendsStatus")).friends.find((f) => f.uid === A.uid);
check("arkadaş listesinde İzle yok", fs && fs.tableStatus === "playing" && fs.tableId === null);
const txt = await A.call("sendText", { tableId: ja.tableId, text: "merhaba, iyi oyunlar", uiLang: "tr" });
check("VIP odada serbest yazışma", !!txt && txt.ok !== false, JSON.stringify(txt));
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
const N = await client("Nur");
const cj = await N.call("joinTable", { type: "caylak", lang, name: "Nur" });
await N.call("startTable", { tableId: cj.tableId });
const ct = (await getDoc(doc(N.db, "tables", cj.tableId))).data();
check("Çaylak masada beklemeden başlatılabilir", ct.status === "playing" && ct.seats.length === 4 && ct.seats.slice(1).every((s) => s.bot));
console.log(ok ? "\nHEPSİ GEÇTİ" : "\nHATA VAR");
process.exit(ok ? 0 : 1);
