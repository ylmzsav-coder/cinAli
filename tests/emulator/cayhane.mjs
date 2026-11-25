// Emülatöre karşı Çayhane'nin üç masası: 25 → 100, 50 → 200, 100 → 400.
// Giriş ücreti, şartsız oturma, aynı masada buluşma, ödül, iade, toplam kazanılan çip,
// arkadaş masası yok, VIP yalnızca 100'lük masada bekleyenle eşleşir.
// node tests/emulator/cayhane.mjs
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
  await call("bootstrap", { name }); await call("heartbeat", { name, adult: true });
  const balance = async () => (await getDoc(doc(db, "wallets", user.uid))).data().balance;
  const won = async () => Number((await getDoc(doc(db, "users", user.uid))).data()?.chipsWon ?? 0);
  return { uid: user.uid, db, call, balance, won, name };
}
const lang = "tr";
const tbl = async (c, id) => (await getDoc(doc(c.db, "tables", id))).data();

for (const [type, entry, prize] of [["caylak25", 25, 100], ["caylak50", 50, 200], ["caylak", 100, 400]]) {
  // Yeni oyuncular (hiç oyun yok, başarı oranı %0) oturabilir; aynı masada buluşur
  const A = await client(`Ayla${entry}`), B = await client(`Bora${entry}`);
  const a0 = await A.balance(), b0 = await B.balance();
  const ja = await A.call("joinTable", { type, lang, name: A.name });
  const jb = await B.call("joinTable", { type, lang, name: B.name });
  check(`Çayhane ${entry}: yeni oyuncular (%0) oturabilir, ikisi aynı masada`, ja.tableId === jb.tableId);
  check(`Çayhane ${entry}: giriş ${entry} alındı`, (await A.balance()) === a0 - entry && (await B.balance()) === b0 - entry, `${a0}→${await A.balance()}`);
  await A.call("startTable", { tableId: ja.tableId });
  const t = await tbl(A, ja.tableId);
  check(`Çayhane ${entry}: 4 kişilik (2 insan + 2 bilgisayar)`, t.seats.length === 4 && t.seats.filter((x) => x.bot).length === 2 && t.type === type);
  await A.call("testRunTimeouts", { tableId: ja.tableId, winnerUid: A.uid });
  const end = await tbl(A, ja.tableId);
  check(`Çayhane ${entry}: kazanan ${prize} aldı, kaybeden 0`, end.payouts[A.uid] === prize && end.payouts[B.uid] === 0 && (await A.balance()) === a0 - entry + prize && (await B.balance()) === b0 - entry, JSON.stringify(end.payouts));
  check(`Çayhane ${entry}: toplam kazanılan çip ${prize}`, (await A.won()) === prize && (await B.won()) === 0);
  // Kimse bitiremezse giriş iade (Çayhane sohbetsiz: oynamayana da iade)
  const jc = await A.call("joinTable", { type, lang, name: A.name });
  await B.call("joinTable", { type, lang, name: B.name });
  const a1 = await A.balance(), b1 = await B.balance();
  await A.call("startTable", { tableId: jc.tableId });
  await A.call("testRunTimeouts", { tableId: jc.tableId });
  check(`Çayhane ${entry}: kimse bitiremeyince ${entry} iade`, (await A.balance()) === a1 + entry && (await B.balance()) === b1 + entry);
  // Arkadaş masası yok
  check(`Çayhane ${entry}: arkadaşla özel masa açılamaz`, (await errCode(A.call("createPrivateTable", { type, lang, name: A.name }))) === "badRequest");
}

// Farklı girişler karışmaz
{
  const X = await client("Xenia"), Y = await client("Yusuf");
  const jx = await X.call("joinTable", { type: "caylak25", lang, name: "Xenia" });
  const jy = await Y.call("joinTable", { type: "caylak50", lang, name: "Yusuf" });
  check("Çayhane 25 ve 50 oyuncuları farklı masalarda bekler", jx.tableId !== jy.tableId && (await tbl(X, jx.tableId)).type === "caylak25" && (await tbl(Y, jy.tableId)).type === "caylak50");
}

// VIP yalnızca giriş 100 olan Çayhane masasında bekleyenle eşleşir
{
  const K = await client("Kamil"), V = await client("Vural");
  await V.call("testSubscribeVip");
  const jk = await K.call("joinTable", { type: "caylak25", lang: "it", name: "Kamil" });
  const jv = await V.call("joinTable", { type: "vip2", lang: "it", name: "Vural" });
  const kt = await tbl(K, jk.tableId);
  check("VIP, Çayhane 25'te bekleyenle eşleşmez (masası bozulmaz)", jv.tableId !== jk.tableId && kt.type === "caylak25" && kt.seats.length === 1);
}

console.log(ok ? "\nHEPSİ GEÇTİ" : "\nHATA VAR");
process.exit(ok ? 0 : 1);
