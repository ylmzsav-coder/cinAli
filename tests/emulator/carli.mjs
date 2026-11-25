// Emülatöre karşı Çarli'nin üç masası: 100 → 400, 200 → 800, 300 → 1.200.
// Başarı oranı şartı %31 (%30 giremez, %31 girer), giriş ücreti, aynı masada buluşma, ödül, iade,
// toplam kazanılan çip, arkadaş masası yok, farklı girişler karışmaz.
// node tests/emulator/carli.mjs
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInAnonymously } from "firebase/auth";
import { connectFirestoreEmulator, doc, getDoc, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
let ok = true;
const check = (l, c, x = "") => { console.log(`${c ? "✓" : "✗"} ${l}${x ? " — " + x : ""}`); if (!c) ok = false; };
const err = (p) => p.then(() => ({ code: "BAŞARI" }), (e) => ({ code: e.details?.code ?? e.code, params: e.details?.params ?? {} }));
let n = 0;
async function client(name, played = 10, won = 4) {
  const app = initializeApp({ projectId: "demo-cinali", apiKey: "demo-key" }, `${name}-${n++}`);
  const auth = getAuth(app); connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const db = getFirestore(app); connectFirestoreEmulator(db, "127.0.0.1", 8080);
  const fns = getFunctions(app, "europe-west3"); connectFunctionsEmulator(fns, "127.0.0.1", 5001);
  const { user } = await signInAnonymously(auth);
  const call = (n, d) => httpsCallable(fns, n)(d).then((r) => r.data);
  await call("bootstrap", { name }); await call("heartbeat", { name, adult: true });
  await call("testSetStats", { played, won });
  const balance = async () => (await getDoc(doc(db, "wallets", user.uid))).data().balance;
  const won_ = async () => Number((await getDoc(doc(db, "users", user.uid))).data()?.chipsWon ?? 0);
  return { uid: user.uid, db, call, balance, won: won_, name };
}
const lang = "tr";
const tbl = async (c, id) => (await getDoc(doc(c.db, "tables", id))).data();

// Başarı oranı şartı %31: %30 (10 oyunda 3) giremez, %31 (100 oyunda 31) girer; reddedilince çip kesilmez
{
  const L = await client("Leman", 10, 3), M = await client("Mahir", 100, 31);
  for (const type of ["carli", "carli2", "carli3"]) {
    const b0 = await L.balance();
    const e = await err(L.call("joinTable", { type, lang, name: "Leman" }));
    check(`${type}: %30 oyuncu giremez (rateTooLowCarli, şart %31), çip kesilmez`, e.code === "rateTooLowCarli" && e.params.need === 31 && e.params.rate === 30 && (await L.balance()) === b0, JSON.stringify(e));
  }
  const j = await M.call("joinTable", { type: "carli", lang, name: "Mahir" });
  check("%31 oyuncu Çarli'ye oturabilir", !!j.tableId);
  await M.call("leaveTable", { tableId: j.tableId }).catch(() => {});
}

for (const [type, entry, prize] of [["carli", 100, 400], ["carli2", 200, 800], ["carli3", 300, 1200]]) {
  const A = await client(`Asaf${entry}`), B = await client(`Burcu${entry}`);
  // 1.200'lük masa için kumbaraya çip
  if (entry === 300) for (const c of [A, B]) await c.call("testPurchase", { chips: 5000, productId: "wordokey_cip_5k" });
  const a0 = await A.balance(), b0 = await B.balance();
  const ja = await A.call("joinTable", { type, lang, name: A.name });
  const jb = await B.call("joinTable", { type, lang, name: B.name });
  check(`Çarli ${entry}: %40 oyuncular oturabilir, ikisi aynı masada`, ja.tableId === jb.tableId);
  check(`Çarli ${entry}: giriş ${entry} alındı`, (await A.balance()) === a0 - entry && (await B.balance()) === b0 - entry, `${a0}→${await A.balance()}`);
  await A.call("startTable", { tableId: ja.tableId });
  const t = await tbl(A, ja.tableId);
  check(`Çarli ${entry}: 4 kişilik (2 insan + 2 bilgisayar)`, t.seats.length === 4 && t.seats.filter((x) => x.bot).length === 2 && t.type === type);
  await A.call("testRunTimeouts", { tableId: ja.tableId, winnerUid: A.uid });
  const end = await tbl(A, ja.tableId);
  check(`Çarli ${entry}: kazanan ${prize} aldı, kaybeden 0`, end.payouts[A.uid] === prize && end.payouts[B.uid] === 0 && (await A.balance()) === a0 - entry + prize && (await B.balance()) === b0 - entry, JSON.stringify(end.payouts));
  check(`Çarli ${entry}: toplam kazanılan çip ${prize}`, (await A.won()) === prize && (await B.won()) === 0);
  const jc = await A.call("joinTable", { type, lang, name: A.name });
  await B.call("joinTable", { type, lang, name: B.name });
  const a1 = await A.balance(), b1 = await B.balance();
  await A.call("startTable", { tableId: jc.tableId });
  await A.call("testRunTimeouts", { tableId: jc.tableId });
  check(`Çarli ${entry}: kimse bitiremeyince ${entry} iade`, (await A.balance()) === a1 + entry && (await B.balance()) === b1 + entry);
  check(`Çarli ${entry}: arkadaşla özel masa açılamaz`, (await err(A.call("createPrivateTable", { type, lang, name: A.name }))).code === "badRequest");
}

// Farklı girişler karışmaz
{
  const X = await client("Xanthe"), Y = await client("Yaman");
  const jx = await X.call("joinTable", { type: "carli", lang, name: "Xanthe" });
  const jy = await Y.call("joinTable", { type: "carli2", lang, name: "Yaman" });
  check("Çarli 100 ve 200 oyuncuları farklı masalarda bekler", jx.tableId !== jy.tableId && (await tbl(X, jx.tableId)).type === "carli" && (await tbl(Y, jy.tableId)).type === "carli2");
}

console.log(ok ? "\nHEPSİ GEÇTİ" : "\nHATA VAR");
process.exit(ok ? 0 : 1);
