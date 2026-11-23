// Emülatöre karşı yönetici paneli testi: node tests/emulator/admin.mjs
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

const BASE = "http://127.0.0.1:8080/v1/projects/demo-cinali/databases/(default)/documents";
const owner = { Authorization: "Bearer owner", "Content-Type": "application/json" };
const put = (path, fields) => fetch(`${BASE}/${path}`, { method: "PATCH", headers: owner, body: JSON.stringify({ fields }) }).then((r) => r.json());
const get = (path) => fetch(`${BASE}/${path}`, { headers: owner }).then((r) => r.json());

const Y = await client("Yönetici"), K = await client("Kötü"), N = await client("Normal");
const now = new Date().toISOString();
check("yönetici değilken kimliğini görür", (await Y.call("adminWhoAmI")).admin === false);
check("yönetici olmayan paneli açamaz", (await errCode(Y.call("adminOverview"))) === "adminOnly");
check("oyuncu engelleyemez", (await errCode(N.call("adminSetBan", { uid: K.uid, banned: true }))) === "adminOnly");

// Konsoldan yönetici tanımlama: config/admins.uids
await put("config/admins", { uids: { arrayValue: { values: [{ stringValue: Y.uid }] } } });
check("yönetici tanındı", (await Y.call("adminWhoAmI")).admin === true);

// Örnek ihlal ve sohbet kaydı (sunucunun yazdığı biçimde)
await put("moderation/m1", { uid: { stringValue: K.uid }, name: { stringValue: "Kötü" }, text: { stringValue: "k0kain var" }, category: { stringValue: "drugs" },
  strikes: { integerValue: "1" }, tableId: { stringValue: "t1" }, ip: { stringValue: "1.2.3.4" }, status: { stringValue: "open" }, at: { timestampValue: now } });
await put("chatLogs/c1", { uid: { stringValue: K.uid }, name: { stringValue: "Kötü" }, text: { stringValue: "selam" }, tableId: { stringValue: "t1" },
  tableType: { stringValue: "vip2" }, ip: { stringValue: "1.2.3.4" }, at: { timestampValue: now } });
await put(`users/${K.uid}`, { name: { stringValue: "Kötü" }, modStrikes: { integerValue: "4" }, modReview: { booleanValue: true } });

const ov = await Y.call("adminOverview");
check("ihlal listede", ov.moderation.some((m) => m.id === "m1" && m.category === "drugs" && m.ip === "1.2.3.4"), JSON.stringify(ov.moderation));
check("incelemedeki hesap listede", ov.review.some((u) => u.uid === K.uid && u.strikes === 4));
const log = await Y.call("adminChatLog", { uid: K.uid });
check("sohbet kaydı okunur", log.messages.length === 1 && log.messages[0].text === "selam", JSON.stringify(log));

// Engelle: masa, hediye ve arkadaşlık kapanır
check("engellendi", (await Y.call("adminSetBan", { uid: K.uid, banned: true, reason: "uyuşturucu" })).ok === true);
check("engelli masaya oturamaz", (await errCode(K.call("joinTable", { type: "caylak", lang: "tr", name: "Kötü" }))) === "accountBanned");
check("engelli arkadaş isteği gönderemez", (await errCode(K.call("sendFriendRequest", { targetUid: N.uid }))) === "accountBanned");
const ov2 = await Y.call("adminOverview");
check("engelliler listesinde", ov2.banned.some((u) => u.uid === K.uid && u.banReason === "uyuşturucu") && !ov2.review.some((u) => u.uid === K.uid));
check("yönetici kendini engelleyemez", (await errCode(Y.call("adminSetBan", { uid: Y.uid, banned: true }))) === "badRequest");

// İncelendi olarak kapat
await Y.call("adminResolve", { kind: "moderation", id: "m1" });
check("ihlal kapandı", !(await Y.call("adminOverview")).moderation.some((m) => m.id === "m1"));

// Engeli kaldır: sayaç sıfırlanır, masaya oturabilir
await Y.call("adminSetBan", { uid: K.uid, banned: false });
const ku = (await get(`users/${K.uid}`)).fields;
check("engel kalktı, sayaç sıfır", ku.banned.booleanValue === false && Number(ku.modStrikes.integerValue) === 0);
check("tekrar masaya oturabilir", !!(await K.call("joinTable", { type: "caylak", lang: "tr", name: "Kötü" })).tableId);
check("istemci config/admins okuyamaz", (await getDoc(doc(N.db, "config", "admins")).then(() => "EVET", (e) => e.code)) === "permission-denied");
check("işlem günlüğü tutuldu", ((await get("adminLog")).documents ?? []).length === 2);

console.log(ok ? "\nHEPSİ GEÇTİ" : "\nHATA VAR");
process.exit(ok ? 0 : 1);
