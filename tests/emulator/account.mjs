// Emülatöre karşı profil ayarları ve hesap silme testi: node tests/emulator/account.mjs
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
const owner = { Authorization: "Bearer owner" };
const exists = async (path) => (await fetch(`${BASE}/${path}`, { headers: owner })).status === 200;

const A = await client("Ali"), B = await client("Bea");
await A.call("sendFriendRequest", { targetUid: B.uid });
await B.call("sendFriendRequest", { targetUid: A.uid });
const pt = await A.call("createPrivateTable", { type: "caylak", lang: "tr", name: "Ali" });

// Oyun davetleri kapalı
await B.call("heartbeat", { name: "Bea", invites: false });
check("davetleri kapalı oyuncu davet edilemez", (await errCode(A.call("inviteFriend", { tableId: pt.tableId, friendUid: B.uid }))) === "invitesOff");
await B.call("heartbeat", { name: "Bea", invites: true });
check("davetler açılınca davet gider", (await A.call("inviteFriend", { tableId: pt.tableId, friendUid: B.uid })).ok === true);
check("davet Bea'nın listesinde", (await B.call("friendsStatus")).invites.length === 1);

// Masadayken hesap silinemez
check("masadayken silinemez", (await errCode(A.call("deleteAccount"))) === "leaveTableFirst");
await A.call("leaveTable", { tableId: pt.tableId });

// Hesap silme
check("kumbara ve kullanıcı var", (await exists(`wallets/${A.uid}`)) && (await exists(`users/${A.uid}`)));
check("hesap silindi", (await A.call("deleteAccount")).ok === true);
check("kullanıcı belgesi silindi", !(await exists(`users/${A.uid}`)));
check("kumbara silindi", !(await exists(`wallets/${A.uid}`)));
check("arkadaşlık alt koleksiyonu silindi", !(await exists(`users/${A.uid}/friends/${B.uid}`)));
check("Bea'nın listesinden çıktı", (await B.call("friendsStatus")).friends.every((f) => f.uid !== A.uid));
check("silme kaydı tutuldu", await exists(`deletedAccounts/${A.uid}`));
// Yaş kapısı: 18 yaşından küçük beyanı VIP Oda'yı kapatır
const K = await client("Genç");
await K.call("heartbeat", { name: "Genç", adult: false });
check("18 yaş altı VIP masaya oturamaz", (await errCode(K.call("joinTable", { type: "vip2", lang: "tr", name: "Genç" }))) === "vipAdultOnly");
console.log(ok ? "\nHEPSİ GEÇTİ" : "\nHATA VAR");
process.exit(ok ? 0 : 1);
