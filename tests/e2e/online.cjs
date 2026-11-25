/**
 * Çevrimiçi oyun uçtan uca testi: iki gerçek tarayıcı, sunucu (Firebase emülatörü) üzerinden
 * aynı masada oynar. Çevrimiçi sürüm VITE_FIREBASE_EMULATOR=1 ile derlenir:
 *   VITE_FIREBASE_EMULATOR=1 npx vite build --outDir dist-online
 *   npx vite preview --outDir dist-online --host 127.0.0.1 --port 4174 &
 *   npx firebase emulators:exec --project demo-cinali --only auth,firestore,functions "node tests/e2e/online.cjs"
 * Herhangi bir denetim başarısız olursa çıkış kodu 1 olur.
 */
const { chromium, devices } = require("playwright");
const BASE = process.env.E2E_ONLINE_URL || "http://127.0.0.1:4174/";
let fails = 0;
const check = (label, ok, extra = "") => {
  console.log(`${ok ? "✓" : "✗"} ${label}${extra ? " — " + extra : ""}`);
  if (!ok) fails++;
};
const W = (p, ms) => p.waitForTimeout(ms);
/** Koşul sağlanana kadar bekler (en çok ms). */
async function until(fn, ms = 15000, step = 250) {
  const end = Date.now() + ms;
  for (;;) {
    try { if (await fn()) return true; } catch { /* sayfa yenileniyor */ }
    if (Date.now() > end) return false;
    await new Promise((r) => setTimeout(r, step));
  }
}

async function player(browser, name) {
  const ctx = await browser.newContext({ ...devices["Pixel 7 landscape"] });
  const p = await ctx.newPage();
  p.setDefaultTimeout(15000);
  p.errors = [];
  p.on("pageerror", (e) => p.errors.push(e.message));
  await p.goto(BASE);
  await p.evaluate((name) => {
    localStorage.clear();
    localStorage.setItem("wordokey.account", '{"method":"guest"}');
    localStorage.setItem("wordokey.birthYear", "1980");
    localStorage.setItem("wordokey.welcomeSeen", "1");
    localStorage.setItem("cinali.settings", JSON.stringify({ name, uiLang: "tr", gameLang: "tr", music: false, sound: false, vibration: false }));
  }, name);
  await p.reload();
  await W(p, 800);
  if (await p.locator(".splash-hit").count()) await p.locator(".splash-hit").tap();
  // Sunucudan kumbara gelir (hoş geldin hediyesi 999)
  await until(async () => /\d/.test(await p.locator(".kumbara-balance").innerText()), 20000);
  const welcome = p.locator(".modal .primary").first();
  if (await welcome.count()) await welcome.tap().catch(() => {});
  return p;
}
const kumbara = async (p) => Number((await p.locator(".kumbara-balance").innerText()).replace(/\D/g, ""));
const deckCount = async (p) => Number((await p.locator(".deck-count").innerText()).replace(/\D/g, ""));
/** Sıra bu oyuncuda mı: süre sayacı (⏱) yalnızca sıra sendeyken görünür. */
const myTurn = async (p) => (await p.locator(".timer-badge").count()) > 0;
const tilesOnRack = (p) => p.locator(".okey-rack .rack-slot .tile");

(async () => {
  const browser = await chromium.launch();
  console.log("\n== Çevrimiçi: iki oyuncu aynı Çayhane masasında (sunucu üzerinden)");
  const A = await player(browser, "Ali");
  const B = await player(browser, "Bea");
  const a0 = await kumbara(A), b0 = await kumbara(B);
  check("iki oyuncunun kumbarası sunucudan geldi (hoş geldin hediyesi)", a0 > 0 && b0 > 0, `${a0} / ${b0}`);

  // Ali oturur, bekleme masası açılır; Bea aynı masaya oturur
  await A.locator(".cayhane-hub").tap(); await W(A, 400);
  await A.locator(".cayhane-lobby .vip-stake button").nth(2).tap(); await A.locator(".cayhane-lobby .sosyete-sit").tap();
  await until(async () => (await A.locator(".waiting-seats").count()) > 0);
  await B.locator(".cayhane-hub").tap(); await W(B, 400);
  await B.locator(".cayhane-lobby .vip-stake button").nth(2).tap(); await B.locator(".cayhane-lobby .sosyete-sit").tap();
  const both = await until(async () => {
    const t = await A.locator(".waiting-seats").innerText();
    return t.includes("Ali") && t.includes("Bea");
  });
  check("Bea, Ali'nin bekleyen masasına oturdu (ikisi de bekleme ekranında birbirini görüyor)", both, (await A.locator(".waiting-seats").innerText().catch(() => "")).replace(/\n/g, " · "));

  // Hemen başla: boş koltuklara bilgisayar oturur
  await A.locator(".page.menu .primary.big").first().tap();
  const started = await until(async () => (await A.locator(".okey-rack").count()) > 0 && (await B.locator(".okey-rack").count()) > 0, 20000);
  check("oyun ikisinde de başladı", started);
  const opp = async (p) => (await p.locator(".opp .name-btn, .topbar-center .name-btn").allInnerTexts()).join(" ");
  check("Ali rakiplerinde Bea'yı, Bea rakiplerinde Ali'yi görüyor", (await opp(A)).includes("Bea") && (await opp(B)).includes("Ali"), `${await opp(A)} | ${await opp(B)}`);
  const rackA = await tilesOnRack(A).count(), rackB = await tilesOnRack(B).count();
  check("ıstakalarda 14-15 taş var ve rakibin taşları görünmüyor", rackA >= 14 && rackA <= 15 && rackB >= 14 && rackB <= 15, `${rackA} / ${rackB}`);

  // Sırayla oyna: sırası gelen desteden çeker ve bir taş atar; diğer ekran aynı anda güncellenir
  let moves = 0, synced = 0;
  for (let k = 0; k < 60 && moves < 6; k++) {
    const p = (await myTurn(A)) ? A : (await myTurn(B)) ? B : null;
    if (!p) { await W(A, 400); continue; }
    if (await p.locator("button.deck:not([disabled])").count()) {
      await p.locator("button.deck").tap();
      await until(async () => (await tilesOnRack(p).count()) >= 15, 8000);
    }
    await tilesOnRack(p).last().tap();
    await p.locator(".rack-discard").tap();
    moves++;
    const ok = await until(async () => (await deckCount(A)) === (await deckCount(B)), 10000);
    if (ok) synced++;
    await W(A, 500);
  }
  check(`insan hamleleri (${moves}) iki ekranda da aynı anda görünüyor (deste sayısı eşit)`, moves >= 4 && synced === moves, `${synced}/${moves}`);

  // Emoji balonu karşı tarafa ulaşır; Çayhane'de serbest yazı yok
  await A.locator(".chat-room-btn").first().tap();
  await W(A, 300);
  check("Çayhane'de serbest yazı kutusu yok (sohbet yalnızca VIP ve Sosyete'de)", (await A.locator(".chat-input").count()) === 0 && (await B.locator(".chat-input").count()) === 0);
  await A.locator(".chat-emojis button").first().tap();
  const bubble = await until(async () => (await B.locator(".bubble").count()) > 0, 8000);
  check("Ali'nin emojisi Bea'nın ekranında balon olarak çıktı", bubble);
  await A.keyboard.press("Escape").catch(() => {});

  // Sayfa yenilenince oyuna geri dönülür
  await B.reload();
  await W(B, 1000);
  if (await B.locator(".splash-hit").count()) await B.locator(".splash-hit").tap();
  const back = await until(async () => (await B.locator(".okey-rack").count()) > 0, 20000)
    || (await B.locator(".hub-right .primary.big").first().tap().then(() => until(async () => (await B.locator(".okey-rack").count()) > 0, 15000)).catch(() => false));
  check("Bea sayfayı yenileyince aynı oyuna geri döndü", back && (await deckCount(A)) === (await deckCount(B)), `deste ${await deckCount(A).catch(() => "?")} / ${await deckCount(B).catch(() => "?")}`);

  // Hamle süresi (60 sn) dolunca sunucu otomatik hamle yapar
  const idle = (await until(async () => (await myTurn(A)) || (await myTurn(B)), 30000)) ? ((await myTurn(A)) ? A : B) : null;
  if (idle) {
    const d0 = await deckCount(idle);
    const moved = await until(async () => !(await myTurn(idle)) || (await deckCount(idle)) < d0, 80000, 1000);
    check("hamle yapılmayınca 60 sn sonra sunucu sırayı ilerletti (otomatik çek-at)", moved);
  } else check("hamle süresi testi için sıra bir oyuncuya gelmedi", false);

  // Ali oyundan çıkar; Bea'nın oyunu sürer (Ali'nin yerine bilgisayar)
  await A.locator(".quit-btn").tap();
  await A.locator(".quit-modal .danger").first().tap().catch(() => {});
  await until(async () => (await A.locator(".kumbara-balance").count()) > 0, 15000);
  const dB = await deckCount(B);
  let goes = false;
  for (let k = 0; k < 40 && !goes; k++) {
    if (await myTurn(B)) {
      if (await B.locator("button.deck:not([disabled])").count()) await B.locator("button.deck").tap();
      await W(B, 400);
      await tilesOnRack(B).last().tap();
      await B.locator(".rack-discard").tap();
    }
    await W(B, 700);
    goes = (await deckCount(B)) <= dB - 3 || (await B.locator(".modal .winner").count()) > 0;
  }
  check("Ali çıkınca Bea'nın oyunu sürüyor (Ali'nin yerinde bilgisayar oynuyor)", goes);
  const a1 = await kumbara(A);
  check("Ali'nin kumbarasından 100 giriş düştü (sunucu)", a1 === a0 - 100, `${a0} → ${a1}`);
  check("tarayıcı hatası yok", !A.errors.length && !B.errors.length, [...A.errors, ...B.errors].slice(0, 2).join(" | "));

  // ---- Sosyete: başarı oranı %76+ oyuncular ücretsiz yazışır, küfür filtresi ----
  console.log("\n== Çevrimiçi: Sosyete sohbetli masa (iki gerçek oyuncu, küfür filtresi)");
  const C = await player(browser, "Cem");
  const D = await player(browser, "Deniz");
  for (const p of [C, D]) {
    await p.evaluate(() => window.__woTest.call("testSetStats", { played: 10, won: 9 }));
    await p.evaluate(() => window.__woTest.call("heartbeat", { name: "x", adult: true }));
    await W(p, 800);
  }
  await C.evaluate(() => localStorage.setItem("wordokey.vipTerms", "2026-11-24"));
  await D.evaluate(() => localStorage.setItem("wordokey.vipTerms", "2026-11-24"));
  for (const p of [C, D]) {
    await p.locator(".usta-hub").tap(); await W(p, 400);
    await p.locator(".sosyete-sit").tap();
    await until(async () => (await p.locator(".waiting-seats").count()) > 0);
  }
  const met = await until(async () => { const t = await C.locator(".waiting-seats").innerText(); return t.includes("Cem") && t.includes("Deniz"); });
  check("Cem ve Deniz (başarı oranı %90) aynı Sosyete masasında", met);
  await C.locator(".page.menu .primary.big").first().tap();
  await until(async () => (await C.locator(".okey-rack").count()) > 0 && (await D.locator(".okey-rack").count()) > 0, 20000);
  await C.locator(".chat-room-btn").first().tap(); await W(C, 300);
  const box = C.locator(".chat-input input");
  check("Sosyete'de serbest yazı kutusu var", (await box.count()) === 1);
  await box.fill("merhaba, iyi oyunlar");
  await C.locator(".chat-input button[type=submit], .chat-input button").first().tap();
  const seen = await until(async () => (await D.locator(".bubble-text").allInnerTexts()).some((x) => x.includes("merhaba")), 10000);
  check("Cem'in yazdığı mesaj Deniz'in ekranında görünüyor (VIP gerekmeden)", seen);
  await W(C, 1600);
  await box.fill("siktir git");
  await C.locator(".chat-input button[type=submit], .chat-input button").first().tap();
  const note = await until(async () => (await C.locator(".chat-note").count()) > 0, 8000);
  await W(D, 2500);
  const leaked = (await D.locator(".bubble-text").allInnerTexts()).some((x) => /siktir/i.test(x));
  check("küfürlü mesaj gönderilmedi: Cem uyarı aldı, Deniz görmedi", note && !leaked, (await C.locator(".chat-note").innerText().catch(() => "")).slice(0, 80));
  // Hazır "Hello Sosyete" mesajı (güvenlik kuralı yeni kimliğe izin veriyor) rakibe ulaşıyor
  await C.locator(".chat-msgs .chat-hello").tap();
  const hello = await until(async () => (await D.locator(".bubble, .chat-bubble").allInnerTexts()).some((x) => x.includes("Hello Sosyete")), 8000);
  check("Cem'in 'Hello Sosyete' hazır mesajı Deniz'e ulaştı", hello);
  check("Sosyete testinde tarayıcı hatası yok", !C.errors.length && !D.errors.length, [...C.errors, ...D.errors].slice(0, 2).join(" | "));

  // ---- Sosyete: arkadaşla oyna (özel masa, davet koduyla katılma) ----
  console.log("\n== Çevrimiçi: Sosyete arkadaşla oyna (davet kodu)");
  const E = await player(browser, "Ece");
  const F = await player(browser, "Fikret");
  for (const p of [E, F]) {
    await p.evaluate(() => window.__woTest.call("testSetStats", { played: 10, won: 9 }));
    await p.evaluate(() => window.__woTest.call("heartbeat", { name: "x", adult: true }));
    await p.evaluate(() => localStorage.setItem("wordokey.vipTerms", "2026-11-24"));
    await W(p, 800);
  }
  await E.locator(".usta-hub").tap(); await W(E, 400);
  await E.locator(".sosyete-friend").tap();
  const gotCode = await until(async () => /^[A-Z0-9]{6}$/.test((await E.locator(".invite-code").innerText()).trim()));
  const code = gotCode ? (await E.locator(".invite-code").innerText()).trim() : "";
  check("Ece Sosyete'de özel masa kurdu, davet kodu göründü", gotCode, code);
  await F.goto(BASE + "#join=" + code);
  await F.reload();
  await W(F, 800);
  if (await F.locator(".splash-hit").count()) await F.locator(".splash-hit").tap();
  const met2 = await until(async () => { const t = await E.locator(".waiting-seats").innerText(); return t.includes("Ece") && t.includes("Fikret"); }, 20000);
  check("Fikret davet koduyla Ece'nin Sosyete masasına oturdu", met2, (await E.locator(".waiting-seats").innerText().catch(() => "")).replace(/\n/g, " · "));
  check("masa adı Sosyete Özel, iki kişilik (boş koltuk yok)", /Sosyete Özel/.test(await E.locator(".page.menu .muted").first().innerText().catch(() => "")) && (await E.locator(".waiting-seats .invite-seat").count()) === 0);
  await E.getByRole("button", { name: "Şimdi başlat" }).tap();
  const started2 = await until(async () => (await E.locator(".okey-rack").count()) > 0 && (await F.locator(".okey-rack").count()) > 0, 20000);
  check("Ece oyunu başlattı, ikisi aynı masada oynuyor", started2);
  check("rakip Fikret (bilgisayar oyuncusu yok)", /Fikret/.test(await opp(E)) && /Ece/.test(await opp(F)), `${await opp(E)} / ${await opp(F)}`);
  const oppRate = async (p) => p.evaluate(() => [...document.querySelectorAll(".opp .avatar-rate, .topbar-center .avatar-rate")].map((x) => x.textContent));
  check("rakibin avatarının altında başarı oranı (90) görünüyor", (await oppRate(E)).includes("90") && (await oppRate(F)).includes("90"), `${await oppRate(E)} / ${await oppRate(F)}`);
  check("özel Sosyete masasında sohbet var", (await E.locator(".chat-room-btn").count()) > 0);
  // Sıraları arka arkaya 2 kez otomatik oynanınca iki oyuncuya da uyarı
  await E.evaluate(async () => { const r = await window.__woTest.call("createPrivateTable", { type: "ustaozel", lang: "tr", name: "Ece" }); await window.__woTest.call("testRunTimeouts", { tableId: r.tableId, turns: 4 }); });
  const warned = await until(async () => (await E.locator(".idle-warn").count()) > 0 && (await F.locator(".idle-warn").count()) > 0, 10000);
  check("sırası 2 kez otomatik oynanınca uyarı çıktı (iki oyuncuda da)", warned, (await E.locator(".idle-warn").innerText().catch(() => "")).replace(/\n/g, " · ").slice(0, 120));
  const warnFits = await E.evaluate(() => { const r = document.querySelector(".idle-warn")?.getBoundingClientRect(); return r ? r.left >= 0 && r.right <= innerWidth && r.top >= 0 : false; });
  check("uyarı ekrana sığıyor", warnFits);
  await E.locator(".idle-warn button").tap();
  await W(E, 400);
  check("'Anladım, oynuyorum' ile uyarı kapanıyor", (await E.locator(".idle-warn").count()) === 0);
  check("arkadaşla oyna testinde tarayıcı hatası yok", !E.errors.length && !F.errors.length, [...E.errors, ...F.errors].slice(0, 2).join(" | "));

  // Masa daveti: Kabul et · Reddet · Engelle (engellemeden önce onay sorulur)
  console.log("\n== Çevrimiçi: gelen davette Kabul et / Reddet / Engelle");
  const G = await player(browser, "Gül"), H = await player(browser, "Hakan");
  const hUid = await H.evaluate(() => window.__woTest.uid());
  await G.evaluate(async (h) => {
    await window.__woTest.call("sendFriendRequest", { targetUid: h });
    const r = await window.__woTest.call("createPrivateTable", { type: "ozel2", lang: "tr", name: "Gül" });
    await window.__woTest.call("inviteFriend", { tableId: r.tableId, friendUid: h });
  }, hUid);
  const gotInvite = await until(async () => (await H.locator(".invite-modal").count()) > 0, 25000);
  check("Hakan'a davet penceresi geldi", gotInvite);
  const btns = await H.locator(".invite-modal .modal-actions button").allInnerTexts();
  check("davette üç seçenek: Kabul et · Reddet · Engelle", btns.length === 3 && /Kabul et/.test(btns[0]) && /Reddet/.test(btns[1]) && /Engelle/.test(btns[2]), btns.join(" | "));
  await H.locator(".invite-modal .invite-block").tap(); await W(H, 200);
  check("Engelle'ye basınca önce onay sorulur", /Gül engellensin mi\?/.test(await H.locator(".invite-block-ask").innerText().catch(() => "")));
  await H.locator(".invite-block-ask button:not(.danger)").tap(); await W(H, 200);
  check("Vazgeç ile onay kapanır, davet durur", (await H.locator(".invite-block-ask").count()) === 0 && (await H.locator(".invite-modal").count()) === 1);
  await H.locator(".invite-modal .invite-block").tap(); await W(H, 200);
  await H.locator(".invite-block-ask button.danger").tap();
  const blockedOk = await until(async () => (await H.locator(".invite-modal").count()) === 0 && /Gül engellendi/.test(await H.locator(".toast").innerText().catch(() => "")), 8000);
  check("engelleyince davet kapanır, 'Gül engellendi.' yazar", blockedOk);
  const listed = await H.evaluate(async () => (await window.__woTest.call("blockedList")).blocked.map((x) => x.name));
  check("Gül, Hakan'ın engel listesinde", listed.includes("Gül"), JSON.stringify(listed));
  const again = await G.evaluate(async (h) => {
    const r = await window.__woTest.call("createPrivateTable", { type: "ozel2", lang: "tr", name: "Gül" }).catch(() => null);
    return window.__woTest.call("inviteFriend", { tableId: r?.tableId, friendUid: h }).then(() => "BAŞARI", (e) => e.details?.code ?? e.code);
  }, hUid);
  check("engellenen Gül bir daha davet gönderemez", again !== "BAŞARI", again);
  check("davet testinde tarayıcı hatası yok", !G.errors.length && !H.errors.length, [...G.errors, ...H.errors].slice(0, 2).join(" | "));

  await browser.close();
  console.log(fails ? `\n✗ ${fails} DENETİM BAŞARISIZ` : "\nHEPSİ GEÇTİ");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
