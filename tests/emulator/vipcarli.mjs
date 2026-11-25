// Emülatöre karşı VIP Oda eşleşme sırası: ekli arkadaş → VIP → Fifty Cent → Sosyete (oran %76+) → Çarli → Çayhane
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

{
  // Başarı oranı %76'nın altındaki VIP oyuncu Sosyete oyuncusuyla eşleşmez; sıradaki Çarli'ye geçer
  const S = await client("Selin"), R = await client("Rüştü");
  await R.call("testSetStats", { played: 10, won: 5 });
  const V = await client("Veli");
  await V.call("testSubscribeVip");
  await V.call("testSetStats", { played: 10, won: 5 }); // %50
  const sj = await S.call("joinTable", { type: "usta", lang: "it", name: "Selin" });
  const rj = await R.call("joinTable", { type: "carli", lang: "it", name: "Rüştü" });
  const vj = await V.call("joinTable", { type, lang: "it", name: "Veli" });
  const st = await tbl(S, sj.tableId);
  check("%76 altı VIP (%50) Sosyete oyuncusuyla eşleşmez, Çarli'deki oyuncuya geçer", vj.tableId === rj.tableId && st.type === "usta" && st.seats.length === 1, `VIP → ${vj.tableId === rj.tableId ? "Çarli" : vj.tableId === sj.tableId ? "Sosyete" : "yeni masa"}`);
  // %76 ve üstü VIP Sosyete oyuncusuyla eşleşir
  const V2 = await client("Vildan");
  await V2.call("testSubscribeVip");
  await V2.call("testSetStats", { played: 100, won: 76 }); // tam %76
  const v2 = await V2.call("joinTable", { type, lang: "it", name: "Vildan" });
  check("%76 VIP Sosyete oyuncusuyla eşleşir", v2.tableId === sj.tableId, `VIP → ${v2.tableId === sj.tableId ? "Sosyete" : "başka"}`);
}
{
  // Arkadaş önceliği: VIP oyuncu, ekli arkadaşı Çayhane'de bekliyorsa Fifty Cent'teki yabancı yerine onunla eşleşir
  const F = await client("Fadime"), O = await client("Orhan");
  await F.call("testSetStats", { played: 10, won: 5 });
  const V = await client("Vural");
  await V.call("testSubscribeVip");
  check("Vural, Fadime'yi arkadaş listesine ekler", (await V.call("sendFriendRequest", { targetUid: F.uid })).status === "friends");
  const oj = await O.call("joinTable", { type: "ozel2", lang: "es", name: "Orhan" });
  const fj = await F.call("joinTable", { type: "caylak", lang: "es", name: "Fadime" });
  const vj = await V.call("joinTable", { type, lang: "es", name: "Vural" });
  const ft = await tbl(F, fj.tableId), ot = await tbl(O, oj.tableId);
  check("ekli arkadaş önce: Çayhane'deki arkadaşla eşleşir, Fifty Cent'teki yabancı beklemeye devam eder", vj.tableId === fj.tableId && ft.type === "vip2" && ft.status === "playing" && ot.type === "ozel2" && ot.seats.length === 1, `VIP → ${vj.tableId === fj.tableId ? "arkadaş" : vj.tableId === oj.tableId ? "Fifty Cent" : "yeni masa"}`);
  // Arkadaşı olmayan VIP için sıra değişmez: Fifty Cent önce
  const V2 = await client("Vesile");
  await V2.call("testSubscribeVip");
  check("arkadaşı beklemeyen VIP için sıra aynı: Fifty Cent", (await V2.call("joinTable", { type, lang: "es", name: "Vesile" })).tableId === oj.tableId);
}

console.log(ok ? "\nHEPSİ GEÇTİ" : "\nHATA VAR");
process.exit(ok ? 0 : 1);
