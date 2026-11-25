// Emülatöre karşı: sohbetli odada (Sosyete, VIP) hiç hamle yapmayan oyuncunun girişi,
// kimse bitiremezse iade edilmez (çipi yanar). Sohbetsiz masada kural yok: iade edilir.
// node tests/emulator/idle.mjs
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInAnonymously } from "firebase/auth";
import { connectFirestoreEmulator, doc, getDoc, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
let ok = true;
const check = (l, c, x = "") => { console.log(`${c ? "✓" : "✗"} ${l}${x ? " — " + x : ""}`); if (!c) ok = false; };
let n = 0;
async function client(name) {
  const app = initializeApp({ projectId: "demo-cinali", apiKey: "demo-key" }, `${name}-${n++}`);
  const auth = getAuth(app); connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const db = getFirestore(app); connectFirestoreEmulator(db, "127.0.0.1", 8080);
  const fns = getFunctions(app, "europe-west3"); connectFunctionsEmulator(fns, "127.0.0.1", 5001);
  const { user } = await signInAnonymously(auth);
  const call = (n, d) => httpsCallable(fns, n)(d).then((r) => r.data);
  await call("bootstrap", { name });
  await call("testSetStats", { played: 10, won: 9 });
  await call("heartbeat", { name, adult: true });
  const balance = async () => (await getDoc(doc(db, "wallets", user.uid))).data().balance;
  return { uid: user.uid, db, call, balance, name };
}
const lang = "tr";

/** A özel masa kurar, B davet koduyla oturur, A başlatır. */
async function pair(type, a, b) {
  const A = await client(a), B = await client(b);
  const a0 = await A.balance(), b0 = await B.balance();
  const { tableId, code } = await A.call("createPrivateTable", { type, lang, name: a });
  await B.call("joinPrivateTable", { code, name: b });
  await A.call("startTable", { tableId });
  const table = async () => (await getDoc(doc(A.db, "tables", tableId))).data();
  return { A, B, a0, b0, tableId, table };
}

// 1) Sosyete Özel (iki kişilik, sohbetli): ikisi de hiç oynamadı → ikisinin de girişi yanar
{
  const { A, B, a0, b0, tableId, table } = await pair("ustaozel", "Ayla", "Barış");
  const r = await A.call("testRunTimeouts", { tableId });
  const t = await table();
  check("Sosyete Özel: bütün hamleler otomatik, deste bitti (kimse bitiremedi)", r.reason === "deckEmpty" && t.status === "finished", JSON.stringify(r));
  check("Sosyete Özel: hiç oynamayan iki oyuncuya iade yok (ödeme 0)", t.payouts[A.uid] === 0 && t.payouts[B.uid] === 0, JSON.stringify(t.payouts));
  check("Sosyete Özel: iki oyuncunun 100 çipi yandı", (await A.balance()) === a0 - 100 && (await B.balance()) === b0 - 100, `${a0}→${await A.balance()} / ${b0}→${await B.balance()}`);
}

// 2) Biri bir hamle yaptı, öteki hiç oynamadı: oynayana iade, oynamayanın çipi yanar
{
  const { A, B, a0, b0, tableId, table } = await pair("ustaozel", "Cansu", "Doruk");
  const view = JSON.parse((await table()).view);
  const first = view.current === 0 ? A : B, other = first === A ? B : A;
  // İlk oyuncu 15 taşla başlar (çekmeden atar); çekme aşamasındaysa desteden çeker
  if (view.phase === "draw") await first.call("act", { tableId, action: { type: "drawDeck" } });
  else {
    const hand = (await getDoc(doc(first.db, "tables", tableId, "hands", first.uid))).data();
    await first.call("act", { tableId, action: { type: "discard", tileId: hand.rack[hand.rack.length - 1].id } });
  }
  await A.call("testRunTimeouts", { tableId });
  const t = await table();
  check(`hamle yapan (${first.name}) iade aldı, oynamayan (${other.name}) almadı`, t.payouts[first.uid] === 100 && t.payouts[other.uid] === 0, JSON.stringify(t.payouts));
  const fb = first === A ? a0 : b0, ob = first === A ? b0 : a0;
  check("kumbaralar: hamle yapan eksiksiz, oynamayan 100 eksik", (await first.balance()) === fb && (await other.balance()) === ob - 100);
}

// 3) Sosyete 4 kişilik masa (sohbetli): oynamayan insanların girişi yanar
{
  const { A, B, a0, b0, tableId, table } = await pair("usta", "Ece", "Ferhat");
  await A.call("testRunTimeouts", { tableId });
  const t = await table();
  check("Sosyete (4 kişilik, botlu): hiç oynamayan iki insana iade yok", t.payouts[A.uid] === 0 && t.payouts[B.uid] === 0 && (await A.balance()) === a0 - 100 && (await B.balance()) === b0 - 100, JSON.stringify(t.payouts));
}

// 4) Sohbetsiz masa (Fifty Cent): kural yok, kimse bitiremezse iade edilir
{
  const { A, B, a0, b0, tableId, table } = await pair("ozel2", "Gül", "Hakan");
  await A.call("testRunTimeouts", { tableId });
  const t = await table();
  check("Fifty Cent (sohbetsiz): oynamasa da kimse bitiremeyince iade", t.payouts[A.uid] === 100 && t.payouts[B.uid] === 100 && (await A.balance()) === a0 && (await B.balance()) === b0, JSON.stringify(t.payouts));
}

console.log(ok ? "\nHEPSİ GEÇTİ" : "\nHATA VAR");
process.exit(ok ? 0 : 1);
