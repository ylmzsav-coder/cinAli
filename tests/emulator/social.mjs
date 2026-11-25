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
// Arkadaşla oyun yalnızca VIP Oda, Fifty Cent ve Sosyete Özel'de (Fifty Cent: başarı oranı %50+)
const lang = "tr", type = "ozel2";
for (const c of [A, B]) await c.call("testSetStats", { played: 10, won: 9 });

// Ali özel masa kurar, Bea katılır, Ali başlatır
const created = await A.call("createPrivateTable", { type, lang, name: "Ali" });
await B.call("joinPrivateTable", { code: created.code, name: "Bea" });
await A.call("startTable", { tableId: created.tableId });
const id = created.tableId;
const readT = async (c) => (await getDoc(doc(c.db, "tables", id))).data();
check("masa oynanıyor", (await readT(A)).status === "playing");

// Arkadaş ekle (tek taraflı): Can, Ali'yi listesine ekler; Ali'ye istek/bildirim gitmez
check("Can, Ali'yi ekler", (await C.call("sendFriendRequest", { targetUid: A.uid })).status === "friends");
const fa = await A.call("friendsStatus");
check("Ali'ye istek ya da bildirim yok", fa.requests.length === 0 && fa.friends.length === 0, JSON.stringify(fa));
check("Ali'nin istek kutusu boş", (await getDocs(collection(A.db, "users", A.uid, "requests"))).size === 0);
check("başkasının arkadaş listesi okunamaz", (await getDocs(collection(C.db, "users", A.uid, "friends")).then(() => "EVET", (e) => e.code)) === "permission-denied");
const fc = await C.call("friendsStatus");
const ali = fc.friends.find((f) => f.uid === A.uid);
check("Can'ın listesinde Ali çevrimiçi ve masada", !!ali && ali.online && ali.tableStatus === "playing", JSON.stringify(ali));
check("tekrar eklemek sorun değil", (await C.call("sendFriendRequest", { targetUid: A.uid })).status === "friends");

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
