// Hediye testi: node tests/emulator/gifts.mjs
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInAnonymously } from "firebase/auth";
import { collection, connectFirestoreEmulator, doc, getDoc, getDocs, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
async function client(name) {
  const app = initializeApp({ projectId: "demo-cinali", apiKey: "demo-key" }, name);
  const auth = getAuth(app); connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const db = getFirestore(app); connectFirestoreEmulator(db, "127.0.0.1", 8080);
  const fns = getFunctions(app, "europe-west3"); connectFunctionsEmulator(fns, "127.0.0.1", 5001);
  const { user } = await signInAnonymously(auth);
  const call = (n, d) => httpsCallable(fns, n)(d).then((r) => r.data);
  await call("bootstrap", { name }); await call("heartbeat", { name });
  const bal = async () => (await getDoc(doc(db, "wallets", user.uid))).data().balance;
  return { uid: user.uid, db, call, bal };
}
const errCode = (p) => p.then(() => "BAŞARI", (e) => e.details?.code ?? e.code);
let ok = true;
const check = (l, c, x = "") => { console.log(`${c ? "✓" : "✗"} ${l}${x ? " — " + x : ""}`); if (!c) ok = false; };
const A = await client("Ali"), B = await client("Bea"), C = await client("Can");
check("yabancıya hediye gönderilemez", (await errCode(A.call("sendGift", { toUid: C.uid, giftId: "gul" }))) === "giftNotAllowed");
await A.call("sendFriendRequest", { targetUid: B.uid }); await B.call("sendFriendRequest", { targetUid: A.uid });
const a0 = await A.bal();
await A.call("sendGift", { toUid: B.uid, giftId: "canta" }); // 500
check("göndericiden çip düştü", (await A.bal()) === a0 - 500);
let gifts = (await getDocs(collection(B.db, "users", B.uid, "gifts"))).docs;
check("alıcının hediye kutusunda", gifts.length === 1 && gifts[0].data().giftId === "canta" && gifts[0].data().fromName === "Ali");
check("başkasının hediyeleri okunamaz", (await getDocs(collection(A.db, "users", B.uid, "gifts")).then(() => "EVET", (e) => e.code)) === "permission-denied");
const b0 = await B.bal();
const conv = await B.call("convertGift", { id: gifts[0].id });
check("hediye %80 ile çipe döndü", conv.chips === 400 && (await B.bal()) === b0 + 400, `+${conv.chips}`);
check("ikinci kez dönüştürülemez", (await errCode(B.call("convertGift", { id: gifts[0].id }))) === "giftConverted");
check("başkasının hediyesi dönüştürülemez", (await errCode(A.call("convertGift", { id: gifts[0].id }))) === "giftNotFound");
check("yetersiz çip", (await errCode(A.call("sendGift", { toUid: B.uid, giftId: "araba" }).then(() => A.call("sendGift", { toUid: B.uid, giftId: "araba" })))) === "notEnoughChips");
// Masadaki oyuncuya (arkadaş değil) hediye
const room = await C.call("createPrivateTable", { type: "caylak", lang: "tr", name: "Can" });
const D = await client("Dio");
await D.call("joinPrivateTable", { code: room.code, name: "Dio" });
await C.call("startTable", { tableId: room.tableId });
await C.call("sendGift", { toUid: D.uid, giftId: "kahve", tableId: room.tableId });
check("masadaki oyuncuya hediye", (await getDocs(collection(D.db, "users", D.uid, "gifts"))).size === 1);
const chat = (await getDocs(collection(D.db, "tables", room.tableId, "chat"))).docs.map((d) => d.data());
check("masada hediye görünür", chat.some((m) => m.kind === "gift" && m.id === `kahve:${D.uid}`));
check("geçersiz hediye", (await errCode(A.call("sendGift", { toUid: B.uid, giftId: "uzayGemisi" }))) === "badRequest");
// Aynı kişiye 24 saatte en fazla 3 hediye; farklı kişiye sınır yok
const E = await client("Ece"), F = await client("Fuat"), G = await client("Gaye");
for (const [x, y] of [[E, F], [F, E], [E, G], [G, E]]) await x.call("sendFriendRequest", { targetUid: y.uid });
for (let i = 0; i < 3; i++) await E.call("sendGift", { toUid: F.uid, giftId: "gul" });
check("aynı kişiye 4. hediye engellenir", (await errCode(E.call("sendGift", { toUid: F.uid, giftId: "gul" }))) === "giftLimit");
check("farklı kişiye hediye gönderilebilir", (await E.call("sendGift", { toUid: G.uid, giftId: "gul" })).ok === true);
console.log(ok ? "\nHEPSİ GEÇTİ" : "\nHATA VAR");
process.exit(ok ? 0 : 1);
