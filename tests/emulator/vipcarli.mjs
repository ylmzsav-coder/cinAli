// Emülatöre karşı VIP Oda eşleşme sırasında Çarli: Fifty Cent → Sosyete → Çarli → Çayhane
// (yalnızca giriş 100 olan masalarda tek başına bekleyen oyuncuyla). Temiz emülatörde çalışır.
// node tests/emulator/vipcarli.mjs
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
  await call("testSetStats", { played: 10, won: 9 }); // Teke Tek (%50) ve Sosyete (%76) giriş şartı
  const wallet = async () => (await getDoc(doc(db, "wallets", user.uid))).data();
  return { uid: user.uid, db, call, wallet };
}
const errCode = (p) => p.then(() => "BAŞARI", (e) => e.details?.code ?? e.code);
let ok = true;
const check = (l, c, x = "") => { console.log(`${c ? "✓" : "✗"} ${l}${x ? " — " + x : ""}`); if (!c) ok = false; };
const type = "vip2";
const tbl = async (c, id) => (await getDoc(doc(c.db, "tables", id))).data();
{
  // Çarli: Fifty Cent ve Sosyete boşsa VIP, Çarli'de (giriş 100) bekleyen oyuncuyla eşleşir;
  // Çarli 200/300 oyuncusu alınmaz, masası bozulmaz
  const R1 = await client("Rana"), H2 = await client("Hilmi"), V3 = await client("Vedia");
  for (const c of [R1, H2]) await c.call("testSetStats", { played: 10, won: 5 });
  await V3.call("testSubscribeVip");
  const r0 = (await R1.wallet()).balance, h0 = (await H2.wallet()).balance;
  const hj = await H2.call("joinTable", { type: "carli2", lang: "de", name: "Hilmi" });
  const rj = await R1.call("joinTable", { type: "carli", lang: "de", name: "Rana" });
  const vj = await V3.call("joinTable", { type, lang: "de", name: "Vedia" });
  const rt = await tbl(R1, rj.tableId), ht = await tbl(H2, hj.tableId);
  check("Fifty Cent ve Sosyete boşsa VIP, Çarli'de (giriş 100) bekleyen oyuncuyla eşleşir", vj.tableId === rj.tableId && rt.type === "vip2" && rt.status === "playing" && rt.seats.length === 2 && rt.seats.every((x) => !x.bot), `${rt.type} · ${rt.seats.map((x) => x.name).join(" vs ")}`);
  check("Çarli 200 oyuncusu VIP ile eşleşmez, masası bozulmaz", vj.tableId !== hj.tableId && ht.type === "carli2" && ht.seats.length === 1);
  check("Çarli oyuncusundan fazladan çip alınmaz (giriş 100 = VIP 100), Çarli 200 oyuncusunun çipi yalnız kendi girişi", (await R1.wallet()).balance === r0 - 100 && (await H2.wallet()).balance === h0 - 200);
  check("Çarli'den gelen oyuncu (abonesiz) VIP odada sohbet edebilir", (await R1.call("sendText", { tableId: rj.tableId, text: "merhaba", uiLang: "tr" })).ok === true);
}
{
  // Tam sıra: Fifty Cent → Sosyete → Çarli → Çayhane
  const O = await client("Oya"), S = await client("Sami"), R = await client("Rıfat"), C = await client("Cansel");
  for (const c of [O, S, R]) await c.call("testSetStats", { played: 10, won: 9 });
  const V = [await client("Vahit"), await client("Vasfiye"), await client("Vedat"), await client("Vicdan")];
  for (const v of V) await v.call("testSubscribeVip");
  const cj = await C.call("joinTable", { type: "caylak", lang: "pt", name: "Cansel" });
  const rj = await R.call("joinTable", { type: "carli", lang: "pt", name: "Rıfat" });
  const sj = await S.call("joinTable", { type: "usta", lang: "pt", name: "Sami" });
  const oj = await O.call("joinTable", { type: "ozel2", lang: "pt", name: "Oya" });
  const got = [];
  for (const v of V) got.push((await v.call("joinTable", { type, lang: "pt", name: "V" })).tableId);
  check("öncelik sırası: Fifty Cent → Sosyete → Çarli → Çayhane", got[0] === oj.tableId && got[1] === sj.tableId && got[2] === rj.tableId && got[3] === cj.tableId, JSON.stringify(got.map((g) => [oj, sj, rj, cj].findIndex((x) => x.tableId === g))));
}

console.log(ok ? "\nHEPSİ GEÇTİ" : "\nHATA VAR");
process.exit(ok ? 0 : 1);
