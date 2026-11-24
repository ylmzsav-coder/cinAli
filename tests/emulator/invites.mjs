// Emülatöre karşı arkadaşla oyna (davet) testi: node tests/emulator/invites.mjs
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInAnonymously } from "firebase/auth";
import { connectFirestoreEmulator, doc, getDoc, getDocs, collection, getFirestore } from "firebase/firestore";
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
  await call("testSetStats", { played: 10, won: 9 }); // Teke Tek giriş şartı (%50)
  await call("heartbeat", { name });
  const balance = async () => (await getDoc(doc(db, "wallets", user.uid))).data().balance;
  return { uid: user.uid, db, call, name, balance };
}
const errCode = (p) => p.then(() => "BAŞARI", (e) => e.details?.code ?? e.code);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = true;
const check = (label, cond, extra = "") => { console.log(`${cond ? "✓" : "✗"} ${label}${extra ? " — " + extra : ""}`); if (!cond) ok = false; };
const A = await client("Ali"), B = await client("Bea");
await A.call("sendFriendRequest", { targetUid: B.uid }); // Ali, Bea'yı listesine ekler (tek taraflı)

// Bea başka bir masada oynuyor
const jb = await B.call("joinTable", { type: "caylak", lang: "tr", name: "Bea" });
await B.call("startTable", { tableId: jb.tableId });
const fl = (await A.call("friendsStatus")).friends.find((f) => f.uid === B.uid);
check("Ali, Bea'yı oyunda görür", fl && fl.online && fl.tableStatus === "playing", JSON.stringify(fl));

// Ali Teke Tek'te "Arkadaşla oyna": özel masa açar, Bea'yı davet eder
const pt = await A.call("createPrivateTable", { type: "ozel2", lang: "tr", name: "Ali" });
check("davet gider (Bea oyunda olsa da)", (await A.call("inviteFriend", { tableId: pt.tableId, friendUid: B.uid })).ok === true);
const read = async () => (await getDoc(doc(A.db, "tables", pt.tableId))).data();
check("masada davet edildi bilgisi", (await read()).invited?.[B.uid] === "Bea", JSON.stringify((await read()).invited));
check("Bea'nın davet kutusunda bekliyor", (await B.call("friendsStatus")).invites.some((i) => i.tableId === pt.tableId));

// Bea reddeder → Ali görür; tekrar davet edince reddetme silinir
await B.call("declineInvite", { tableId: pt.tableId });
check("reddetti bilgisi masada", (await read()).declined?.[B.uid] === "Bea");
check("davet kutusundan çıktı", !(await B.call("friendsStatus")).invites.some((i) => i.tableId === pt.tableId));
await A.call("inviteFriend", { tableId: pt.tableId, friendUid: B.uid });
check("tekrar davet: reddetme silindi", !(await read()).declined?.[B.uid]);

// Bea oyundan çıkar ve daveti kabul eder → masaya oturur
await B.call("leaveTable", { tableId: jb.tableId });
const inv = (await B.call("friendsStatus")).invites.find((i) => i.tableId === pt.tableId);
const jp = await B.call("joinPrivateTable", { code: inv.code, name: "Bea" });
check("Bea davetle masaya oturdu", jp.tableId === pt.tableId && (await read()).seats.length === 2);

// Masa kapanınca davet düşer
const C = await client("Can");
await C.call("sendFriendRequest", { targetUid: A.uid });
const pt2 = await C.call("createPrivateTable", { type: "ozel2", lang: "tr", name: "Can" }).catch((e) => ({ err: e.details?.code }));
await C.call("sendFriendRequest", { targetUid: B.uid });
await C.call("inviteFriend", { tableId: pt2.tableId, friendUid: B.uid });
await C.call("leaveTable", { tableId: pt2.tableId });
check("kapanan masanın daveti görünmez", !(await B.call("friendsStatus")).invites.some((i) => i.tableId === pt2.tableId));
console.log(ok ? "\nHEPSİ GEÇTİ" : "\nHATA VAR");
process.exit(ok ? 0 : 1);
