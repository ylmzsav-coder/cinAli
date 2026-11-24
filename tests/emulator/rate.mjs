// Emülatöre karşı Sosyete giriş şartı (başarı oranı %76) ve sunucuda tutulan oyun sayıları:
// node tests/emulator/rate.mjs
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInAnonymously } from "firebase/auth";
import { connectFirestoreEmulator, doc, getDoc, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
let ok = true;
const check = (l, c, x = "") => { console.log(`${c ? "✓" : "✗"} ${l}${x ? " — " + x : ""}`); if (!c) ok = false; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function client(name) {
  const app = initializeApp({ projectId: "demo-cinali", apiKey: "demo-key" }, name);
  const auth = getAuth(app); connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const db = getFirestore(app); connectFirestoreEmulator(db, "127.0.0.1", 8080);
  const fns = getFunctions(app, "europe-west3"); connectFunctionsEmulator(fns, "127.0.0.1", 5001);
  const { user } = await signInAnonymously(auth);
  const call = (n, d) => httpsCallable(fns, n)(d).then((r) => r.data);
  await call("bootstrap", { name });
  const balance = async () => (await getDoc(doc(db, "wallets", user.uid))).data().balance;
  const counts = async () => { const d = (await getDoc(doc(db, "users", user.uid))).data() ?? {}; return [d.gamesPlayed ?? 0, d.gamesWon ?? 0]; };
  return { uid: user.uid, db, call, balance, counts };
}
const err = (p) => p.then(() => ({ code: "BAŞARI" }), (e) => ({ code: e.details?.code ?? e.code, params: e.details?.params ?? {} }));
const lang = "tr";

// 1) Yeni oyuncu (hiç oyun yok, %0): Sosyete'ye oturamaz, Çayhane serbest
const N = await client("Nihat");
const b0 = await N.balance();
const e0 = await err(N.call("joinTable", { type: "usta", lang, name: "Nihat" }));
check("yeni oyuncu (%0) Sosyete'ye oturamaz: rateTooLow", e0.code === "rateTooLow" && e0.params.need === 76 && e0.params.rate === 0, JSON.stringify(e0));
check("reddedilince çip kesilmez", (await N.balance()) === b0);

// 2) %75 (4 oyunda 3): üç Sosyete masasının hiçbirine oturamaz
const L = await client("Leyla");
await L.call("testPurchase", { chips: 15000, productId: "wordokey_cip_15k" });
await L.call("testSetStats", { played: 4, won: 3 });
for (const type of ["usta", "usta2", "usta5"]) {
  const e = await err(L.call("joinTable", { type, lang, name: "Leyla" }));
  check(`%75 oyuncu ${type} masasına oturamaz`, e.code === "rateTooLow" && e.params.rate === 75 && e.params.played === 4 && e.params.won === 3, JSON.stringify(e));
}

// 3) %76 (25 oyunda 19): oturur, giriş alınır
const H = await client("Hande");
await H.call("testSetStats", { played: 25, won: 19 });
const hb = await H.balance();
const hj = await H.call("joinTable", { type: "usta", lang, name: "Hande" });
check("%76 oyuncu Sosyete'ye oturur, 100 giriş alınır", !!hj.tableId && (await H.balance()) === hb - 100);
await H.call("leaveTable", { tableId: hj.tableId }); // başlamamış masadan kalkınca iade, oyun sayılmaz
check("başlamamış masadan kalkmak oyun sayılmaz", JSON.stringify(await H.counts()) === "[25,19]", JSON.stringify(await H.counts()));

// 4) Oyun sürerken masadan kalkan yenilmiş sayılır: 25/19 → 26/19 (%73) → Sosyete kapanır
const cj = await H.call("joinTable", { type: "caylak", lang, name: "Hande" });
await H.call("startTable", { tableId: cj.tableId });
await H.call("leaveTable", { tableId: cj.tableId });
check("oyun sürerken kalkmak yenilgi sayılır (26 oyun, 19 galibiyet)", JSON.stringify(await H.counts()) === "[26,19]", JSON.stringify(await H.counts()));
const e4 = await err(H.call("joinTable", { type: "usta", lang, name: "Hande" }));
check("oranı %73'e düşen oyuncu artık Sosyete'ye oturamaz", e4.code === "rateTooLow" && e4.params.rate === 73, JSON.stringify(e4));

// 5) Oyun sonu sunucuda sayılır: bitiren kazanır, diğerleri kaybeder; kimse bitiremezse sayılmaz
const P = await client("Pınar");
const [p0, w0] = await P.counts();
const pj = await P.call("joinTable", { type: "caylak", lang, name: "Pınar" });
await P.call("startTable", { tableId: pj.tableId });
for (let k = 0; k < 400; k++) {
  const t = (await getDoc(doc(P.db, "tables", pj.tableId))).data();
  if (t.status !== "playing") break;
  const view = JSON.parse(t.view);
  if (t.seats[view.current]?.uid !== P.uid) { await sleep(50); continue; }
  if (view.phase === "draw") await P.call("act", { tableId: pj.tableId, action: { type: "drawDeck" } });
  const hand = (await getDoc(doc(P.db, "tables", pj.tableId, "hands", P.uid))).data();
  const tile = hand.rack.find((x) => x.letter !== null) ?? hand.rack[0];
  await P.call("act", { tableId: pj.tableId, action: { type: "discard", tileId: tile.id } });
}
const end = (await getDoc(doc(P.db, "tables", pj.tableId))).data();
const v = JSON.parse(end.view);
const [p1, w1] = await P.counts();
const reason = v.lastResult?.reason, winner = v.lastResult?.winner;
const expect = reason === "deckEmpty" ? [p0, w0] : winner === 0 ? [p0 + 1, w0 + 1] : [p0 + 1, w0];
check("oyun sonu sunucuda doğru sayılır", end.status === "finished" && p1 === expect[0] && w1 === expect[1], `bitiş ${reason}, bitiren ${winner}, sayılar ${p0}/${w0} → ${p1}/${w1}`);

// 6) Oyuncu kendi sayılarını değiştiremez (yalnızca sunucu yazar)
const { setDoc } = await import("firebase/firestore");
const w = await setDoc(doc(L.db, "users", L.uid), { gamesPlayed: 1, gamesWon: 1 }, { merge: true }).then(() => "YAZILDI!", (e) => e.code);
check("oyuncu başarı sayılarını kendisi yazamaz", w === "permission-denied", w);

console.log(ok ? "\nHEPSİ GEÇTİ" : "\nHATA VAR");
process.exit(ok ? 0 : 1);
