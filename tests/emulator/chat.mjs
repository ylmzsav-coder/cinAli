// Sohbet testi: oyuncular arası sohbet yalnızca VIP odada, filtresiz. node tests/emulator/chat.mjs
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInAnonymously } from "firebase/auth";
import { addDoc, collection, connectFirestoreEmulator, getDocs, getFirestore, serverTimestamp } from "firebase/firestore";
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
  await call("bootstrap", {});
  return { uid: user.uid, db, call };
}
const errCode = (p) => p.then(() => "izin verildi", (e) => e.details?.code ?? e.code);
let ok = true;
const check = (l, c, x = "") => { console.log(`${c ? "✓" : "✗"} ${l}${x ? " — " + x : ""}`); if (!c) ok = false; };

// Çaylak masası: sohbet yok
const A = await client("chatA"), B = await client("chatB"), C = await client("chatC");
const caylak = (await A.call("joinTable", { type: "caylak", lang: "en", name: "A" })).tableId;
const addTo = (c, id, data) => addDoc(collection(c.db, "tables", id, "chat"), data).then(() => "izin verildi", (e) => e.code);
check("Çaylak masada hazır mesaj gönderilir", (await addTo(A, caylak, { uid: A.uid, kind: "msg", id: "hello", at: serverTimestamp() })) === "izin verildi");
check("Çaylak masada emoji gönderilir", (await addTo(A, caylak, { uid: A.uid, kind: "emoji", id: "👍", at: serverTimestamp() })) === "izin verildi");
check("Çaylak masada serbest metin yazılamaz (kural)", (await addTo(A, caylak, { uid: A.uid, kind: "text", id: "", text: "selam", at: serverTimestamp() })) === "permission-denied");
check("Çaylak masada yazışma yok", (await errCode(A.call("sendText", { tableId: caylak, text: "selam", uiLang: "tr" }))) === "chatVipOnly");
await A.call("leaveTable", { tableId: caylak });

// VIP oda: serbest ve filtresiz
await A.call("testSubscribeVip"); await B.call("testSubscribeVip");
const vip = (await A.call("joinTable", { type: "vip2", lang: "tr", name: "A", gender: "erkek", want: "kadin" })).tableId;
await B.call("joinTable", { type: "vip2", lang: "tr", name: "B", gender: "kadin", want: "erkek" });
check("VIP odada hazır mesaj", (await addTo(A, vip, { uid: A.uid, kind: "msg", id: "hello", at: serverTimestamp() })) === "izin verildi");
check("VIP odada emoji", (await addTo(B, vip, { uid: B.uid, kind: "emoji", id: "🔥", at: serverTimestamp() })) === "izin verildi");
const r1 = await A.call("sendText", { tableId: vip, text: "lan bu ne biçim hamle, salak", uiLang: "tr" });
check("VIP odada hakaret serbest (küfür değil)", r1.ok === true, JSON.stringify(r1));
await new Promise((r) => setTimeout(r, 2100));
await new Promise((r) => setTimeout(r, 1600));
const r2 = await A.call("sendText", { tableId: vip, text: "iyi oyunlar", uiLang: "tr" });
check("VIP odada ikinci mesaj", r2.ok === true);
await new Promise((r) => setTimeout(r, 1600));
check("VIP odada bağlantı engellenir (iletişim)", (await errCode(A.call("sendText", { tableId: vip, text: "bak: https://ornek.com", uiLang: "tr" }))) === "illegalContent");
const texts = (await getDocs(collection(B.db, "tables", vip, "chat"))).docs.map((d) => d.data()).filter((x) => x.kind === "text").map((x) => x.text);
check("rakip mesajları okuyabilir", texts.length === 2, texts.join(" | "));
check("başkası adına yazılamaz", (await addTo(A, vip, { uid: B.uid, kind: "msg", id: "hello", at: serverTimestamp() })) === "permission-denied");
check("masada olmayan yazamaz", (await addTo(C, vip, { uid: C.uid, kind: "msg", id: "hello", at: serverTimestamp() })) === "permission-denied");
check("masada olmayan okuyamaz", (await getDocs(collection(C.db, "tables", vip, "chat")).then(() => "izin verildi", (e) => e.code)) === "permission-denied");
console.log(ok ? "\nHEPSİ GEÇTİ" : "\nHATA VAR");
process.exit(ok ? 0 : 1);
