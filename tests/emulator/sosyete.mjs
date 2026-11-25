// Emülatöre karşı Sosyete: üç masa (100 → 400, 1.000 → 4.000, 10.000 → 40.000, dört kişilik),
// başarı oranı %76, ücretsiz küfür filtreli sohbet (18 yaş altı yazamaz), ödül, toplam çip,
// oynamadan bekleyenin çipi yanar (%50 kuralı), arkadaşla Sosyete Özel (iki kişilik), girişler karışmaz.
// node tests/emulator/sosyete.mjs
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInAnonymously } from "firebase/auth";
import { connectFirestoreEmulator, doc, getDoc, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
let ok = true;
const check = (l, c, x = "") => { console.log(`${c ? "✓" : "✗"} ${l}${x ? " — " + x : ""}`); if (!c) ok = false; };
const err = (p) => p.then((r) => ({ code: "BAŞARI", r }), (e) => ({ code: e.details?.code ?? e.code, params: e.details?.params ?? {} }));
let n = 0;
async function client(name, { played = 100, won = 90, adult = true } = {}) {
  const app = initializeApp({ projectId: "demo-cinali", apiKey: "demo-key" }, `${name}-${n++}`);
  const auth = getAuth(app); connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const db = getFirestore(app); connectFirestoreEmulator(db, "127.0.0.1", 8080);
  const fns = getFunctions(app, "europe-west3"); connectFunctionsEmulator(fns, "127.0.0.1", 5001);
  const { user } = await signInAnonymously(auth);
  const call = (n, d) => httpsCallable(fns, n)(d).then((r) => r.data);
  await call("bootstrap", { name }); await call("heartbeat", { name, adult });
  await call("testSetStats", { played, won });
  await call("testPurchase", { chips: 100000, productId: "wordokey_cip_100k" });
  const balance = async () => (await getDoc(doc(db, "wallets", user.uid))).data().balance;
  const won_ = async () => Number((await getDoc(doc(db, "users", user.uid))).data()?.chipsWon ?? 0);
  return { uid: user.uid, db, call, balance, won: won_, name };
}
const lang = "tr";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tbl = async (c, id) => (await getDoc(doc(c.db, "tables", id))).data();
const TYPES = [["usta", 100, 400], ["usta2", 1000, 4000], ["usta5", 10000, 40000]];

// Başarı oranı şartı %76: %75 giremez (çip kesilmez), %76 girer
{
  const L = await client("Lerzan", { played: 4, won: 3 }), M = await client("Metin", { played: 25, won: 19 });
  for (const [type] of TYPES) {
    const b0 = await L.balance();
    const e = await err(L.call("joinTable", { type, lang, name: "Lerzan" }));
    check(`${type}: %75 oyuncu giremez (rateTooLow, şart %76), çip kesilmez`, e.code === "rateTooLow" && e.params.need === 76 && e.params.rate === 75 && (await L.balance()) === b0, JSON.stringify(e));
  }
  const j = await M.call("joinTable", { type: "usta", lang, name: "Metin" });
  check("%76 oyuncu (25 oyunda 19) Sosyete'ye oturabilir", !!j.tableId);
  await M.call("leaveTable", { tableId: j.tableId }).catch(() => {});
}

for (const [type, entry, prize] of TYPES) {
  const A = await client(`Aslı${entry}`), B = await client(`Bülent${entry}`);
  const a0 = await A.balance(), b0 = await B.balance();
  const ja = await A.call("joinTable", { type, lang, name: A.name });
  const jb = await B.call("joinTable", { type, lang, name: B.name });
  check(`Sosyete ${entry}: iki oyuncu aynı masada, giriş ${entry} alındı`, ja.tableId === jb.tableId && (await A.balance()) === a0 - entry && (await B.balance()) === b0 - entry);
  await A.call("startTable", { tableId: ja.tableId });
  let t = await tbl(A, ja.tableId);
  check(`Sosyete ${entry}: 4 kişilik (2 insan + 2 bilgisayar)`, t.seats.length === 4 && t.seats.filter((x) => x.bot).length === 2 && t.type === type);
  check(`Sosyete ${entry}: ücretsiz sohbet (VIP gerekmeden yazışma)`, (await A.call("sendText", { tableId: ja.tableId, text: "iyi oyunlar", uiLang: "tr" })).ok === true);
  await sleep(2100); // art arda hızlı mesaj (flood) koruması
  const bad = await A.call("sendText", { tableId: ja.tableId, text: "siktir git", uiLang: "tr" });
  check(`Sosyete ${entry}: küfürlü mesaj gönderilmez`, bad.ok === false && bad.blocked === true, JSON.stringify(bad));
  // Hakaret de gönderilmez (B yazar; A'nın uyarı hakkı etkilenmez)
  const ins = await B.call("sendText", { tableId: ja.tableId, text: "salak mısın", uiLang: "tr" });
  check(`Sosyete ${entry}: hakaretli mesaj gönderilmez`, ins.ok === false && ins.blocked === true, JSON.stringify(ins));
  if (entry === 100) check("Sosyete: art arda çok hızlı mesaj engellenir (flood koruması)", (await err(A.call("sendText", { tableId: ja.tableId, text: "a", uiLang: "tr" }))).code === "tooFast");
  await A.call("testRunTimeouts", { tableId: ja.tableId, winnerUid: A.uid });
  t = await tbl(A, ja.tableId);
  check(`Sosyete ${entry}: kazanan ${prize} aldı, kaybeden 0`, t.payouts[A.uid] === prize && t.payouts[B.uid] === 0 && (await A.balance()) === a0 - entry + prize && (await B.balance()) === b0 - entry, JSON.stringify(t.payouts));
  check(`Sosyete ${entry}: toplam kazanılan çip ${prize}`, (await A.won()) === prize && (await B.won()) === 0);
  // Oynamadan bekleyen (bütün hamleleri otomatik) kimse bitiremeyince iade almaz; çoğunu elle oynayan alır
  const jc = await A.call("joinTable", { type, lang, name: A.name });
  await B.call("joinTable", { type, lang, name: B.name });
  const a1 = await A.balance(), b1 = await B.balance();
  await A.call("startTable", { tableId: jc.tableId });
  await A.call("testRunTimeouts", { tableId: jc.tableId, manualFor: { uid: A.uid, turns: 9999 } });
  check(`Sosyete ${entry}: kimse bitiremeyince elle oynayana ${entry} iade, oynamayanın çipi yandı`, (await A.balance()) === a1 + entry && (await B.balance()) === b1, `${a1}→${await A.balance()} / ${b1}→${await B.balance()}`);
  // 4 kişilik Sosyete'de arkadaş masası yok (arkadaşla oyna: iki kişilik Sosyete Özel)
  check(`Sosyete ${entry}: 4 kişilik arkadaş masası açılamaz`, (await err(A.call("createPrivateTable", { type, lang, name: A.name }))).code === "badRequest");
}

// Kaybettikçe oran düşer: %76'nın altına inen oyuncu Sosyete'ye yeniden giremez (gerçek kural)
{
  const P = await client("Pelin", { played: 10, won: 8 }), Q = await client("Kaan");
  const j = await P.call("joinTable", { type: "usta", lang, name: "Pelin" });
  await Q.call("joinTable", { type: "usta", lang, name: "Kaan" });
  await P.call("startTable", { tableId: j.tableId });
  await P.call("testRunTimeouts", { tableId: j.tableId, winnerUid: Q.uid });
  const e = await err(P.call("joinTable", { type: "usta", lang, name: "Pelin" }));
  check("%80 (10 oyunda 8) oyuncu kaybedince %73'e düşer ve Sosyete'ye yeniden giremez", e.code === "rateTooLow" && e.params.rate === 73 && e.params.played === 11, JSON.stringify(e.params));
}

// 18 yaş altı oyuncu Sosyete'de oynar ama serbest yazamaz
{
  const K = await client("Kuzey", { adult: false }), Y = await client("Yetişkin");
  const jk = await K.call("joinTable", { type: "usta", lang, name: "Kuzey" });
  await Y.call("joinTable", { type: "usta", lang, name: "Yetişkin" });
  await K.call("startTable", { tableId: jk.tableId });
  const e = await err(K.call("sendText", { tableId: jk.tableId, text: "merhaba", uiLang: "tr" }));
  check("18 yaş altı oyuncu Sosyete'de oynuyor ama serbest yazamıyor", (await tbl(K, jk.tableId)).status === "playing" && e.code !== "BAŞARI", e.code);
}

// Arkadaşla oyna: iki kişilik Sosyete Özel (davet kodu, sohbetli, ödül iki giriş)
for (const [type, entry] of [["ustaozel", 100], ["ustaozel2", 1000], ["ustaozel5", 10000]]) {
  const A = await client(`Ece${entry}`), B = await client(`Fırat${entry}`);
  const a0 = await A.balance();
  const p = await A.call("createPrivateTable", { type, lang, name: A.name });
  await B.call("joinPrivateTable", { code: p.code, name: B.name });
  await A.call("startTable", { tableId: p.tableId });
  const t = await tbl(A, p.tableId);
  check(`Sosyete Özel ${entry}: iki arkadaş, bilgisayar yok, sohbet açık`, t.status === "playing" && t.seats.length === 2 && t.seats.every((x) => !x.bot) && (await B.call("sendText", { tableId: p.tableId, text: "selam", uiLang: "tr" })).ok === true);
  await A.call("testRunTimeouts", { tableId: p.tableId, winnerUid: A.uid });
  check(`Sosyete Özel ${entry}: kazanan ${entry * 2} aldı`, (await A.balance()) === a0 - entry + entry * 2);
}
{
  const L = await client("Lal", { played: 4, won: 3 }), M = await client("Mert");
  const p = await M.call("createPrivateTable", { type: "ustaozel", lang, name: "Mert" });
  check("%75 arkadaş Sosyete Özel davetine katılamaz", (await err(L.call("joinPrivateTable", { code: p.code, name: "Lal" }))).code === "rateTooLow");
}

// Farklı girişler karışmaz
{
  const X = await client("Xeno"), Y = await client("Yavuz");
  const jx = await X.call("joinTable", { type: "usta", lang, name: "Xeno" });
  const jy = await Y.call("joinTable", { type: "usta2", lang, name: "Yavuz" });
  check("Sosyete 100 ve 1.000 oyuncuları farklı masalarda bekler", jx.tableId !== jy.tableId);
}

console.log(ok ? "\nHEPSİ GEÇTİ" : "\nHATA VAR");
process.exit(ok ? 0 : 1);
