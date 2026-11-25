// Emülatöre karşı: sohbetli odada (Sosyete, VIP) hamlelerinin en az yarısını kendisi yapmayan
// oyuncunun girişi, kimse bitiremezse iade edilmez (çipi yanar). Sohbetsiz masada kural yok.
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

// 1b) Koltuklarda başarı oranı (avatarın altında gösterilir): %90
{
  const { table } = await pair("ustaozel", "Lale", "Mert");
  const t = await table();
  check("koltuklarda oyuncuların başarı oranı var (90)", t.seats.every((x) => x.rate === 90), JSON.stringify(t.seats.map((x) => x.rate)));
}

// 2) Biri yalnızca bir hamle yaptı (gerisi otomatik): yarısından az → onun da çipi yanar
{
  const { A, B, a0, b0, tableId, table } = await pair("ustaozel", "Cansu", "Doruk");
  await A.call("testRunTimeouts", { tableId, manualFor: { uid: A.uid, turns: 1 } });
  const t = await table();
  const sa = t.seats.find((x) => x.uid === A.uid);
  check(`tek hamle yapan Cansu (${sa.manual} elle / ${sa.auto} otomatik) iade almadı`, sa.manual === 1 && sa.auto > 1 && t.payouts[A.uid] === 0 && (await A.balance()) === a0 - 100, JSON.stringify(t.payouts));
  check("hiç oynamayan Doruk da iade almadı", t.payouts[B.uid] === 0 && (await B.balance()) === b0 - 100);
}

// 2b) Biri bütün sıralarını kendisi oynadı: iade alır; oynamayanın çipi yanar
{
  const { A, B, a0, b0, tableId, table } = await pair("ustaozel", "Elif", "Fatih");
  await A.call("testRunTimeouts", { tableId, manualFor: { uid: A.uid, turns: 9999 } });
  const t = await table();
  const sa = t.seats.find((x) => x.uid === A.uid);
  check(`bütün sıralarını oynayan Elif (${sa.manual} elle / ${sa.auto ?? 0} otomatik) iade aldı`, sa.manual > 0 && !sa.auto && t.payouts[A.uid] === 100 && (await A.balance()) === a0, JSON.stringify(t.payouts));
  check("oynamayan Fatih iade almadı", t.payouts[B.uid] === 0 && (await B.balance()) === b0 - 100);
}

// 2c) Gerçek hamle (act/discard) elle sayılır
{
  const { A, B, tableId, table } = await pair("ustaozel", "Gizem", "Hasan");
  const view = JSON.parse((await table()).view);
  const first = view.current === 0 ? A : B;
  if (view.phase === "draw") await first.call("act", { tableId, action: { type: "drawDeck" } });
  const hand = (await getDoc(doc(first.db, "tables", tableId, "hands", first.uid))).data();
  await first.call("act", { tableId, action: { type: "discard", tileId: hand.rack[hand.rack.length - 1].id } });
  const sf = (await table()).seats.find((x) => x.uid === first.uid);
  check("elle atılan taş sunucuda 'elle hamle' olarak sayıldı", sf.manual === 1, JSON.stringify(sf));
}

// 2d) Uyarı sayacı: arka arkaya otomatik sıralar sayılır, elle hamlede sıfırlanır
{
  const { A, B, tableId, table } = await pair("ustaozel", "Işıl", "Kaan");
  await A.call("testRunTimeouts", { tableId, turns: 4 });
  let t = await table();
  const st = (u) => t.seats.find((x) => x.uid === u.uid).autoStreak;
  check("iki oyuncunun sırası 2'şer kez otomatik: uyarı sayacı 2", st(A) === 2 && st(B) === 2 && t.status === "playing", `${st(A)} / ${st(B)}`);
  const view = JSON.parse(t.view);
  const cur = t.seats[view.current].uid === A.uid ? A : B;
  if (view.phase === "draw") await cur.call("act", { tableId, action: { type: "drawDeck" } });
  const hand = (await getDoc(doc(cur.db, "tables", tableId, "hands", cur.uid))).data();
  await cur.call("act", { tableId, action: { type: "discard", tileId: hand.rack[hand.rack.length - 1].id } });
  t = await table();
  check(`elle hamle yapan ${cur.name}'ın uyarı sayacı sıfırlandı, diğerininki duruyor`, st(cur) === 0 && st(cur === A ? B : A) === 2);
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

// 5) Toplam kazanılan çip: kazanılan ödül sunucuda birikir; iade sayılmaz; koltukta görünür
{
  const A = await client("Nermin"), B = await client("Orhan");
  const won = async (c) => Number((await getDoc(doc(c.db, "users", c.uid))).data()?.chipsWon ?? 0);
  const play = async (type, winner) => {
    const { tableId, code } = await A.call("createPrivateTable", { type, lang, name: A.name });
    await B.call("joinPrivateTable", { code, name: B.name });
    await A.call("startTable", { tableId });
    await A.call("testRunTimeouts", { tableId, ...(winner ? { winnerUid: winner.uid } : {}) });
    return tableId;
  };
  await play("ozel2", A);
  check("Fifty Cent 100'ü kazanan Nermin: toplam kazanılan çip 200; kaybeden Orhan 0", (await won(A)) === 200 && (await won(B)) === 0, `${await won(A)} / ${await won(B)}`);
  await play("ozel2", null);
  check("kimse bitiremeyince yapılan iade toplam kazanılan çipe sayılmaz", (await won(A)) === 200 && (await won(B)) === 0, `${await won(A)} / ${await won(B)}`);
  await play("ozel2", B);
  check("Orhan kazanınca onun toplamı da artar (200)", (await won(B)) === 200 && (await won(A)) === 200);
  const { tableId, code } = await A.call("createPrivateTable", { type: "ozel2", lang, name: A.name });
  await B.call("joinPrivateTable", { code, name: B.name });
  const seats = (await getDoc(doc(A.db, "tables", tableId))).data().seats;
  check("koltuklarda oyuncuların toplam kazanılan çipi var (rakip kartında görünür)", seats.every((x) => x.chipsWon === 200), JSON.stringify(seats.map((x) => x.chipsWon)));
}

console.log(ok ? "\nHEPSİ GEÇTİ" : "\nHATA VAR");
process.exit(ok ? 0 : 1);
