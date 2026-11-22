// Sohbet güvenlik kuralları testi: node tests/emulator/chat.mjs
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
const A = await client("chatA");
const C = await client("chatC");
const { tableId } = await A.call("joinTable", { type: "caylak", lang: "en", name: "A" });
const chat = (c) => collection(c.db, "tables", tableId, "chat");
const tryAdd = (c, data) => addDoc(chat(c), data).then(() => "izin verildi", (e) => e.code);

console.log("geçerli mesaj:", await tryAdd(A, { uid: A.uid, kind: "msg", id: "hello", at: serverTimestamp() }));
console.log("geçerli emoji:", await tryAdd(A, { uid: A.uid, kind: "emoji", id: "🔥", at: serverTimestamp() }));
console.log("serbest metin:", await tryAdd(A, { uid: A.uid, kind: "msg", id: "kötü söz", at: serverTimestamp() }));
console.log("izinsiz emoji:", await tryAdd(A, { uid: A.uid, kind: "emoji", id: "🖕", at: serverTimestamp() }));
console.log("ek alan:", await tryAdd(A, { uid: A.uid, kind: "msg", id: "hello", at: serverTimestamp(), text: "x" }));
console.log("başkası adına:", await tryAdd(A, { uid: C.uid, kind: "msg", id: "hello", at: serverTimestamp() }));
console.log("sahte zaman:", await tryAdd(A, { uid: A.uid, kind: "msg", id: "hello", at: new Date(0) }));
console.log("masada olmayan yazar:", await tryAdd(C, { uid: C.uid, kind: "msg", id: "hello", at: serverTimestamp() }));
console.log("masada olmayan okur:", await getDocs(chat(C)).then(() => "izin verildi", (e) => e.code));
process.exit(0);
