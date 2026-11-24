// Emülatör: Sosyete masası (giriş 100, birinciye 400)
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInAnonymously } from "firebase/auth";
import { connectFirestoreEmulator, doc, getDoc, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
const app = initializeApp({ projectId: "demo-cinali", apiKey: "demo-key" });
const auth = getAuth(app); connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
const db = getFirestore(app); connectFirestoreEmulator(db, "127.0.0.1", 8080);
const fns = getFunctions(app, "europe-west3"); connectFunctionsEmulator(fns, "127.0.0.1", 5001);
const { user } = await signInAnonymously(auth);
const call = (n, d) => httpsCallable(fns, n)(d).then((r) => r.data);
await call("bootstrap", { name: "Usta" });
const bal = async () => (await getDoc(doc(db, "wallets", user.uid))).data().balance;
const b0 = await bal();
await call("testSetStats", { played: 10, won: 9 }); // Sosyete şartı: başarı oranı en az %76
const j = await call("joinTable", { type: "usta", lang: "tr", name: "Usta" });
await call("startTable", { tableId: j.tableId });
const tb = (await getDoc(doc(db, "tables", j.tableId))).data();
const ok = tb.status === "playing" && tb.seats.length === 4 && (await bal()) === b0 - 100;
console.log(ok ? "✓ Sosyete masası: 100 giriş alındı, oyun başladı" : "✗ " + JSON.stringify({ b0, b: await bal(), st: tb.status }));
// VIP Oda tek masa: eski 250/500 seçeneklerine yeni oyun açılmaz, 100'lük VIP masa sohbetli
await call("testSubscribeVip");
await call("leaveTable", { tableId: j.tableId }).catch(() => {});
const old = await call("joinTable", { type: "vip2u", lang: "tr", name: "Usta" }).then(() => "açıldı", (e) => e.details?.code ?? e.code);
const b1 = await bal();
const v = await call("joinTable", { type: "vip2", lang: "tr", name: "Usta" });
const vt = (await getDoc(doc(db, "tables", v.tableId))).data();
await call("startTable", { tableId: v.tableId });
const txt = await call("sendText", { tableId: v.tableId, text: "selam", uiLang: "tr" });
const ok2 = old === "badRequest" && vt.type === "vip2" && (await bal()) === b1 - 100 && txt.ok === true;
console.log(ok2 ? "✓ VIP tek masa: eski 500'lük kapalı, 100 giriş alındı, sohbet açık" : "✗ VIP tek masa " + JSON.stringify({ old, b1, b: await bal(), type: vt.type, txt }));
process.exit(ok && ok2 ? 0 : 1);
