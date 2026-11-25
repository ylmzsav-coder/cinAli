// Emülatöre karşı Fifty Cent'in üç masası: 100 → 200, 1.000 → 2.000, 10.000 → 20.000 (iki kişilik).
// Başarı oranı şartı %50, rastgele oyuncu, arkadaşla (davet kodu), bilgisayara karşı, ödül, iade,
// toplam kazanılan çip, sohbet yok, farklı girişler karışmaz.
// node tests/emulator/fiftycent.mjs
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInAnonymously } from "firebase/auth";
import { connectFirestoreEmulator, doc, getDoc, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
let ok = true;
const check = (l, c, x = "") => { console.log(`${c ? "✓" : "✗"} ${l}${x ? " — " + x : ""}`); if (!c) ok = false; };
const err = (p) => p.then(() => ({ code: "BAŞARI" }), (e) => ({ code: e.details?.code ?? e.code, params: e.details?.params ?? {} }));
let n = 0;
async function client(name, played = 10, won = 6) {
  const app = initializeApp({ projectId: "demo-cinali", apiKey: "demo-key" }, `${name}-${n++}`);
  const auth = getAuth(app); connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const db = getFirestore(app); connectFirestoreEmulator(db, "127.0.0.1", 8080);
  const fns = getFunctions(app, "europe-west3"); connectFunctionsEmulator(fns, "127.0.0.1", 5001);
  const { user } = await signInAnonymously(auth);
  const call = (n, d) => httpsCallable(fns, n)(d).then((r) => r.data);
  await call("bootstrap", { name }); await call("heartbeat", { name, adult: true });
  await call("testSetStats", { played, won });
  await call("testPurchase", { chips: 50000, productId: "wordokey_cip_50k" });
  const balance = async () => (await getDoc(doc(db, "wallets", user.uid))).data().balance;
  const won_ = async () => Number((await getDoc(doc(db, "users", user.uid))).data()?.chipsWon ?? 0);
  return { uid: user.uid, db, call, balance, won: won_, name };
}
const lang = "tr";
const tbl = async (c, id) => (await getDoc(doc(c.db, "tables", id))).data();
const TYPES = [["ozel2", 100, 200], ["ozel2u", 1000, 2000], ["ozel2b", 10000, 20000]];

// Başarı oranı şartı %50: %49 giremez (rastgele de, arkadaş daveti de), %50 girer
{
  const L = await client("Lale", 100, 49), M = await client("Murat", 10, 5);
  for (const [type] of TYPES) {
    const b0 = await L.balance();
    const e = await err(L.call("joinTable", { type, lang, name: "Lale" }));
    check(`${type}: %49 oyuncu giremez (rateTooLowOzel, şart %50), çip kesilmez`, e.code === "rateTooLowOzel" && e.params.need === 50 && e.params.rate === 49 && (await L.balance()) === b0, JSON.stringify(e));
  }
  const { code } = await M.call("createPrivateTable", { type: "ozel2", lang, name: "Murat" });
  const e = await err(L.call("joinPrivateTable", { code, name: "Lale" }));
  check("%49 arkadaş davet koduyla da giremez", e.code === "rateTooLowOzel", JSON.stringify(e));
  check("%50 oyuncu (10 oyunda 5) Fifty Cent'te masa açabildi", !!code);
}

for (const [type, entry, prize] of TYPES) {
  // Rastgele oyuncu: ikinci oyuncu gelince oyun hemen başlar (iki kişilik)
  const A = await client(`Ali${entry}`), B = await client(`Banu${entry}`);
  const a0 = await A.balance(), b0 = await B.balance();
  const ja = await A.call("joinTable", { type, lang, name: A.name });
  const jb = await B.call("joinTable", { type, lang, name: B.name });
  let t = await tbl(A, ja.tableId);
  check(`Fifty Cent ${entry}: rastgele iki oyuncu aynı masada, oyun hemen başladı (2 insan, bilgisayar yok)`, ja.tableId === jb.tableId && t.status === "playing" && t.seats.length === 2 && t.seats.every((x) => !x.bot), `${t.status} · ${t.seats.map((x) => x.name).join(" vs ")}`);
  check(`Fifty Cent ${entry}: giriş ${entry} alındı`, (await A.balance()) === a0 - entry && (await B.balance()) === b0 - entry);
  check(`Fifty Cent ${entry}: sohbet yok`, (await err(A.call("sendText", { tableId: ja.tableId, text: "merhaba", uiLang: "tr" }))).code === "chatVipOnly");
  await A.call("testRunTimeouts", { tableId: ja.tableId, winnerUid: B.uid });
  t = await tbl(A, ja.tableId);
  check(`Fifty Cent ${entry}: kazanan ${prize} aldı, kaybeden 0`, t.payouts[B.uid] === prize && t.payouts[A.uid] === 0 && (await B.balance()) === b0 - entry + prize && (await A.balance()) === a0 - entry, JSON.stringify(t.payouts));
  check(`Fifty Cent ${entry}: toplam kazanılan çip ${prize}`, (await B.won()) === prize && (await A.won()) === 0);
  // Arkadaşla: davet koduyla özel masa
  const p = await A.call("createPrivateTable", { type, lang, name: A.name });
  await B.call("joinPrivateTable", { code: p.code, name: B.name });
  await A.call("startTable", { tableId: p.tableId });
  t = await tbl(A, p.tableId);
  check(`Fifty Cent ${entry}: arkadaşla (davet kodu) iki kişi oynuyor`, t.private === true && t.status === "playing" && t.seats.length === 2 && t.seats.every((x) => !x.bot));
  const a1 = await A.balance(), b1 = await B.balance();
  await A.call("testRunTimeouts", { tableId: p.tableId });
  check(`Fifty Cent ${entry}: kimse bitiremeyince ${entry} iade (sohbetsiz masa)`, (await A.balance()) === a1 + entry && (await B.balance()) === b1 + entry);
  // Bilgisayara karşı: beklemeden başlar
  const c0 = await A.balance();
  const jc = await A.call("joinTable", { type, lang, name: A.name });
  await A.call("startTable", { tableId: jc.tableId });
  t = await tbl(A, jc.tableId);
  check(`Fifty Cent ${entry}: bilgisayara karşı hemen başladı (1 insan + 1 bilgisayar), giriş ${entry}`, t.status === "playing" && t.seats.length === 2 && t.seats.filter((x) => x.bot).length === 1 && (await A.balance()) === c0 - entry);
  await A.call("testRunTimeouts", { tableId: jc.tableId, winnerUid: A.uid });
  check(`Fifty Cent ${entry}: bilgisayarı yenen ${prize} aldı`, (await A.balance()) === c0 - entry + prize);
}

// Farklı girişler karışmaz
{
  const X = await client("Xavi"), Y = await client("Yeşim");
  const jx = await X.call("joinTable", { type: "ozel2", lang, name: "Xavi" });
  const jy = await Y.call("joinTable", { type: "ozel2u", lang, name: "Yeşim" });
  check("Fifty Cent 100 ve 1.000 oyuncuları farklı masalarda bekler", jx.tableId !== jy.tableId && (await tbl(X, jx.tableId)).status === "waiting" && (await tbl(Y, jy.tableId)).status === "waiting");
}

console.log(ok ? "\nHEPSİ GEÇTİ" : "\nHATA VAR");
process.exit(ok ? 0 : 1);
