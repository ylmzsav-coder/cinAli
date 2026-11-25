// Emülatöre karşı ücretsiz destek: çipi biten (kumbarası 25'in altına düşen) oyuncuya 12 saat sonra 99 çip.
// node tests/emulator/refill.mjs
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInAnonymously } from "firebase/auth";
import { connectFirestoreEmulator, doc, getDoc, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
let ok = true;
const check = (l, c, x = "") => { console.log(`${c ? "✓" : "✗"} ${l}${x ? " — " + x : ""}`); if (!c) ok = false; };
const errCode = (p) => p.then(() => "BAŞARI", (e) => e.details?.code ?? e.code);
let n = 0;
async function client(name) {
  const app = initializeApp({ projectId: "demo-cinali", apiKey: "demo-key" }, `${name}-${n++}`);
  const auth = getAuth(app); connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const db = getFirestore(app); connectFirestoreEmulator(db, "127.0.0.1", 8080);
  const fns = getFunctions(app, "europe-west3"); connectFunctionsEmulator(fns, "127.0.0.1", 5001);
  const { user } = await signInAnonymously(auth);
  const call = (n, d) => httpsCallable(fns, n)(d).then((r) => r.data);
  await call("bootstrap", { name });
  const w = async () => (await getDoc(doc(db, "wallets", user.uid))).data();
  return { uid: user.uid, call, w };
}
const lang = "tr";

// Kumbarası 49: Çayhane 25'e oturunca 24 kalır → çipi bitti sayılır, 12 saat sayacı başlar
let w;
const B = await client("Berk");
await B.call("testSetWallet", { balance: 49 });
await B.call("joinTable", { type: "caylak25", lang, name: "Berk" });
w = await B.w();
check("kumbara 25'in altına düşünce (24) çipi bitti sayılır, 12 saat sayacı başlar", w.balance === 24 && typeof w.brokeSince === "number" && Date.now() - w.brokeSince < 60_000, JSON.stringify({ balance: w.balance, brokeSince: w.brokeSince }));
check("12 saat dolmadan yükleme yapılmaz", (await errCode(B.call("claimRefill"))) === "refillNotReady");
await B.call("testSetWallet", { brokeHoursAgo: 11.9 });
check("11 sa 54 dk'da da yapılmaz", (await errCode(B.call("claimRefill"))) === "refillNotReady");
await B.call("testSetWallet", { brokeHoursAgo: 12.01 });
await B.call("claimRefill");
w = await B.w();
check("12 saat dolunca kumbaraya 99 çip yüklenir (24 → 123)", w.balance === 123 && !w.brokeSince, JSON.stringify({ balance: w.balance }));
check("ikinci kez alınamaz", (await errCode(B.call("claimRefill"))) === "refillNotReady");
// Kumbarası 25 ve üstünde kalan oyuncu "çipi bitti" sayılmaz
const C = await client("Cihan");
await C.call("testSetWallet", { balance: 50 });
await C.call("joinTable", { type: "caylak25", lang, name: "Cihan" });
w = await C.w();
check("kumbarası 25 kalan oyuncu çipi bitmiş sayılmaz (Çayhane 25'te oynayabilir)", w.balance === 25 && !w.brokeSince, JSON.stringify({ balance: w.balance, brokeSince: w.brokeSince ?? null }));

console.log(ok ? "\nHEPSİ GEÇTİ" : "\nHATA VAR");
process.exit(ok ? 0 : 1);
