// Emülatöre karşı: her masanın giriş ücreti sunucuda doğru düşer: node tests/emulator/entries.mjs
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInAnonymously } from "firebase/auth";
import { connectFirestoreEmulator, doc, getDoc, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
let ok = true;
const check = (l, c, x = "") => { console.log(`${c ? "✓" : "✗"} ${l}${x ? " — " + x : ""}`); if (!c) ok = false; };
const want = { caylak: [100, 4], usta: [100, 4], usta2: [1000, 4], usta5: [10000, 4], ozel2: [100, 2], ozel2u: [500, 2], ozel2b: [1000, 2], vip2: [100, 2] };
let k = 0;
for (const [type, [entry, n]] of Object.entries(want)) {
  const app = initializeApp({ projectId: "demo-cinali", apiKey: "demo-key" }, "c" + k++);
  const auth = getAuth(app); connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const db = getFirestore(app); connectFirestoreEmulator(db, "127.0.0.1", 8080);
  const fns = getFunctions(app, "europe-west3"); connectFunctionsEmulator(fns, "127.0.0.1", 5001);
  const { user } = await signInAnonymously(auth);
  const call = (nm, d) => httpsCallable(fns, nm)(d).then((r) => r.data);
  await call("bootstrap", { name: "T" });
  await call("testPurchase", { chips: 15000, productId: "wordokey_cip_15k" });
  if (type.startsWith("vip")) { await call("testSubscribeVip"); await call("heartbeat", { name: "T", adult: true }); }
  const bal = async () => (await getDoc(doc(db, "wallets", user.uid))).data().balance;
  const b0 = await bal();
  const j = await call("joinTable", { type, lang: "tr", name: "T" });
  await call("startTable", { tableId: j.tableId });
  const t = (await getDoc(doc(db, "tables", j.tableId))).data();
  check(`${type}: giriş ${entry}, ${n} kişilik`, b0 - (await bal()) === entry && t.seats.length === n, `düşen ${b0 - (await bal())}, koltuk ${t.seats.length}`);
}
console.log(ok ? "\nHEPSİ GEÇTİ" : "\nHATA VAR");
process.exit(ok ? 0 : 1);
