// Emülatöre karşı cüzdan testi: node tests/emulator/wallet.mjs
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInAnonymously } from "firebase/auth";
import { connectFirestoreEmulator, doc, getDoc, getFirestore, setDoc } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";

const app = initializeApp({ projectId: "demo-cinali", apiKey: "demo-key", authDomain: "demo-cinali.firebaseapp.com" });
const auth = getAuth(app);
connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
const db = getFirestore(app);
connectFirestoreEmulator(db, "127.0.0.1", 8080);
const fns = getFunctions(app, "europe-west3");
connectFunctionsEmulator(fns, "127.0.0.1", 5001);
const call = (n, d) => httpsCallable(fns, n)(d).then((r) => r.data);
const err = (p) => p.then(() => "BEKLENMEDİK BAŞARI", (e) => `${e.code} ${e.details?.code}`);

const { user } = await signInAnonymously(auth);
console.log("giriş:", user.uid.slice(0, 6), "anonim:", user.isAnonymous);
console.log("bootstrap:", await call("bootstrap", { name: "Test" }));
console.log("bootstrap tekrar (çift hoş geldin yok):", await call("bootstrap", {}));
console.log("günlük:", await call("claimDaily"));
console.log("günlük tekrar:", await err(call("claimDaily")));
for (let i = 0; i < 5; i++) await call("rewardAd");
console.log("6. reklam:", await err(call("rewardAd")));
console.log("test satın alma:", await call("testPurchase", { chips: 5000, productId: "wordokey_cip_5k" }));
console.log("geçersiz paket:", await err(call("testPurchase", { chips: 999999 })));
const w = (await getDoc(doc(db, "wallets", user.uid))).data();
console.log("cüzdan okuma (kendi):", w.balance);
console.log("cüzdana yazma (yasak olmalı):", await setDoc(doc(db, "wallets", user.uid), { balance: 1e9 }).then(() => "YAZILDI!", (e) => e.code));
console.log("başkasının cüzdanı (yasak olmalı):", await getDoc(doc(db, "wallets", "baskasi")).then(() => "OKUNDU!", (e) => e.code));
process.exit(0);
