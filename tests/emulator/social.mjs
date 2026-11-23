// Emülatöre karşı arkadaşlar / izleme / boşalan koltuk testi: node tests/emulator/social.mjs
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInAnonymously } from "firebase/auth";
import { connectFirestoreEmulator, doc, getDoc, getDocs, collection, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";

async function client(name) {
  const app = initializeApp({ projectId: "demo-cinali", apiKey: "demo-key" }, name);
  const auth = getAuth(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  const fns = getFunctions(app, "europe-west3");
  connectFunctionsEmulator(fns, "127.0.0.1", 5001);
  const { user } = await signInAnonymously(auth);
  const call = (n, d) => httpsCallable(fns, n)(d).then((r) => r.data);
  await call("bootstrap", { name });
  await call("heartbeat", { name });
  const balance = async () => (await getDoc(doc(db, "wallets", user.uid))).data().balance;
  return { uid: user.uid, db, call, name, balance };
}
const errCode = (p) => p.then(() => "BAŞARI", (e) => e.details?.code ?? e.code);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = true;
const check = (label, cond, extra = "") => { console.log(`${cond ? "✓" : "✗"} ${label}${extra ? " — " + extra : ""}`); if (!cond) ok = false; };

const A = await client("Ali"), B = await client("Bea"), C = await client("Can"), D = await client("Dio");
const lang = "tr", type = "caylak";

// Ali özel masa kurar, Bea katılır, Ali başlatır
const created = await A.call("createPrivateTable", { type, lang, name: "Ali" });
await B.call("joinPrivateTable", { code: created.code, name: "Bea" });
await A.call("startTable", { tableId: created.tableId });
const id = created.tableId;
const readT = async (c) => (await getDoc(doc(c.db, "tables", id))).data();
check("masa oynanıyor", (await readT(A)).status === "playing");

// Arkadaşlık: Can masadaki Ali'ye istek gönderir, Ali kabul eder
check("arkadaş olmadan izlenemez", (await errCode(C.call("watchTable", { tableId: id }))) === "notFriendTable");
check("istek gönderildi", (await C.call("sendFriendRequest", { targetUid: A.uid })).status === "sent");
const fa = await A.call("friendsStatus");
check("Ali'nin bekleyen isteği", fa.requests.length === 1 && fa.requests[0].name === "Can", JSON.stringify(fa.requests));
check("istekler okunabilir (kendi)", (await getDocs(collection(A.db, "users", A.uid, "requests"))).size === 1);
check("başkasının arkadaş listesi okunamaz", (await getDocs(collection(C.db, "users", A.uid, "friends")).then(() => "EVET", (e) => e.code)) === "permission-denied");
await A.call("respondFriendRequest", { fromUid: C.uid, accept: true });
const fc = await C.call("friendsStatus");
const ali = fc.friends.find((f) => f.uid === A.uid);
check("Can'ın listesinde Ali çevrimiçi ve masada", !!ali && ali.online && ali.tableId === id && ali.tableStatus === "playing", JSON.stringify(ali));

// Can izlemeye başlar; izleyici sayısı herkes tarafından görülür
check("Can masayı izleyebilir", (await C.call("watchTable", { tableId: id })).ok === true);
check("izleyici masayı okuyabilir", !!(await readT(C)).view);
check("izleyici ıstaka okuyamaz", (await getDoc(doc(C.db, "tables", id, "hands", A.uid)).then(() => "EVET", (e) => e.code)) === "permission-denied");
check("oyuncular izleyici sayısını görür", ((await readT(B)).watchers ?? []).length === 1);
check("oyuncular izleyicinin adını görür", Object.values((await readT(B)).watcherNames ?? {}).includes("Can"), JSON.stringify((await readT(B)).watcherNames));
check("arkadaşın listesinde izleyici sayısı", (await C.call("friendsStatus")).friends[0].watchers === 1);

// Bea kalkar: koltuk 10 sn boş kalır
const beaSeat = (await readT(A)).seats.findIndex((s) => s.uid === B.uid);
await B.call("leaveTable", { tableId: id });
let tb = await readT(A);
check("boşalan koltuk açık", (tb.vacant ?? []).some((v) => v.seat === beaSeat) && !tb.seats[beaSeat].bot && !tb.seats[beaSeat].uid);
const before = await C.balance();
check("izleyici olmayan oturamaz", (await errCode(D.call("takeSeat", { tableId: id, seat: beaSeat, name: "Dio" }))) === "notWatching");
check("Can boşalan koltuğa oturur", (await C.call("takeSeat", { tableId: id, seat: beaSeat, name: "Can" })).ok === true);
tb = await readT(A);
check("koltuk Can'ın, izleyici listesinden çıktı", tb.seats[beaSeat].uid === C.uid && !(tb.watchers ?? []).includes(C.uid) && !(tb.vacant ?? []).length);
check("giriş ücreti alındı", (await C.balance()) === before - 100, `${before} → ${await C.balance()}`);
const hand = (await getDoc(doc(C.db, "tables", id, "hands", C.uid))).data();
check("Can koltuğun taşlarını devraldı", hand && hand.seat === beaSeat && hand.rack.length > 0, `taş: ${hand?.rack.length}`);

// Süre dolarsa bota geçer: Dio Ali'nin arkadaşı olup izler, Can kalkar, kimse oturmaz
await D.call("sendFriendRequest", { targetUid: A.uid });
await A.call("sendFriendRequest", { targetUid: D.uid }); // karşılıklı istek: hemen arkadaş
await D.call("watchTable", { tableId: id });
await C.call("leaveTable", { tableId: id });
tb = await readT(A);
check("ikinci boşalma açık", (tb.vacant ?? []).some((v) => v.seat === beaSeat));
await sleep(10_800);
await A.call("claimTimeout", { tableId: id });
tb = await readT(A);
check("10 sn sonra bilgisayara geçti", tb.seats[beaSeat].bot === true && !(tb.vacant ?? []).length);
check("süre dolunca oturulamaz", (await errCode(D.call("takeSeat", { tableId: id, seat: beaSeat, name: "Dio" }))) === "seatGone");
await D.call("stopWatching", { tableId: id });
check("izlemeyi bırakınca sayı düşer", ((await readT(A)).watchers ?? []).length === 0);
check("izleyici çıkınca adı listeden silinir", !Object.keys((await readT(A)).watcherNames ?? {}).includes(D.uid));

console.log(ok ? "\nHEPSİ GEÇTİ" : "\nHATA VAR");
process.exit(ok ? 0 : 1);
