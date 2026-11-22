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
const ja = await A.call("joinTable", { type, lang, name: "Ali" });
const jb = await B.call("joinTable", { type, lang, name: "Bea" });
const t1 = (await getDoc(doc(A.db, "tables", ja.tableId))).data();
check("iki VIP aynı masada, oyun hemen başladı", ja.tableId === jb.tableId && t1.status === "playing" && t1.seats.length === 2 && t1.seats.every((s) => !s.bot), t1.seats.map((s) => s.name).join(" vs "));
check("giriş 100 çip alındı", (await A.wallet()).balance === wa.balance - 100);
// Arkadaş olsalar bile VIP oda izlenemez
await C.call("sendFriendRequest", { targetUid: A.uid }); await A.call("sendFriendRequest", { targetUid: C.uid });
check("VIP oda izlenemez", (await errCode(C.call("watchTable", { tableId: ja.tableId }))) === "noWatchersVip");
const fs = (await C.call("friendsStatus")).friends.find((f) => f.uid === A.uid);
check("arkadaş listesinde İzle yok", fs && fs.tableStatus === "playing" && fs.tableId === null);
const txt = await A.call("sendText", { tableId: ja.tableId, text: "merhaba, iyi oyunlar", uiLang: "tr" });
check("VIP odada serbest yazışma", !!txt && txt.ok !== false, JSON.stringify(txt));
console.log(ok ? "\nHEPSİ GEÇTİ" : "\nHATA VAR");
process.exit(ok ? 0 : 1);
