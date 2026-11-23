// Emülatöre karşı oyuncu engelleme testi: node tests/emulator/blocks.mjs
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
  await call("heartbeat", { name });
  const balance = async () => (await getDoc(doc(db, "wallets", user.uid))).data().balance;
  return { uid: user.uid, db, call, name, balance };
}
const errCode = (p) => p.then(() => "BAŞARI", (e) => e.details?.code ?? e.code);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = true;
const check = (label, cond, extra = "") => { console.log(`${cond ? "✓" : "✗"} ${label}${extra ? " — " + extra : ""}`); if (!cond) ok = false; };
const A = await client("Ali"), B = await client("Bea");
await A.call("sendFriendRequest", { targetUid: B.uid });
await B.call("sendFriendRequest", { targetUid: A.uid });
check("önce arkadaşlar", (await A.call("friendsStatus")).friends.some((f) => f.uid === B.uid));

check("Ali, Bea'yı engeller", (await A.call("blockPlayer", { targetUid: B.uid, name: "Bea" })).ok === true);
check("arkadaşlık silindi (iki taraf)", !(await A.call("friendsStatus")).friends.length && !(await B.call("friendsStatus")).friends.length);
check("engellenenler listesinde", (await A.call("blockedList")).blocked.some((b) => b.uid === B.uid && b.name === "Bea"));
check("Bea arkadaşlık isteği gönderemez", (await errCode(B.call("sendFriendRequest", { targetUid: A.uid }))) === "blocked");
check("Ali de Bea'ya istek gönderemez", (await errCode(A.call("sendFriendRequest", { targetUid: B.uid }))) === "blocked");
check("Bea hediye gönderemez", (await errCode(B.call("sendGift", { toUid: A.uid, giftId: "cay" }))) === "blocked");

// Eşleşme: Ali Çayhane'de bekler, Bea aynı masaya oturtulmaz
const ja = await A.call("joinTable", { type: "caylak", lang: "tr", name: "Ali" });
const jb = await B.call("joinTable", { type: "caylak", lang: "tr", name: "Bea" });
check("engelliler aynı masaya eşleşmez", ja.tableId !== jb.tableId, `${ja.tableId} / ${jb.tableId}`);
const C = await client("Can");
const jc = await C.call("joinTable", { type: "caylak", lang: "tr", name: "Can" });
check("başka oyuncu yine eşleşir", jc.tableId === ja.tableId || jc.tableId === jb.tableId);
await A.call("leaveTable", { tableId: ja.tableId }); await B.call("leaveTable", { tableId: jb.tableId }); await C.call("leaveTable", { tableId: jc.tableId });

check("engel kaldırılır", (await A.call("unblockPlayer", { targetUid: B.uid })).ok === true);
check("kaldırınca istek gönderilebilir", (await B.call("sendFriendRequest", { targetUid: A.uid })).status === "sent");
check("başkası engellenenler listesini okuyamaz", (await getDocs(collection(B.db, "users", A.uid, "blocks")).then(() => "EVET", (e) => e.code)) === "permission-denied");
console.log(ok ? "\nHEPSİ GEÇTİ" : "\nHATA VAR");
process.exit(ok ? 0 : 1);
