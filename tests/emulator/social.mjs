// Emülatöre karşı arkadaşlar testi (izleme özelliği kaldırıldı): node tests/emulator/social.mjs
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
check("istek gönderildi", (await C.call("sendFriendRequest", { targetUid: A.uid })).status === "sent");
const fa = await A.call("friendsStatus");
check("Ali'nin bekleyen isteği", fa.requests.length === 1 && fa.requests[0].name === "Can", JSON.stringify(fa.requests));
check("istekler okunabilir (kendi)", (await getDocs(collection(A.db, "users", A.uid, "requests"))).size === 1);
check("başkasının arkadaş listesi okunamaz", (await getDocs(collection(C.db, "users", A.uid, "friends")).then(() => "EVET", (e) => e.code)) === "permission-denied");
await A.call("respondFriendRequest", { fromUid: C.uid, accept: true });
const fc = await C.call("friendsStatus");
const ali = fc.friends.find((f) => f.uid === A.uid);
check("Can'ın listesinde Ali çevrimiçi ve masada", !!ali && ali.online && ali.tableStatus === "playing", JSON.stringify(ali));

// İzleme yok: masada oturmayan masayı okuyamaz, izleme çağrısı yoktur
check("arkadaş da masayı okuyamaz", (await getDoc(doc(C.db, "tables", id)).then(() => "EVET", (e) => e.code)) === "permission-denied");
check("izleme işlevi kaldırıldı", (await errCode(C.call("watchTable", { tableId: id }))) !== "BAŞARI");
check("listede izleyici bilgisi yok", (await C.call("friendsStatus")).friends.every((f) => !("watchers" in f) && !("tableId" in f)));

// Bea kalkar: koltuk beklemeden bilgisayara geçer
const beaSeat = (await readT(A)).seats.findIndex((s) => s.uid === B.uid);
await B.call("leaveTable", { tableId: id });
const tb = await readT(A);
check("kalkan oyuncunun yerine hemen bilgisayar", tb.seats[beaSeat].bot === true && !("vacant" in tb) , JSON.stringify(tb.seats[beaSeat]));

console.log(ok ? "\nHEPSİ GEÇTİ" : "\nHATA VAR");
process.exit(ok ? 0 : 1);
