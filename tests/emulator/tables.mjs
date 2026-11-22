// Emülatöre karşı çevrimiçi masa testi: node tests/emulator/tables.mjs
import { deleteApp, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInAnonymously } from "firebase/auth";
import { connectFirestoreEmulator, doc, getDoc, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";

async function client(name) {
  const app = initializeApp({ projectId: "demo-cinali", apiKey: "demo-key" }, name);
  const auth = getAuth(app);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  const fns = getFunctions(app, "europe-west3");
  connectFunctionsEmulator(fns, "127.0.0.1", 5001);
  const { user } = await signInAnonymously(auth);
  const call = (n, d) => httpsCallable(fns, n)(d).then((r) => r.data);
  await call("bootstrap", { name });
  const balance = async () => (await getDoc(doc(db, "wallets", user.uid))).data().balance;
  return { app, uid: user.uid, db, call, name, balance };
}
const errCode = (p) => p.then(() => "BAŞARI", (e) => e.details?.code ?? e.code);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const A = await client("Ali");
const B = await client("Bea");
const lang = "tr", type = "caylak";
const ja = await A.call("joinTable", { type, lang, name: "Ali" });
const jb = await B.call("joinTable", { type, lang, name: "Bea" });
console.log("aynı masa:", ja.tableId === jb.tableId, "| bakiyeler:", await A.balance(), await B.balance());
console.log("tekrar oturma ücretsiz devam:", JSON.stringify(await A.call("joinTable", { type, lang, name: "Ali" })), await A.balance());
console.log("erken başlatma (artık izinli):", await errCode(A.call("startTable", { tableId: ja.tableId })));
await sleep(8500);
await A.call("startTable", { tableId: ja.tableId });
const id = ja.tableId;

const read = async (c) => {
  const t = (await getDoc(doc(c.db, "tables", id))).data();
  const h = (await getDoc(doc(c.db, "tables", id, "hands", c.uid))).data();
  return { t, view: t.view ? JSON.parse(t.view) : null, hand: h };
};
let { t, view } = await read(A);
console.log("durum:", t.status, "| koltuklar:", t.seats.map((s) => s.name + (s.bot ? "(bot)" : "")).join(", "));
console.log("Ali başkasının ıstakasını okuyabilir mi:", await getDoc(doc(A.db, "tables", id, "hands", B.uid)).then(() => "EVET!", (e) => e.code));
console.log("sunucu durumu okunabilir mi:", await getDoc(doc(A.db, "tables", id, "server", "state")).then(() => "EVET!", (e) => e.code));
console.log("görünümde deste/ıstaka var mı:", "deck" in view, view.players.some((p) => "rack" in p), "| deste sayısı:", view.deckCount);

// Oyun: sırası gelen insan desteden çeker, ilk taşını atar. Botlar sunucuda oynar.
const players = { [A.uid]: A, [B.uid]: B };
let turns = 0, wrongTurnChecked = false;
for (;;) {
  ({ t, view } = await read(A));
  if (t.status !== "playing") break;
  if (view.phase === "handOver") { await sleep(100); await A.call("claimTimeout", { tableId: id }).catch(() => {}); 
    // el arası: süre dolmadan dağıtılmaz; test için beklemek yerine süre dolumunu taklit edemeyiz -> bekle
    const left = t.deadline - Date.now();
    console.log(`el ${view.handNo} bitti, sonuç: ${JSON.stringify(view.lastResult.scores)} (${Math.ceil(left / 1000)} sn mola)`);
    await sleep(Math.max(0, left) + 1700);
    await A.call("claimTimeout", { tableId: id });
    continue;
  }
  const seat = t.seats[view.current];
  const me = players[seat.uid];
  if (!wrongTurnChecked) {
    const other = me === A ? B : A;
    console.log("sırası olmayan oynarsa:", await errCode(other.call("act", { tableId: id, action: { type: "drawDeck" } })));
    console.log("çekmeden atarsa:", view.phase === "draw" ? await errCode(me.call("act", { tableId: id, action: { type: "discard", tileId: 0 } })) : "-");
    wrongTurnChecked = true;
  }
  if (view.phase === "draw") await me.call("act", { tableId: id, action: { type: "drawDeck" } });
  const { hand } = await read(me);
  const tile = hand.rack.find((x) => x.letter !== null) ?? hand.rack[0];
  await me.call("act", { tableId: id, action: { type: "discard", tileId: tile.id } });
  turns++;
}
({ t, view } = await read(A));
console.log("bitti:", t.status, "| insan hamlesi:", turns, "| toplamlar:", JSON.stringify(view.history.reduce((s, h) => s.map((v, i) => v + h[i]), [0, 0, 0, 0])));
console.log("ödemeler:", JSON.stringify(t.payouts), "| bakiyeler:", await A.balance(), await B.balance());
await deleteApp(A.app); await deleteApp(B.app);
process.exit(0);
