// Emülatöre karşı Sosyete giriş şartı (başarı oranı %76) ve sunucuda tutulan oyun sayıları:
// node tests/emulator/rate.mjs
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInAnonymously } from "firebase/auth";
import { connectFirestoreEmulator, doc, getDoc, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
let ok = true;
const check = (l, c, x = "") => { console.log(`${c ? "✓" : "✗"} ${l}${x ? " — " + x : ""}`); if (!c) ok = false; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function client(name) {
  const app = initializeApp({ projectId: "demo-cinali", apiKey: "demo-key" }, name);
  const auth = getAuth(app); connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  const db = getFirestore(app); connectFirestoreEmulator(db, "127.0.0.1", 8080);
  const fns = getFunctions(app, "europe-west3"); connectFunctionsEmulator(fns, "127.0.0.1", 5001);
  const { user } = await signInAnonymously(auth);
  const call = (n, d) => httpsCallable(fns, n)(d).then((r) => r.data);
  await call("bootstrap", { name });
  const balance = async () => (await getDoc(doc(db, "wallets", user.uid))).data().balance;
  const counts = async () => { const d = (await getDoc(doc(db, "users", user.uid))).data() ?? {}; return [d.gamesPlayed ?? 0, d.gamesWon ?? 0]; };
  return { uid: user.uid, db, call, balance, counts };
}
const err = (p) => p.then(() => ({ code: "BAŞARI" }), (e) => ({ code: e.details?.code ?? e.code, params: e.details?.params ?? {} }));
const lang = "tr";

// 1) Yeni oyuncu (hiç oyun yok, %0): Sosyete'ye oturamaz, Çayhane serbest
const N = await client("Nihat");
const b0 = await N.balance();
const e0 = await err(N.call("joinTable", { type: "usta", lang, name: "Nihat" }));
check("yeni oyuncu (%0) Sosyete'ye oturamaz: rateTooLow", e0.code === "rateTooLow" && e0.params.need === 76 && e0.params.rate === 0, JSON.stringify(e0));
check("reddedilince çip kesilmez", (await N.balance()) === b0);

// 2) %75 (4 oyunda 3): üç Sosyete masasının hiçbirine oturamaz
const L = await client("Leyla");
await L.call("testPurchase", { chips: 15000, productId: "wordokey_cip_15k" });
await L.call("testSetStats", { played: 4, won: 3 });
for (const type of ["usta", "usta2", "usta5"]) {
  const e = await err(L.call("joinTable", { type, lang, name: "Leyla" }));
  check(`%75 oyuncu ${type} masasına oturamaz`, e.code === "rateTooLow" && e.params.rate === 75 && e.params.played === 4 && e.params.won === 3, JSON.stringify(e));
}

// 3) %76 (25 oyunda 19): oturur, giriş alınır
const H = await client("Hande");
await H.call("testSetStats", { played: 25, won: 19 });
const hb = await H.balance();
const hj = await H.call("joinTable", { type: "usta", lang, name: "Hande" });
check("%76 oyuncu Sosyete'ye oturur, 100 giriş alınır", !!hj.tableId && (await H.balance()) === hb - 100);
await H.call("leaveTable", { tableId: hj.tableId }); // başlamamış masadan kalkınca iade, oyun sayılmaz
check("başlamamış masadan kalkmak oyun sayılmaz", JSON.stringify(await H.counts()) === "[25,19]", JSON.stringify(await H.counts()));

// 4) Oyun sürerken masadan kalkan yenilmiş sayılır: 25/19 → 26/19 (%73) → Sosyete kapanır
const cj = await H.call("joinTable", { type: "caylak", lang, name: "Hande" });
await H.call("startTable", { tableId: cj.tableId });
await H.call("leaveTable", { tableId: cj.tableId });
check("oyun sürerken kalkmak yenilgi sayılır (26 oyun, 19 galibiyet)", JSON.stringify(await H.counts()) === "[26,19]", JSON.stringify(await H.counts()));
const e4 = await err(H.call("joinTable", { type: "usta", lang, name: "Hande" }));
check("oranı %73'e düşen oyuncu artık Sosyete'ye oturamaz", e4.code === "rateTooLow" && e4.params.rate === 73, JSON.stringify(e4));

// 5) Oyun sonu sunucuda sayılır: bitiren kazanır, diğerleri kaybeder; kimse bitiremezse sayılmaz
const P = await client("Pınar");
const [p0, w0] = await P.counts();
const pj = await P.call("joinTable", { type: "caylak", lang, name: "Pınar" });
await P.call("startTable", { tableId: pj.tableId });
for (let k = 0; k < 400; k++) {
  const t = (await getDoc(doc(P.db, "tables", pj.tableId))).data();
  if (t.status !== "playing") break;
  const view = JSON.parse(t.view);
  if (t.seats[view.current]?.uid !== P.uid) { await sleep(50); continue; }
  if (view.phase === "draw") await P.call("act", { tableId: pj.tableId, action: { type: "drawDeck" } });
  const hand = (await getDoc(doc(P.db, "tables", pj.tableId, "hands", P.uid))).data();
  const tile = hand.rack.find((x) => x.letter !== null) ?? hand.rack[0];
  await P.call("act", { tableId: pj.tableId, action: { type: "discard", tileId: tile.id } });
}
const end = (await getDoc(doc(P.db, "tables", pj.tableId))).data();
const v = JSON.parse(end.view);
const [p1, w1] = await P.counts();
const reason = v.lastResult?.reason, winner = v.lastResult?.winner;
const expect = reason === "deckEmpty" ? [p0, w0] : winner === 0 ? [p0 + 1, w0 + 1] : [p0 + 1, w0];
check("oyun sonu sunucuda doğru sayılır", end.status === "finished" && p1 === expect[0] && w1 === expect[1], `bitiş ${reason}, bitiren ${winner}, sayılar ${p0}/${w0} → ${p1}/${w1}`);

// 6) Oyuncu kendi sayılarını değiştiremez (yalnızca sunucu yazar)
const { setDoc } = await import("firebase/firestore");
const w = await setDoc(doc(L.db, "users", L.uid), { gamesPlayed: 1, gamesWon: 1 }, { merge: true }).then(() => "YAZILDI!", (e) => e.code);
check("oyuncu başarı sayılarını kendisi yazamaz", w === "permission-denied", w);

// 7) Sosyete sohbetli masa: %76+ oyuncular ücretsiz yazışır (VIP gerekmez), küfür filtresi uygulanır
{
  const S = await client("Selim"), T = await client("Tuba");
  for (const c of [S, T]) { await c.call("testSetStats", { played: 10, won: 9 }); await c.call("heartbeat", { name: "x", adult: true }); }
  const sj = await S.call("joinTable", { type: "usta", lang: "it", name: "Selim" });
  const tj = await T.call("joinTable", { type: "usta", lang: "it", name: "Tuba" });
  await S.call("startTable", { tableId: sj.tableId });
  const w = (await getDoc(doc(S.db, "wallets", S.uid))).data();
  check("Sosyete'deki iki oyuncu aynı masada, VIP değiller", sj.tableId === tj.tableId && !(w.vipUntil > Date.now()));
  const r1 = await S.call("sendText", { tableId: sj.tableId, text: "merhaba, iyi oyunlar", uiLang: "tr" });
  check("Sosyete'de VIP olmadan serbest yazışma", r1.ok === true, JSON.stringify(r1));
  const r2 = await T.call("sendText", { tableId: sj.tableId, text: "siktir git", uiLang: "tr" });
  check("Sosyete'de küfür filtresi: mesaj gönderilmez", r2.ok === false && r2.blocked === true, JSON.stringify(r2));
  const r3 = await err(T.call("sendText", { tableId: sj.tableId, text: "ot satıyorum, ucuz esrar", uiLang: "tr" }));
  check("Sosyete'de yasa dışı içerik engellenir", r3.code !== "BAŞARI", JSON.stringify(r3));
  // 18 yaş altı oyuncu Sosyete'de oynar ama yazamaz
  const K = await client("Kaan");
  await K.call("testSetStats", { played: 10, won: 9 }); await K.call("heartbeat", { name: "Kaan", adult: false });
  const kj = await K.call("joinTable", { type: "usta", lang: "pt", name: "Kaan" });
  await K.call("startTable", { tableId: kj.tableId });
  const r4 = await err(K.call("sendText", { tableId: kj.tableId, text: "merhaba", uiLang: "tr" }));
  check("18 yaş altı Sosyete'de oynar ama yazamaz", !!kj.tableId && r4.code === "vipAdultOnly", JSON.stringify(r4));
  // Çayhane ve Teke Tek'te serbest yazışma yok
  for (const type of ["caylak", "ozel2"]) {
    // Sosyete oyuncusu (%90) Teke Tek ve Çayhane'de de yazışamaz
    const C = await client("Cem" + type);
    await C.call("heartbeat", { name: "Cem", adult: true });
    await C.call("testSetStats", { played: 10, won: 9 });
    const cj = await C.call("joinTable", { type, lang: "fr", name: "Cem" });
    await C.call("startTable", { tableId: cj.tableId });
    const r = await err(C.call("sendText", { tableId: cj.tableId, text: "merhaba", uiLang: "tr" }));
    check(`Sosyete oyuncusu (%90) ${type === "caylak" ? "Çayhane'de" : "Teke Tek'te"} yazışamaz (sohbet yok)`, r.code === "chatVipOnly", JSON.stringify(r));
  }
}
// 8) Teke Tek giriş şartı: başarı oranı en az %50 (açık masa, özel masa kurma ve davetle katılma)
{
  const Y = await client("Yeni");
  const ey = await err(Y.call("joinTable", { type: "ozel2", lang, name: "Yeni" }));
  check("yeni oyuncu (%0) Teke Tek'e oturamaz: rateTooLowOzel", ey.code === "rateTooLowOzel" && ey.params.need === 50 && ey.params.rate === 0, JSON.stringify(ey));
  const D = await client("Derya");
  await D.call("testPurchase", { chips: 5000, productId: "wordokey_cip_5k" });
  await D.call("testSetStats", { played: 100, won: 49 });
  for (const type of ["ozel2", "ozel2u", "ozel2b"]) {
    const e = await err(D.call("joinTable", { type, lang, name: "Derya" }));
    check(`%49 oyuncu ${type} masasına oturamaz`, e.code === "rateTooLowOzel" && e.params.rate === 49, JSON.stringify(e));
  }
  const ep = await err(D.call("createPrivateTable", { type: "ozel2", lang, name: "Derya" }));
  check("%49 oyuncu Teke Tek özel masası (arkadaşla) kuramaz", ep.code === "rateTooLowOzel", JSON.stringify(ep));
  const cj = await D.call("joinTable", { type: "caylak", lang: "de", name: "Derya" });
  check("%49 oyuncu Çayhane'ye oturabilir", !!cj.tableId);
  await D.call("leaveTable", { tableId: cj.tableId });
  // Davetle katılma: %50 kurar, %49 davetli katılamaz
  const E = await client("Ece");
  await E.call("testSetStats", { played: 2, won: 1 });
  const pt = await E.call("createPrivateTable", { type: "ozel2", lang, name: "Ece" });
  check("%50 oyuncu Teke Tek özel masası kurabilir", !!pt.code, JSON.stringify(pt));
  const ej = await err(D.call("joinPrivateTable", { code: pt.code, name: "Derya" }));
  check("%49 oyuncu davet koduyla da Teke Tek'e katılamaz", ej.code === "rateTooLowOzel", JSON.stringify(ej));
  const F = await client("Fatih");
  await F.call("testSetStats", { played: 2, won: 1 });
  const fb = await F.balance();
  const fj = await F.call("joinTable", { type: "ozel2", lang: "es", name: "Fatih" });
  check("%50 oyuncu Teke Tek'e oturur, 100 giriş alınır", !!fj.tableId && (await F.balance()) === fb - 100);
}
console.log(ok ? "\nHEPSİ GEÇTİ" : "\nHATA VAR");
process.exit(ok ? 0 : 1);
