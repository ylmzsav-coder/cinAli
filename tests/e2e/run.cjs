/**
 * Uçtan uca (tarayıcı) testleri: derlenmiş oyunu gerçek bir tarayıcıda oynar ve denetler.
 *   npm run build && npx vite preview --port 4173 &  node tests/e2e/run.cjs
 * Herhangi bir denetim başarısız olursa çıkış kodu 1 olur (CI kırmızı yanar, e-posta uyarısı gider).
 */
const { chromium, devices } = require("playwright");
const BASE = process.env.E2E_URL || "http://127.0.0.1:4173/";
const LANGS = ["tr", "en", "de", "fr", "es", "it", "pt"];
/**
 * Paralel çalıştırma: E2E_PART=A|B|C|D ile yalnızca o parçanın bölümleri çalışır
 * (CI'da dört iş aynı anda). E2E_PART yoksa bütün bölümler sırayla çalışır.
 */
const PARTS = { A: ["3"], B: ["5"], C: ["1", "1b", "2", "2b"], D: ["4", "6", "7", "7b", "7c", "8", "9"] };
const PART = process.env.E2E_PART || "";
const want = (id) => !PART || (PARTS[PART] || []).includes(id);
let fails = 0;
const check = (label, ok, extra = "") => {
  console.log(`${ok ? "✓" : "✗"} ${label}${extra ? " — " + extra : ""}`);
  if (!ok) fails++;
};
const W = (p, ms) => p.waitForTimeout(ms);

async function fresh(browser, device, opts = {}) {
  const ctx = await browser.newContext({ ...devices[device] });
  const p = await ctx.newPage();
  p.setDefaultTimeout(10000);
  p.errors = [];
  p.on("pageerror", (e) => p.errors.push(e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/favicon|ERR_|Failed to load resource/.test(m.text())) p.errors.push(m.text().slice(0, 200)); });
  await p.goto(BASE);
  await p.evaluate((o) => {
    localStorage.clear();
    localStorage.setItem("wordokey.account", '{"method":"guest"}');
    localStorage.setItem("wordokey.birthYear", "1980");
    localStorage.setItem("wordokey.vipTerms", "2026-11-24");
    localStorage.setItem("wordokey.welcomeSeen", "1");
    localStorage.setItem("cinali.settings", JSON.stringify({ name: "Yılmaz", uiLang: o.lang || "tr", gameLang: o.lang || "tr", music: false, sound: false, gender: "erkek", speed: "hizli" }));
    // Başarı oranı (Sosyete şartı %76): varsayılan 10 oyunda 9 galibiyet (%90)
    localStorage.setItem("wordokey.stats", JSON.stringify({ gamesPlayed: o.played ?? 10, gamesWon: o.won ?? 9, gamesLost: (o.played ?? 10) - (o.won ?? 9) }));
    localStorage.setItem("cinali.wallet", JSON.stringify({ balance: o.balance ?? 50000, vipUntil: o.vip === false ? null : Date.now() + 864e5 * 5, lastDaily: new Date().toISOString().slice(0, 10) }));
  }, opts);
  await p.reload();
  await p.locator(".splash-hit").tap();
  await W(p, 400);
  return p;
}
const bal = async (p) => JSON.parse(await p.evaluate(() => localStorage.getItem("cinali.wallet"))).balance;
const game = async (p) => JSON.parse(await p.evaluate(() => localStorage.getItem("cinali.game") || "null"));
const toHub = async (p) => {
  await p.evaluate(() => localStorage.removeItem("cinali.game"));
  await p.reload(); await W(p, 500);
  if (await p.locator(".splash-hit").count()) await p.locator(".splash-hit").tap();
  await W(p, 400);
};

/** Üst çubuktaki öğeler birbirinin üstüne biniyor mu. */
async function topbarOverlaps(p) {
  return p.evaluate(() => {
    const els = [...document.querySelectorAll(".topbar > .title, .topbar-center > *, .topbar-actions > *")];
    const r = els.map((e) => e.getBoundingClientRect());
    let n = 0;
    for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) {
      const a = r[i], c = r[j];
      if (a.left < c.right - 1 && c.left < a.right - 1 && a.top < c.bottom - 1 && c.top < a.bottom - 1) n++;
    }
    return n + (document.documentElement.scrollWidth > innerWidth + 2 ? 100 : 0);
  });
}

const TABLES = [
  { name: "Çayhane", entry: 100, prize: 400, n: 4, open: async (p) => { await p.locator(".cayhane-hub").tap(); await W(p, 300); await p.locator(".cayhane-lobby .vip-stake button").nth(2).tap(); await p.locator(".cayhane-lobby .sosyete-sit").tap(); await W(p, 300); await p.locator(".lobby-panel .primary").tap(); } },
  ...[0, 1].map((i) => ({ name: `Çayhane ${[25, 50][i]}`, entry: [25, 50][i], prize: [100, 200][i], n: 4, open: async (p) => { await p.locator(".cayhane-hub").tap(); await W(p, 300); await p.locator(".cayhane-lobby .vip-stake button").nth(i).tap(); await p.locator(".cayhane-lobby .sosyete-sit").tap(); await W(p, 300); await p.locator(".lobby-panel .primary").tap(); } })),
  ...[0, 1, 2].map((i) => ({ name: `Çarli ${[100, 200, 300][i]}`, entry: [100, 200, 300][i], prize: [400, 800, 1200][i], n: 4, open: async (p) => { await p.locator(".carli-hub").tap(); await W(p, 300); await p.locator(".carli-lobby .vip-stake button").nth(i).tap(); await p.locator(".carli-lobby .sosyete-sit").tap(); await W(p, 300); await p.locator(".lobby-panel .primary").tap(); } })),
  ...[0, 1, 2].map((i) => ({ name: `Sosyete ${[100, 1000, 10000][i]}`, entry: [100, 1000, 10000][i], prize: [400, 4000, 40000][i], n: 4, open: async (p) => { await p.locator(".usta-hub").tap(); await W(p, 300); await p.locator(".sosyete-lobby .vip-stake button").nth(i).tap(); await p.locator(".sosyete-sit").tap(); await W(p, 300); await p.locator(".lobby-panel .primary").tap(); } })),
  ...[0, 1, 2].map((i) => ({ name: `Fifty Cent ${[100, 1000, 10000][i]}`, entry: [100, 1000, 10000][i], prize: [200, 2000, 20000][i], n: 2, open: async (p) => { await p.locator(".ozel-hub").tap(); await W(p, 300); await p.locator(".ozel-stake button").nth(i).tap(); await p.locator(".two-choices button").nth(2).tap(); } })),
  { name: "VIP", entry: 100, prize: 200, n: 2, open: async (p) => { await p.locator(".vip-hub").tap(); await W(p, 300); await p.locator(".two-choices button").nth(2).tap(); } },
];

(async () => {
  const browser = await chromium.launch();

  if (want("1")) {
  console.log("\n== 1. Masalar: giriş ücreti, oyuncu sayısı, birinciye ödeme, kaybedene 0");
  {
    const p = await fresh(browser, "Pixel 7 landscape");
    for (const tb of TABLES) {
      for (const win of [true, false]) {
        const b0 = await bal(p);
        await tb.open(p); await W(p, 1200);
        const g = await game(p); const b1 = await bal(p);
        await p.evaluate((w) => { const g = JSON.parse(localStorage.getItem("cinali.game")); g.state.history = [g.state.players.map((_, i) => (i === (w ? 0 : 1) ? 150 : 20))]; g.state.results = [{ winner: w ? 0 : 1, colorWin: null }]; g.state.phase = "gameOver"; g.state.handNo = g.state.totalHands; localStorage.setItem("cinali.game", JSON.stringify(g)); const _set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k !== "cinali.game") _set.call(this, k, v); }; }, win);
        await p.reload(); await W(p, 600); if (await p.locator(".splash-hit").count()) await p.locator(".splash-hit").tap(); await W(p, 400);
        const b2 = await bal(p);
        check(`${tb.name} ${win ? "kazanınca" : "kaybedince"}`, g?.state.players.length === tb.n && b0 - b1 === tb.entry && b2 - b1 === (win ? tb.prize : 0),
          `kişi ${g?.state.players.length}, giriş ${b0 - b1}, ödeme ${b2 - b1}`);
        await toHub(p);
      }
    }
    // Puanı en yüksek olan değil, ıstakasını ilk bitiren kazanır
    {
      const tb = TABLES[0];
      await tb.open(p); await W(p, 1200);
      const b1 = await bal(p);
      await p.evaluate(() => { const g = JSON.parse(localStorage.getItem("cinali.game")); g.state.history = [g.state.players.map((_, i) => (i === 0 ? 300 : 20))]; g.state.results = [{ winner: 1, colorWin: null }]; g.state.lastResult = { winner: 1, colorWin: null, scores: g.state.history[0], reason: "finished" }; g.state.phase = "gameOver"; g.state.handNo = g.state.totalHands; localStorage.setItem("cinali.game", JSON.stringify(g)); const _set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k !== "cinali.game") _set.call(this, k, v); }; });
      await p.reload(); await W(p, 600); if (await p.locator(".splash-hit").count()) await p.locator(".splash-hit").tap(); await W(p, 400);
      await p.locator(".hub-right .primary.big").first().tap().catch(() => {}); await W(p, 1000);
      const txt = await p.locator(".winner").first().innerText().catch(() => "");
      check("puanı en yüksek olan değil, ıstakasını ilk bitiren kazanır (300 puanlı oyuncu ödül almaz)", (await bal(p)) === b1 && /Kazanan/.test(txt) && !txt.includes("Yılmaz"), `ödeme ${(await bal(p)) - b1}, ekranda "${txt}"`);
      await toHub(p);
    }
    // Fiyat değişmeden önce başlamış Sosyete oyunu (kayıtta fiyat yok) eski fiyatla biter: 500 giriş → 2.000 ödül
    {
      const sos = TABLES.find((x) => x.name === "Sosyete 100");
      await sos.open(p); await W(p, 1200);
      const g0 = await game(p);
      check("yeni oyun kendi fiyatını kaydeder", g0?.entry === 100 && g0?.prize === 400, JSON.stringify({ entry: g0?.entry, prize: g0?.prize }));
      const b1 = await bal(p);
      await p.evaluate(() => { const g = JSON.parse(localStorage.getItem("cinali.game")); delete g.entry; delete g.prize; g.state.history = [g.state.players.map((_, i) => (i === 0 ? 150 : 20))]; g.state.results = [{ winner: 0, colorWin: null }]; g.state.phase = "gameOver"; g.state.handNo = g.state.totalHands; localStorage.setItem("cinali.game", JSON.stringify(g)); const _set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k !== "cinali.game") _set.call(this, k, v); }; });
      await p.reload(); await W(p, 600); if (await p.locator(".splash-hit").count()) await p.locator(".splash-hit").tap(); await W(p, 400);
      check("güncellemeden önce başlamış Sosyete oyunu eski fiyatla ödenir (2.000)", (await bal(p)) - b1 === 2000, `ödeme ${(await bal(p)) - b1}`);
      await toHub(p);
    }
    check("masalarda tarayıcı hatası yok", !p.errors.length, p.errors.slice(0, 2).join(" | "));
  }
  }

  if (want("1b")) {
  console.log("\n== 1b. Kimse bitiremedi (deste bitti): kaybeden yok, ücret yeni oyuna, çıkarsa iade");
  {
    const p = await fresh(browser, "Pixel 7 landscape", { balance: 1000, played: 0, won: 0 });
    const deckOut = async () => {
      await p.evaluate(() => {
        const g = JSON.parse(localStorage.getItem("cinali.game"));
        g.state.history = [g.state.players.map((_, i) => 100 + i)];
        g.state.results = [{ winner: null, colorWin: null }];
        g.state.lastResult = { winner: null, colorWin: null, scores: g.state.history[0], reason: "deckEmpty" };
        g.state.phase = "gameOver"; g.state.handNo = g.state.totalHands;
        localStorage.setItem("cinali.game", JSON.stringify(g)); const _set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k !== "cinali.game") _set.call(this, k, v); };
      });
      await p.reload(); await W(p, 600); if (await p.locator(".splash-hit").count()) await p.locator(".splash-hit").tap(); await W(p, 400);
      if (await p.locator(".hub-right .primary.big").count()) { await p.locator(".hub-right .primary.big").first().tap(); await W(p, 800); }
    };
    await TABLES[0].open(p); await W(p, 1200);
    await deckOut();
    check("deste bitince ödeme yok, kesinti yok (bakiye 900)", (await bal(p)) === 900, String(await bal(p)));
    check("kaybeden yok ekranı ve iki seçenek", (await p.getByText("Yeni oyun (ücretsiz)").count()) === 1 && (await p.getByText(/Masadan çık · 100 çip iade/).count()) === 1);
    await p.getByText("Yeni oyun (ücretsiz)").tap(); await W(p, 1200);
    const g2 = await game(p);
    check("yeni oyun ücretsiz başladı (bakiye 900, 4 kişi)", (await bal(p)) === 900 && g2?.state.phase !== "gameOver" && g2?.state.players.length === 4);
    await deckOut();
    await p.getByText(/Masadan çık · 100 çip iade/).tap(); await W(p, 600);
    check("masadan çıkınca ücret kesintisiz iade (bakiye 1000)", (await bal(p)) === 1000 && !(await game(p)), String(await bal(p)));
    const st = JSON.parse(await p.evaluate(() => localStorage.getItem("wordokey.stats") || "{}"));
    check("kaybeden sayılmadı (istatistikte yenilgi yok)", !st.gamesLost);
    check("tarayıcı hatası yok", !p.errors.length, p.errors.slice(0, 2).join(" | "));
  }
  }

  if (want("2")) {
  console.log("\n== 2. Çayhane baştan sona gerçek oyun (bilgisayarlar oynar)");
  {
    const p = await fresh(browser, "Pixel 7 landscape", { balance: 1000 });
    await TABLES[0].open(p); await W(p, 1000);
    await p.evaluate(() => { const g = JSON.parse(localStorage.getItem("cinali.game")); g.state.players[0].isBot = true; localStorage.setItem("cinali.game", JSON.stringify(g)); const _set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k !== "cinali.game") _set.call(this, k, v); }; });
    await p.reload(); await W(p, 600); if (await p.locator(".splash-hit").count()) await p.locator(".splash-hit").tap(); await W(p, 400);
    await p.locator(".hub-right .primary.big").first().tap();
    let g;
    for (let k = 0; k < 600; k++) { await W(p, 250); g = await game(p); if (g?.state.phase === "gameOver" && g.settled) break; }
    const tot = g.state.history.reduce((a, h) => a.map((x, i) => x + h[i]), g.state.players.map(() => 0));
    // Kimse bitiremediyse (deste bitti) kaybeden yok: ödeme yapılmaz, giriş ücreti yeni oyuna devreder
    const carry = !!g.carry;
    // Kazanan: ıstakasını ilk bitiren (puan sırası değil)
    const expected = carry ? 0 : g.state.lastResult?.winner === 0 ? 400 : 0;
    await W(p, 600);
    check("oyun bitti ve doğru ödendi", g.state.phase === "gameOver" && (await bal(p)) === 900 + expected, `bitiren ${g.state.lastResult?.winner ?? "yok"}, puanlar ${tot.join("/")}, bakiye ${await bal(p)}${carry ? " (kimse bitiremedi: ücret devreder)" : ""}`);
    check("sonuç ekranı göründü", (await p.locator(".modal").count()) > 0);
    check("oyun sırasında tarayıcı hatası yok", !p.errors.length, p.errors.slice(0, 2).join(" | "));
  }
  }

  if (want("2b")) {
  console.log("\n== 2b. Fifty Cent baştan sona gerçek oyun (100, 1.000, 10.000)");
  for (const [i, entry, prize] of [[0, 100, 200], [1, 1000, 2000], [2, 10000, 20000]]) {
    const p = await fresh(browser, "Pixel 7 landscape", { balance: 25000 });
    await TABLES.find((x) => x.name === `Fifty Cent ${entry}`).open(p); await W(p, 1000);
    const b1 = await bal(p);
    check(`Fifty Cent ${entry}: giriş ${entry} alındı, 2 kişilik, kayıtta fiyat ${entry} → ${prize}`, b1 === 25000 - entry && (await game(p))?.state.players.length === 2 && (await game(p))?.entry === entry && (await game(p))?.prize === prize);
    await p.evaluate(() => { const g = JSON.parse(localStorage.getItem("cinali.game")); g.state.players[0].isBot = true; localStorage.setItem("cinali.game", JSON.stringify(g)); const _set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k !== "cinali.game") _set.call(this, k, v); }; });
    await p.reload(); await W(p, 600); if (await p.locator(".splash-hit").count()) await p.locator(".splash-hit").tap(); await W(p, 400);
    await p.locator(".hub-right .primary.big").first().tap();
    let g;
    for (let k = 0; k < 600; k++) { await W(p, 250); g = await game(p); if (g?.state.phase === "gameOver" && g.settled) break; }
    const tot = g.state.history.reduce((a, h) => a.map((x, j) => x + h[j]), g.state.players.map(() => 0));
    const carry = !!g.carry;
    const expected = carry ? 0 : g.state.lastResult?.winner === 0 ? prize : 0;
    await W(p, 600);
    check(`Fifty Cent ${entry}: oyun bitti ve doğru ödendi`, g.state.phase === "gameOver" && (await bal(p)) === b1 + expected, `bitiren ${g.state.lastResult?.winner ?? "yok"}, puanlar ${tot.join("/")}, ödeme ${(await bal(p)) - b1}${carry ? " (kimse bitiremedi: ücret devreder)" : ""}`);
    check(`Fifty Cent ${entry}: oyunda en az 3 harf kuralı`, g.state.minWord === 3);
    check(`Fifty Cent ${entry}: tarayıcı hatası yok`, !p.errors.length, p.errors.slice(0, 2).join(" | "));
    await p.context().close();
  }
  {
    // Fiyat değişmeden önce başlamış Fifty Cent oyunu (250'lik, kayıtta fiyat yok) eski fiyatla biter: 500 ödül
    const p = await fresh(browser, "Pixel 7 landscape");
    await TABLES.find((x) => x.name === "Fifty Cent 1000").open(p); await W(p, 1000);
    const b1 = await bal(p);
    await p.evaluate(() => { const g = JSON.parse(localStorage.getItem("cinali.game")); delete g.entry; delete g.prize; g.state.history = [g.state.players.map((_, i) => (i === 0 ? 150 : 20))]; g.state.results = [{ winner: 0, colorWin: null }]; g.state.phase = "gameOver"; g.state.handNo = g.state.totalHands; localStorage.setItem("cinali.game", JSON.stringify(g)); const _set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k !== "cinali.game") _set.call(this, k, v); }; });
    await p.reload(); await W(p, 600); if (await p.locator(".splash-hit").count()) await p.locator(".splash-hit").tap(); await W(p, 400);
    check("güncellemeden önce başlamış Fifty Cent (250) oyunu eski fiyatla ödenir (500)", (await bal(p)) - b1 === 500, `ödeme ${(await bal(p)) - b1}`);
    await p.context().close();
  }
  }

  if (want("3")) {
  console.log("\n== 3. Bütün diller ve ekran boyutları: ekranlar açılıyor, üst çubuk taşmıyor");
  for (const device of ["Pixel 7 landscape", "iPhone SE landscape", "Galaxy S8 landscape", "iPad Mini landscape"]) {
    for (const lang of LANGS) {
      const p = await fresh(browser, device, { lang });
      const k = `${device.split(" ")[0]}/${lang}`;
      try {
        for (const [sel, name] of [[".profile-chip", "profil"], [".shop-hub", "mağaza"]]) {
          await p.locator(sel).tap(); await W(p, 300);
          if (name === "profil") { await p.locator(".profile-actions button").nth(1).tap(); await W(p, 200); await p.locator(".profile-close").tap(); }
          else await p.locator(".page .link").first().tap();
          await W(p, 300);
        }
        await TABLES[0].open(p); await W(p, 1200);
        const o4 = await topbarOverlaps(p);
        await p.locator(".quit-btn").tap(); await W(p, 300); await p.locator(".quit-modal button.danger").tap(); await W(p, 600);
        await p.locator(".practice-hub").tap(); await W(p, 300); await p.locator(".primary.big").last().tap(); await W(p, 1000);
        const o2 = await topbarOverlaps(p);
        await p.locator(".chat-room-btn").tap(); await W(p, 300);
        check(`${k}: üst çubuk düzgün (4 ve 2 kişi)`, o4 === 0 && o2 === 0, `çakışma ${o4}/${o2}`);
      } catch (e) {
        check(`${k}: ekran akışı`, false, e.message.split("\n")[0]);
      }
      check(`${k}: tarayıcı hatası yok`, !p.errors.length, p.errors.slice(0, 2).join(" | "));
      await p.context().close();
    }
  }
  }

  if (want("4")) {
  console.log("\n== 4. Ayarlar, ad değiştirme, yaş kapısı, geri tuşu");
  {
    const p = await fresh(browser, "Pixel 7 landscape");
    await p.locator(".profile-chip").tap(); await W(p, 300);
    await p.locator(".name-btn").tap(); await p.locator(".name-edit input").fill("Deneme"); await p.locator(".name-edit button").tap(); await W(p, 200);
    check("profilde ad değişir ve kaydedilir", JSON.parse(await p.evaluate(() => localStorage.getItem("cinali.settings"))).name === "Deneme");
    await p.locator(".profile-actions button").nth(1).tap(); await W(p, 200);
    await p.locator(".settings-list .switch").nth(4).tap(); await W(p, 200);
    check("ayar anahtarı kaydedilir (oyun sesleri)", JSON.parse(await p.evaluate(() => localStorage.getItem("cinali.settings"))).sound === true);
    await p.locator(".profile-close").tap(); await W(p, 300);
    await p.evaluate(() => window.dispatchEvent(new CustomEvent("wordokey:back"))); await W(p, 200);
    check("menüde geri tuşu kapatma onayı sorar", (await p.locator(".quit-modal").count()) === 1);
    await p.locator(".quit-modal button:not(.danger)").tap();
    await p.evaluate(() => { localStorage.setItem("wordokey.birthYear", "2010"); }); await p.reload(); await W(p, 500); if (await p.locator(".splash-hit").count()) await p.locator(".splash-hit").tap(); await W(p, 400);
    await p.locator(".vip-hub").tap(); await W(p, 300);
    check("18 yaş altı VIP odaya giremez", (await p.locator(".vip-lobby").count()) === 0);
    await p.evaluate(() => { localStorage.setItem("wordokey.birthYear", "2016"); localStorage.removeItem("wordokey.account"); sessionStorage.clear(); }); await p.reload(); await W(p, 500);
    await p.locator(".login-guest").tap(); await W(p, 300);
    check("13 yaş altı oyuna giremez", (await p.locator(".age-gate").count()) === 1 && (await p.locator(".hub-right").count()) === 0);
    check("tarayıcı hatası yok", !p.errors.length, p.errors.slice(0, 2).join(" | "));
  }
  }

  if (want("5")) {
  console.log("\n== 5. Kelime uzunlukları: 2, 3, 4 harf (2 harf yalnızca Çayhane ve Pratikte geçerli)");
  {
    const p = await fresh(browser, "Pixel 7 landscape");
    const pick = (n) => TABLES.find((x) => x.name === n);
    for (const d of ["Pixel 7 landscape", "iPhone SE landscape", "Galaxy S8 landscape"]) {
      const q = await fresh(browser, d);
      await q.locator(".vip-hub").tap(); await W(q, 400);
      const r = await q.evaluate(() => { const g = (s) => document.querySelector(s).getBoundingClientRect(); const a = g(".vip-search-seat"), i = g(".lobby-info"), m = g(".lobby-me"); return { top: i.top - a.bottom, bot: m.top - i.bottom, note: !!document.querySelector(".vip-opp-note") }; });
      check(`VIP lobi (${d}): "rakip VIP olmak zorunda değil" notu var, başlık ve oyuncu rozetiyle çakışmıyor`, r.note && r.top >= 0 && r.bot >= 0, JSON.stringify(r));
      await q.context().close();
    }

    const WORDS = [["EK", 20], ["SÜT", 72], ["KUZU", 93], ["KZAL", null]];
    // İki harfli kelime yalnızca Çayhane ve Pratik (çipsiz) masada geçerli
    const pratik = { name: "Pratik", open: async (p) => { await p.locator(".practice-hub").tap(); await W(p, 300); await p.locator(".page .primary.big").last().tap(); } };
    const all = [pick("VIP"), pick("Fifty Cent 100"), pick("Fifty Cent 1000"), pick("Fifty Cent 10000"), pick("Çayhane 25"), pick("Çayhane 50"), pick("Çayhane"), pratik, pick("Çarli 100"), pick("Çarli 200"), pick("Çarli 300"), pick("Sosyete 100"), pick("Sosyete 1000"), pick("Sosyete 10000")];
    for (const tb of all) {
      const pro = !(tb.name.startsWith("Çayhane") || tb.name === "Pratik");
      for (const [word, value] of WORDS) {
        await toHub(p);
        // Art arda açılıp bırakılan oyunlar oranı düşürür; Sosyete (%76) şartı için oran yenilenir
        // Kumbara da her masadan önce doldurulur (onlarca giriş ücreti kumbarayı boşaltır)
        await p.evaluate(() => { localStorage.setItem("wordokey.stats", JSON.stringify({ gamesPlayed: 10, gamesWon: 9, gamesLost: 1 })); const w = JSON.parse(localStorage.getItem("cinali.wallet")); w.balance = 50000; localStorage.setItem("cinali.wallet", JSON.stringify(w)); });
        await tb.open(p); await W(p, 1500);
        // Sırayı oyuncuya ver, ıstakaya yalnızca bu kelimeyi diz
        await p.evaluate((word) => {
          const g = JSON.parse(localStorage.getItem("cinali.game")); const s = g.state;
          const me = s.players.findIndex((x) => !x.isBot); const tpl = s.players[me].rack.find((x) => x.letter !== null);
          s.players[me].rack = [...word].map((ch, i) => ({ ...tpl, id: 9000 + i, letter: ch }));
          s.current = me; s.phase = "play"; localStorage.setItem("cinali.game", JSON.stringify(g)); const _set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k !== "cinali.game") _set.call(this, k, v); };
        }, word);
        await p.reload(); await W(p, 900);
        if (await p.locator(".splash-hit").count()) { await p.locator(".splash-hit").tap(); await W(p, 400); }
        if (!(await p.locator(".group-chip").count())) { await p.locator(".hub-right button.primary, .hub-right .resume").first().tap().catch(() => {}); await W(p, 1200); }
        const chip = (await p.locator(".group-chip").allInnerTexts()).join(" ");
        const ok = (await p.locator(".group-chip.ok").count()) === 1;
        const want = value !== null && !(pro && word.length === 2);
        check(`${tb.name}: ${word} (${word.length} harf) ${want ? "geçerli" : "geçersiz"}`, ok === want && (!want || chip.includes(String(value))), chip);
      }
    }
    check("tarayıcı hatası yok", !p.errors.length, p.errors.slice(0, 2).join(" | "));
  }
  }

  if (want("6")) {
  console.log("\n== 6. Kurallar sayfası: 7 dilde masa/ücret tablosu ve güncel kurallar");
  for (const lang of LANGS) {
    const p = await fresh(browser, "iPhone SE landscape", { lang });
    await p.locator(".hub-right button").filter({ hasText: /📖/ }).first().tap(); await W(p, 400);
    const r = await p.evaluate(() => ({ rows: document.querySelectorAll(".fee-table tbody tr").length, items: document.querySelectorAll("ol.rules li").length, hscroll: document.documentElement.scrollWidth > innerWidth + 2, raw: /\{[a-z]+\}/.test(document.body.innerText) }));
    await p.locator(".link").first().tap(); await W(p, 300);
    const kb = await p.evaluate(() => { const el = document.querySelector(".kumbara-balance"); return { icon: !!el?.querySelector(".kumbara-icon"), label: el?.querySelector(".kumbara-label")?.textContent ?? "" }; });
    const KB = { tr: "Kumbara", en: "Money box", de: "Spardose", fr: "Tirelire", es: "Hucha", it: "Salvadanaio", pt: "Cofrinho" };
    check(`Menü (${lang}): çipler kumbarada — resim ve "${KB[lang]}" yazısı`, kb.icon && kb.label === KB[lang], JSON.stringify(kb));
    check(`Kurallar (${lang}): 23 madde, 14 satırlık masa tablosu, taşma yok`, r.rows === 14 && r.items === 23 && !r.hscroll && !r.raw, JSON.stringify(r));
    await p.context().close();
  }
  }

  if (want("7")) {
  console.log("\n== 7. Sosyete giriş şartı: başarı oranı en az %76 (7 dil)");
  for (const lang of LANGS) {
    // %75 (4 oyunda 3): giriş engellenir, neden yazılır, çip alınmaz
    const p = await fresh(browser, "Pixel 7 landscape", { lang, played: 4, won: 3 });
    const b0 = await bal(p);
    await p.locator(".usta-hub").tap(); await W(p, 400);
    const blocked = await p.evaluate(() => ({ sit: !!document.querySelector(".sosyete-sit"), text: document.querySelector(".rate-block")?.textContent ?? "" }));
    check(`Sosyete (${lang}) %75: oturma düğmesi yok, uyarı yazısı var (%76 ve %75 yazıyor)`, !blocked.sit && blocked.text.includes("76") && blocked.text.includes("75"), blocked.text.slice(0, 90));
    // Masalar sayfası gibi başka yoldan oturmaya çalışınca da engellenir
    await p.locator(".leave-round").tap(); await W(p, 300);
    check(`Sosyete (${lang}) %75: oyun açılmadı, çip alınmadı`, !(await game(p)) && (await bal(p)) === b0);
    await p.context().close();
    // %76 (25 oyunda 19): oturabilir
    const q = await fresh(browser, "Pixel 7 landscape", { lang, played: 25, won: 19 });
    await q.locator(".usta-hub").tap(); await W(q, 400);
    await q.locator(".sosyete-sit").tap(); await W(q, 400);
    await q.locator(".lobby-panel .primary").tap(); await W(q, 1200);
    const g = await game(q);
    check(`Sosyete (${lang}) %76: oturabilir, oyun başladı`, g?.tableId === "usta" && (await bal(q)) === 50000 - 100, `masa ${g?.tableId}`);
    check(`Sosyete (${lang}): tarayıcı hatası yok`, !q.errors.length && !p.errors.length, [...p.errors, ...q.errors].slice(0, 2).join(" | "));
    await q.context().close();
  }
  {
    // Sosyete "Arkadaşla oyna": Otur'un yanında; davet koltuklu bekleme masasını açar
    for (const d of ["Pixel 7 landscape", "iPhone SE landscape"]) {
      const q = await fresh(browser, d, { played: 25, won: 19 });
      await q.locator(".usta-hub").tap(); await W(q, 400);
      const r = await q.evaluate(() => {
        const a = document.querySelector(".sosyete-sit")?.getBoundingClientRect(), b = document.querySelector(".sosyete-friend")?.getBoundingClientRect();
        return { has: !!a && !!b, text: document.querySelector(".sosyete-friend")?.textContent ?? "", side: a && b ? Math.abs(a.top - b.top) < 4 && a.right <= b.left + 1 : false, fit: b ? b.right <= innerWidth && b.bottom <= innerHeight : false };
      });
      check(`Sosyete (${d}): 'Otur' ve 'Arkadaşla oyna · 2 kişilik özel oda' yan yana, ekrana sığıyor`, r.has && r.side && r.fit && r.text.includes("Arkadaşla oyna") && r.text.includes("2 kişilik özel oda"), JSON.stringify(r));
      await q.locator(".sosyete-friend").tap(); await W(q, 400);
      const inv = await q.locator(".invite-seat").count();
      check(`Sosyete (${d}): arkadaşla oyna → iki kişilik özel oda (1 davet koltuğu)`, inv === 1, `davet koltuğu ${inv}`);
      await q.locator(".lobby-panel .primary").tap(); await W(q, 1200);
      const g = await game(q);
      check(`Sosyete (${d}) arkadaşla: oyun Sosyete Özel masasında, 2 oyuncu, 100 giriş`, g?.tableId === "ustaozel" && g?.state?.players?.length === 2 && (await bal(q)) === 50000 - 100, `masa ${g?.tableId}, oyuncu ${g?.state?.players?.length}`);
      check(`Sosyete (${d}) arkadaşla: tarayıcı hatası yok`, !q.errors.length, q.errors.slice(0, 2).join(" | "));
      await q.context().close();
    }
    // Ana menüde oyun düğmeleri seviye renklerinde: Çayhane turuncu, Çarli sarı, Fifty Cent yeşil, Sosyete kırmızı
    {
      const h = await fresh(browser, "Pixel 7 landscape", { played: 10, won: 6 });
      const bg = await h.evaluate(() => Object.fromEntries([".cayhane-hub", ".carli-hub", ".ozel-hub", ".usta-hub", ".close-game"].map((k) => [k, getComputedStyle(document.querySelector(k)).backgroundImage])));
      check("menü düğmeleri: Çayhane turuncu, Çarli sarı, Fifty Cent yeşil, Sosyete kırmızı (Oyunu kapat ile aynı ton)",
        bg[".cayhane-hub"].includes("rgb(239, 108, 0)") && bg[".carli-hub"].includes("rgb(245, 197, 24)") && bg[".ozel-hub"].includes("rgb(19, 235, 4)") && bg[".usta-hub"] === bg[".close-game"], JSON.stringify(bg).slice(0, 200));
      await h.context().close();
    }
    // Kelimelerin Kök Değeri: kalem hareketleri toplanır, rakamları tek basamağa iner; uzay tablosu altı kelime, hepsi 16 → 7
    {
      const h = await fresh(browser, "Pixel 7 landscape");
      await h.locator(".wordnum-hub").tap(); await W(h, 300);
      await h.locator(".wordnum-input").fill("kainat"); await W(h, 150);
      const root = (await h.locator(".wordnum-root b").innerText()).trim();
      const sum = await h.locator(".wordnum-sum").innerText();
      const rows = await h.locator(".wordnum-table tbody tr").allInnerTexts();
      check("Kelimelerin Kök Değeri: KAİNAT = 3+3+2+3+3+2 = 16 → 7", root === "7" && sum.includes("16"), `${sum} → ${root}`);
      check("Kelimelerin Kök Değeri: uzay tablosu 6 kelime, hepsi 16 ve 7", rows.length === 6 && rows.every((r) => /16\s+7/.test(r)), rows.join(" | "));
      await h.locator(".wordnum-input").fill("ampül"); await W(h, 150);
      check("Kelimelerin Kök Değeri: Ü 5 hareket (AMPÜL = 16 → 7)", (await h.locator(".wordnum-sum").innerText()).includes("16"));
      await h.locator(".wordnum-all-btn").tap(); await W(h, 800);
      const chips = await h.locator(".wordnum-chip").evaluateAll((es) => es.slice(0, 8).map((e) => `${e.classList.contains("space") ? "*" : ""}${e.textContent}`));
      const lens = await h.locator(".wordnum-chip:not(.space)").evaluateAll((es) => es.map((e) => [...e.textContent].length));
      const cnt = await h.locator(".wordnum-count").innerText();
      check("Kelimelerin Kök Değeri: bütün yediler (9.434), ilk altı uzay altılısı ayrı renkte", cnt.includes("9.434") && chips.slice(0, 6).every((c) => c.startsWith("*")) && !chips[6].startsWith("*") && chips[0].includes("ZAMAN") && chips[5].includes("KAİNAT"), `${cnt} | ${chips.join(" ")}`);
      check("Kelimelerin Kök Değeri: yediler en uzundan en kısaya sıralı", lens.length > 100 && lens.every((n, i) => i === 0 || lens[i - 1] >= n), `ilk ${lens.slice(0, 5)} son ${lens.slice(-3)}`);
      await h.locator(".wordnum-chip:not(.space)").first().tap(); await W(h, 200);
      check("Kelimelerin Kök Değeri: listedeki kelimeye dokununca hesabı açılır (7)", (await h.locator(".wordnum-card .wordnum-root b").innerText()).trim() === "7");
      await h.locator(".wordnum-card .primary").tap();
      await h.locator(".wordnum-famous-btn").tap(); await W(h, 200);
      const f7 = await h.locator(".famous7-card b").allInnerTexts();
      check("Ünlü 7'liler: 6 konu, kıta / harika / İstanbul tepesi / yüzdeki delik / gökkuşağı / yedi göbek kartları", (await h.locator(".famous7-group").count()) === 6 && ["7 kıta", "Dünyanın 7 harikası", "İstanbul'un 7 tepesi", "Yüzdeki 7 delik", "Gökkuşağının 7 rengi", "Yedi göbek"].every((k) => f7.some((x) => x.startsWith(k))), f7.slice(0, 8).join(" | "));
      check("Nasıl sayılır kartı: ET çizgi çizgi (E 4 + T 2 = 6 numaralı çizgi), harf tablosu", (await h.locator(".stroke-demo .stroke-num").count()) === 6 && (await h.locator(".stroke-sum").innerText()).includes("= 6"));
      check("Kelimelerin Kök Değeri: tarayıcı hatası yok", !h.errors.length, h.errors.slice(0, 2).join(" | "));
      await h.context().close();
    }
    // Çayhane demliği: "Oyunu kapat" ile aynı kırmızı (SVG), yazıyla birlikte ortalı
    {
      const h = await fresh(browser, "Pixel 7 landscape", { played: 10, won: 6 });
      const r = await h.evaluate(() => {
        const stops = [...document.querySelectorAll(".cayhane-hub .teapot-icon linearGradient stop")].map((x) => x.getAttribute("stop-color"));
        const b = document.querySelector(".cayhane-hub").getBoundingClientRect(), top = document.querySelector(".cayhane-top").getBoundingClientRect();
        return { stops, off: Math.round(top.left + top.width / 2 - (b.left + b.width / 2)), emoji: document.querySelector(".cayhane-hub").textContent.includes("🫖") };
      });
      check("Çayhane demliği Oyunu kapat tonunda (#ef5350 → #b3261e), emoji yok, başlık hafif sola (simetrik)", r.stops.join() === "#ef5350,#b3261e" && !r.emoji && r.off <= 0 && r.off >= -12, JSON.stringify(r));
      await h.context().close();
    }
    // Profil istatistikleri: en yüksek puanlı kelime yok; en uzun kelime var, taşların altında puan yazmıyor
    {
      const h = await fresh(browser, "Pixel 7 landscape", { played: 10, won: 6 });
      await h.evaluate(() => { const st = JSON.parse(localStorage.getItem("wordokey.stats")); st.longestWord = "KALEMLİK"; st.bestWord = { word: "ZAM", value: 99 }; localStorage.setItem("wordokey.stats", JSON.stringify(st)); });
      await h.locator(".hub-rate").tap(); await W(h, 400);
      await h.getByRole("button", { name: /İstatistik/ }).tap(); await W(h, 400);
      const r = await h.evaluate(() => { const d = document.querySelector(".stats-detail"); const vals = [...d.querySelectorAll(".word-tiles .tile-value")].filter((x) => getComputedStyle(x).display !== "none").length; return { text: d.innerText, tiles: d.querySelectorAll(".word-tiles .tile").length, vals }; });
      check("profilde 'en yüksek puanlı kelime' yok, en uzun kelime (KALEMLİK) var, altında puan yok", !/puanlı/i.test(r.text) && !r.text.includes("99") && r.tiles === 8 && r.vals === 0 && /En uzun kelime/i.test(r.text), JSON.stringify(r).slice(0, 220));
      await h.context().close();
    }
    // Avatarın altında başarı oranı rozeti (seviye renginde); bilgisayar oyuncularında yok
    {
      const h = await fresh(browser, "Pixel 7 landscape", { played: 100, won: 77 });
      await h.locator(".hub-rate").tap(); await W(h, 400);
      const prof = await h.evaluate(() => { const b = document.querySelector(".profile-banner .avatar-rate"); return b ? { text: b.textContent, bg: getComputedStyle(b).backgroundColor } : null; });
      check("profil resminin altında başarı oranı rozeti: 77, kırmızı (Sosyete)", prof?.text === "77" && prof.bg === "rgb(229, 57, 53)", JSON.stringify(prof));
      await h.locator(".profile-close").tap(); await W(h, 300);
      await TABLES[0].open(h); await W(h, 1200);
      const g = await h.evaluate(() => ({ me: document.querySelector(".topbar-me .avatar-rate")?.textContent ?? null, bots: document.querySelectorAll(".opp .avatar-rate").length }));
      check("oyun masasında kendi rozetin (77) var, bilgisayar oyuncularında rozet yok", g.me === "77" && g.bots === 0, JSON.stringify(g));
      await h.context().close();
    }
    // Profil resmi: uygulamada yükleme yok; Facebook hesabında Facebook resmi, e-postada baş harf
    for (const [method, stored, want] of [["facebook", "https://example.com/fb.jpg", "photo"], ["email", "https://example.com/fb.jpg", "letter"], ["facebook", "data:image/jpeg;base64,AAAA", "letter"]]) {
      const h = await fresh(browser, "Pixel 7 landscape", { played: 10, won: 6 });
      await h.evaluate(([m, ph]) => { localStorage.setItem("wordokey.account", JSON.stringify({ method: m })); localStorage.setItem("wordokey.avatar", ph); }, [method, stored]);
      await h.reload(); await W(h, 800); if (await h.locator(".splash-hit").count()) await h.locator(".splash-hit").tap(); await W(h, 400);
      await h.locator(".hub-rate").tap(); await W(h, 400);
      const r = await h.evaluate(() => { const a = document.querySelector(".profile-banner .avatar"); return { photo: a.classList.contains("avatar-photo"), bg: a.style.backgroundImage, letter: a.firstChild?.nodeType === 3 ? a.firstChild.textContent : "", camera: document.body.innerText.includes("📷") || !!document.querySelector(".profile-modal input[type=file]"), left: localStorage.getItem("wordokey.avatar") }; });
      const ok = !r.camera && (want === "photo" ? r.photo && r.bg.includes("fb.jpg") : !r.photo && r.letter === "Y") && (stored.startsWith("data:") ? r.left === null : true);
      check(`profil resmi (${method}${stored.startsWith("data:") ? ", eskiden yüklenmiş resim" : ""}): ${want === "photo" ? "Facebook resmi" : "adın baş harfi"}, fotoğraf değiştirme yok`, ok, JSON.stringify(r));
      await h.context().close();
    }
    // Kazanınca çip yağmuru: çipler ödül yazısına uçar, yazı 0'dan ödüle sayar; kaybedince yok
    for (const win of [true, false]) {
      const h = await fresh(browser, "Pixel 7 landscape", { played: 10, won: 6 });
      await TABLES[0].open(h); await W(h, 1200);
      await h.evaluate((w) => { const g = JSON.parse(localStorage.getItem("cinali.game")); g.state.history = [g.state.players.map((_, i) => (i === (w ? 0 : 1) ? 150 : 20))]; g.state.results = [{ winner: w ? 0 : 1, colorWin: null }]; g.state.phase = "gameOver"; g.state.handNo = g.state.totalHands; localStorage.setItem("cinali.game", JSON.stringify(g)); const _set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k !== "cinali.game") _set.call(this, k, v); }; }, win);
      await h.reload(); await W(h, 700); if (await h.locator(".splash-hit").count()) await h.locator(".splash-hit").tap(); await W(h, 400);
      await h.locator(".hub-right .primary.big").first().tap(); await W(h, 700);
      const mid = await h.evaluate(() => ({ chips: document.querySelectorAll(".fly-chip").length, banner: document.querySelector(".win-kumbara")?.textContent ?? "" }));
      await W(h, 2800);
      const end = await h.evaluate(() => ({ chips: document.querySelectorAll(".fly-chip").length, banner: document.querySelector(".win-kumbara")?.textContent ?? "", pop: !!document.querySelector(".win-pop"), table: !!document.querySelector(".modal .score-table, .modal table"), winnerLine: !!document.querySelector(".modal p.winner") }));
      if (win) check("kazanınca kart yerine Kumbara: çipler Kumbara'ya akıyor, bakiye 49.900 → 50.300 sayarak artıyor, sonra temizleniyor", mid.chips > 10 && !mid.banner.includes("+400") && end.banner.includes("Tebrikler") && end.banner.includes("50.300") && end.banner.includes("+400") && end.pop && end.chips === 0 && !end.table && !end.winnerLine, JSON.stringify({ mid, end }));
      else check("kaybedince çip yağmuru yok", mid.chips === 0 && end.chips === 0 && !end.pop, JSON.stringify({ mid, end }));
      check(`çip yağmuru (${win ? "kazanınca" : "kaybedince"}): tarayıcı hatası yok`, !h.errors.length, h.errors.slice(0, 2).join(" | "));
      await h.context().close();
    }
    // Toplam kazanılan çip: kendi profilinde (hayatı boyunca), rakip kartında; bilgisayar oyuncusunda "–"
    {
      const h = await fresh(browser, "Pixel 7 landscape", { played: 10, won: 6 });
      await h.evaluate(() => { const st = JSON.parse(localStorage.getItem("wordokey.stats")); st.chipsWon = 12345; localStorage.setItem("wordokey.stats", JSON.stringify(st)); });
      await h.locator(".hub-rate").tap(); await W(h, 400);
      const mine = (await h.locator(".profile-modal .total-chips").innerText().catch(() => "")).replace(/\n/g, " ");
      check("profilde 'Toplam kazanılan çip: 12.345'", mine.includes("Toplam kazanılan çip") && mine.includes("12.345"), mine);
      await h.locator(".profile-close").tap(); await W(h, 300);
      await TABLES[0].open(h); await W(h, 1200);
      await h.locator(".opp .avatar").first().tap(); await W(h, 400);
      const bot = (await h.locator(".profile-modal .total-chips").innerText().catch(() => "")).replace(/\n/g, " ");
      check("bilgisayar oyuncusunun kartında 'Toplam kazanılan çip: –'", bot.includes("Toplam kazanılan çip") && bot.includes("–"), bot);
      await h.context().close();
    }
    // Çayhane: üç masa (25 → 100, 50 → 200, 100 → 400), menüde "Giriş 25 – 100"
    {
      const h = await fresh(browser, "Pixel 7 landscape", { played: 0, won: 0 });
      const sub = (await h.locator(".cayhane-hub .caylak-sub").innerText()).replace(/\s+/g, " ");
      await h.locator(".cayhane-hub").tap(); await W(h, 400);
      const opts = (await h.locator(".cayhane-lobby .vip-stake button").allInnerTexts()).map((x) => x.replace(/\s+/g, " ").trim());
      const fit = await h.evaluate(() => { const r = document.querySelector(".cayhane-lobby .lobby-info").getBoundingClientRect(); return r.right <= innerWidth && r.bottom <= innerHeight; });
      check("Çayhane menüde 'Giriş 25 – 100'; lobide 25→100, 50→200, 100→400 (yeni oyuncu da oturabilir)", /25.*100/.test(sub) && opts.length === 3 && /25.*100/.test(opts[0]) && /50.*200/.test(opts[1]) && /100.*400/.test(opts[2]) && fit && (await h.locator(".cayhane-lobby .sosyete-sit").count()) === 1, JSON.stringify({ sub, opts, fit }));
      await h.context().close();
    }
    // Arkadaşla oyna yalnızca VIP Oda, Sosyete ve Fifty Cent'te: Çayhane ve Çarli bekleme masasında davet yok
    {
      const h = await fresh(browser, "Pixel 7 landscape", { played: 10, won: 9 });
      const seats = async () => h.evaluate(() => ({ invite: document.querySelectorAll(".invite-seat:not(.empty-seat)").length, empty: document.querySelectorAll(".invite-seat.empty-seat").length, text: [...document.querySelectorAll(".invite-seat")].map((x) => x.textContent).join("|") }));
      await h.locator(".cayhane-hub").tap(); await W(h, 400);
      check("Çayhane lobisinde 'Arkadaşla oyna' yok", (await h.locator(".sosyete-friend, .two-choices").count()) === 0);
      await h.locator(".cayhane-lobby .sosyete-sit").tap(); await W(h, 500);
      const cay = await seats();
      check("Çayhane bekleme masası: davet yok, 3 koltuk 'Bekleniyor'", cay.invite === 0 && cay.empty === 3 && cay.text.includes("Bekleniyor"), JSON.stringify(cay));
      await h.locator(".leave-round").tap(); await W(h, 400);
      await h.locator(".carli-hub").tap(); await W(h, 400);
      check("Çarli lobisinde 'Arkadaşla oyna' yok", (await h.locator(".sosyete-friend, .two-choices").count()) === 0);
      await h.locator(".carli-lobby .sosyete-sit").tap(); await W(h, 500);
      const car = await seats();
      check("Çarli bekleme masası: davet yok, 3 koltuk 'Bekleniyor'", car.invite === 0 && car.empty === 3, JSON.stringify(car));
      await h.locator(".leave-round").tap(); await W(h, 400);
      await h.locator(".ozel-hub").tap(); await W(h, 400);
      await h.locator(".two-choices button").nth(1).tap(); await W(h, 500);
      const oz = await seats();
      check("Fifty Cent 'Arkadaşla oyna': davet koltuğu var", oz.invite === 1 && oz.empty === 0, JSON.stringify(oz));
      await h.context().close();
    }
    // Mağaza ve Kurallar: Pratik gibi sarı, yazı siyah
    {
      const h = await fresh(browser, "Pixel 7 landscape", { played: 10, won: 6 });
      const r = await h.evaluate(() => Object.fromEntries([".practice-hub", ".shop-hub", ".rules-hub"].map((k) => { const c = getComputedStyle(document.querySelector(k)); return [k, [c.backgroundColor, c.backgroundImage, c.color]]; })));
      check("Mağaza ve Kurallar Pratik ile aynı sarı, yazı siyah", r[".shop-hub"][0] === r[".practice-hub"][0] && r[".rules-hub"][0] === r[".practice-hub"][0] && r[".shop-hub"][1] === "none" && r[".rules-hub"][1] === "none" && r[".shop-hub"][2] === "rgb(17, 17, 17)" && r[".rules-hub"][2] === "rgb(17, 17, 17)", JSON.stringify(r));
      await h.context().close();
    }
    // Masaya selam hazır mesajı: her masada yalnızca o masanınki, en başta, el sallayan yüzle
    for (const [name, want, others] of [["Çayhane 25", "Hello Çayhane", ["Hello Sosyete", "Hello Çarli", "Hello Fifty Cent"]], ["Çarli 100", "Hello Çarli", ["Hello Çayhane"]], ["Fifty Cent 100", "Hello Fifty Cent", ["Hello Çayhane"]], ["Sosyete 100", "Hello Sosyete", ["Hello Çayhane"]]]) {
      const h = await fresh(browser, "Pixel 7 landscape", { played: 10, won: 9 });
      await TABLES.find((x) => x.name === name).open(h); await W(h, 1500);
      await h.locator(".chat-room-btn").first().tap(); await W(h, 400);
      const msgs = await h.evaluate(() => [...document.querySelectorAll(".chat-msgs button")].map((x) => ({ t: x.textContent.trim(), face: !!x.querySelector(".hello-face") })));
      await h.locator(".chat-msgs .chat-hello").tap(); await W(h, 400);
      const bubble = await h.evaluate(() => [...document.querySelectorAll(".bubble, .chat-bubble")].some((x) => x.querySelector(".hello-face")));
      check(`${name}: hazır mesajlarda en başta '${want}' + el sallayan yüz, başka masanın selamı yok; balonda da yüz`, msgs[0]?.t === want && msgs[0]?.face && !msgs.some((m) => others.includes(m.t)) && bubble, JSON.stringify(msgs.slice(0, 2)));
      await h.context().close();
    }
    // Emoji şeridi: 13 emoji, kaydırma yok, hepsi tek satırda ekrana sığıyor (farklı telefonlarda)
    for (const d of ["Pixel 7 landscape", "Galaxy S8 landscape", "iPhone SE landscape"]) {
      const h = await fresh(browser, d, { played: 10, won: 9 });
      await TABLES[0].open(h); await W(h, 1500);
      await h.locator(".chat-room-btn").first().tap(); await W(h, 400);
      const r = await h.evaluate(() => { const c = document.querySelector(".chat-emojis"); const cr = c.getBoundingClientRect(); const bs = [...c.querySelectorAll("button")]; return { list: bs.map((x) => x.textContent).join(""), visible: bs.filter((x) => { const q = x.getBoundingClientRect(); return q.left >= cr.left - 1 && q.right <= cr.right + 1 && q.top >= cr.top - 1 && q.bottom <= cr.bottom + 1; }).length, scroll: c.scrollWidth > c.clientWidth + 1, rows: new Set(bs.map((x) => Math.round(x.getBoundingClientRect().top))).size, size: parseFloat(getComputedStyle(bs[0]).fontSize) }; });
      check(`emoji şeridi (${d}): 13 emoji, hepsi görünüyor, kaydırma yok, tek satır`, r.list === "😂😮😅😢😡👍👏👋👌✌️🙏❤️🔥" && r.visible === 13 && !r.scroll && r.rows === 1, JSON.stringify(r));
      await h.context().close();
    }
    // "Seri olalım lütfen" hazır mesajı kaldırıldı
    {
      const h = await fresh(browser, "Pixel 7 landscape", { played: 10, won: 9 });
      await TABLES[0].open(h); await W(h, 1500);
      await h.locator(".chat-room-btn").first().tap(); await W(h, 400);
      const msgs = await h.locator(".chat-msgs button").allInnerTexts();
      check("hazır mesajlarda 'Seri olalım lütfen' yok (11 mesaj)", !msgs.some((m) => m.includes("Seri olalım")) && msgs.length === 11, msgs.join(" | "));
      await h.context().close();
    }
    // Ücretsiz destek: çipi biten oyuncuya 12 saat sonra 99 çip kendiliğinden yüklenir (düğme yok)
    {
      const h = await fresh(browser, "Pixel 7 landscape", { played: 10, won: 4 });
      await h.evaluate(() => { const w = JSON.parse(localStorage.getItem("cinali.wallet")); w.balance = 10; w.brokeSince = Date.now() - 3 * 3600_000; localStorage.setItem("cinali.wallet", JSON.stringify(w)); });
      await h.reload(); await W(h, 800); if (await h.locator(".splash-hit").count()) await h.locator(".splash-hit").tap(); await W(h, 500);
      const wait = await h.locator(".refill-wait").innerText().catch(() => "");
      check("çipi biten oyuncu: '9 sa .. dk sonra kumbarana 99 çip ücretsiz yüklenecek' yazıyor", /99 çip ücretsiz yüklenecek/.test(wait) && /8 sa|9 sa/.test(wait), wait);
      await h.evaluate(() => { const w = JSON.parse(localStorage.getItem("cinali.wallet")); w.brokeSince = Date.now() - 12.1 * 3600_000; localStorage.setItem("cinali.wallet", JSON.stringify(w)); });
      await h.reload(); await W(h, 800); if (await h.locator(".splash-hit").count()) await h.locator(".splash-hit").tap(); await W(h, 900);
      const r = await h.evaluate(() => ({ bal: JSON.parse(localStorage.getItem("cinali.wallet")).balance, toast: document.querySelector(".toast")?.textContent ?? "", button: [...document.querySelectorAll("button")].some((b) => /Ücretsiz çipini al/.test(b.textContent)) }));
      check("12 saat dolunca düğmeye basmadan kumbaraya 99 çip yüklendi (10 → 109), '3 oyun hakkın var' bildirimi", r.bal === 109 && /99 çip yüklendi/.test(r.toast) && /3 oyun/.test(r.toast) && !r.button, JSON.stringify(r));
      await h.context().close();
    }
    // VIP üyelik fiyatı: haftalık 399 ₺ (mağaza kartı ve otomatik yenileme notu)
    {
      const h = await fresh(browser, "Pixel 7 landscape", { played: 10, won: 9 });
      await h.locator(".kumbara-balance").tap(); await W(h, 600);
      const txt = await h.evaluate(() => document.body.innerText);
      check("VIP üyelik haftalık ₺ 399 (eski ₺ 299 yok)", /₺ 399/.test(txt) && !/₺ 299(?![,.]\d)/.test(txt) && /399 \/ hafta/.test(txt), (txt.match(/[^\n]*399[^\n]*/g) || []).slice(0, 2).join(" | "));
      await h.context().close();
    }
    // Sosyete düğmesinde siyah araba (çizim); Sosyete lobisinde kırmızı araba kalır
    {
      const h = await fresh(browser, "Pixel 7 landscape", { played: 10, won: 9 });
      const btn = await h.evaluate(() => ({ svg: !!document.querySelector(".usta-hub .car-icon"), emoji: document.querySelector(".usta-hub").textContent.includes("🚘") }));
      await h.locator(".usta-hub").tap(); await W(h, 400);
      const lobby = (await h.locator(".sosyete-lobby .vip-search-seat").innerText().catch(() => ""));
      check("Sosyete düğmesinde siyah araba, lobide kırmızı araba (🚘)", btn.svg && !btn.emoji && lobby.includes("🚘"), JSON.stringify({ btn, lobby }));
      await h.locator(".leave-round").tap(); await W(h, 300);
      const pos = await h.evaluate(() => { const b = document.querySelector(".usta-hub").getBoundingClientRect(); const c = (q) => { const r = document.querySelector(q).getBoundingClientRect(); return Math.round(r.left + r.width / 2 - (b.left + b.width / 2)); }; return { chatText: c(".usta-hub .chat-text"), name: c(".usta-hub .sosyete-name") }; });
      check("Sosyete düğmesi: 'Ücretsiz sohbet' yazısı tam ortada, 'Sosyete' yazısı ortaya yakın", Math.abs(pos.chatText) <= 2 && Math.abs(pos.name) <= 8, JSON.stringify(pos));
      await h.context().close();
    }
    // Sosyete düğmesinde "PROF." (Profesyonel kısaltıldı)
    {
      const h = await fresh(browser, "Pixel 7 landscape", { played: 10, won: 6 });
      const tag = (await h.locator(".usta-hub .pro-tag:not(.chat-tag)").innerText()).trim();
      check("Sosyete etiketi kısaltıldı: PROF.", tag === "PROF.", tag);
      await h.context().close();
    }
    // Başarı oranı halkası: ana menüde ve profilde, seviyesinin renginde
    for (const [won, tier, color] of [[2, "Çayhane", "#ff7a1a"], [4, "Çarli", "#f5c518"], [6, "Fifty Cent", "#2ecc71"], [8, "Sosyete", "#e53935"]]) {
      const h = await fresh(browser, "iPhone SE landscape", { played: 10, won });
      const r = await h.evaluate(() => { const b = document.querySelector(".hub-rate"); const c = b?.querySelectorAll("circle")[1]; const x = b?.getBoundingClientRect(); return { text: b?.textContent ?? "", stroke: c?.getAttribute("stroke"), fit: x ? x.right <= innerWidth && x.bottom <= innerHeight : false }; });
      check(`menüde (Profilim düğmesinde) başarı oranı halkası %${won * 10}: ${tier}, renk ${color}, "oyuncusu" yazmıyor`, r.text.includes(`%${won * 10}`) && r.text.includes(tier) && !r.text.includes("oyuncusu") && r.stroke === color && r.fit, JSON.stringify(r));
      await h.locator(".hub-rate").tap(); await W(h, 400);
      const card = await h.locator(".rate-card").innerText().catch(() => "");
      check(`profilde başarı oranı kartı %${won * 10} (${tier}), "oyuncusu" yazmıyor`, card.includes(tier) && !card.includes("oyuncusu") && card.includes(`10 oyunda ${won} galibiyet`), card.replace(/\n/g, " · "));
      await h.context().close();
    }
    // Çarli'de yalnızca Otur (arkadaş düğmesi yok)
    const c = await fresh(browser, "Pixel 7 landscape", { played: 25, won: 19 });
    await c.locator(".carli-hub").tap(); await W(c, 400);
    check("Çarli'de 'Arkadaşla oyna' düğmesi yok (yalnızca Otur)", (await c.locator(".sosyete-friend").count()) === 0 && (await c.locator(".carli-lobby .sosyete-sit").count()) === 1);
    await c.context().close();
  }
  {
    // Yeni oyuncu (hiç oyun yok, %0) de oturamaz; Çayhane ve Fifty Cent serbest
    const p = await fresh(browser, "Pixel 7 landscape", { played: 0, won: 0 });
    await p.locator(".usta-hub").tap(); await W(p, 400);
    for (const d of ["iPhone SE landscape", "Galaxy S8 landscape"]) {
      const q = await fresh(browser, d, { played: 12, won: 7 });
      await q.locator(".usta-hub").tap(); await W(q, 400);
      const r = await q.evaluate(() => { const g = (x) => document.querySelector(x).getBoundingClientRect(); const i = g(".lobby-info"), h = g(".vip-search-seat"), m = g(".lobby-me"); return { top: i.top - h.bottom, bot: m.top - i.bottom }; });
      check(`Sosyete uyarısı (${d}): başlık ve oyuncu rozetiyle çakışmıyor`, r.top >= 0 && r.bot >= 0, JSON.stringify(r));
      await q.context().close();
    }
    check("yeni oyuncu (%0) Sosyete'ye oturamaz", (await p.locator(".sosyete-sit").count()) === 0 && (await p.locator(".rate-block").count()) === 1);
    await p.locator(".leave-round").tap(); await W(p, 300);
    await TABLES[0].open(p); await W(p, 1000);
    check("yeni oyuncu Çayhane'ye oturabilir", (await game(p))?.tableId === "caylak");
    await p.context().close();
  }
  }

  if (want("7b")) {
  console.log("\n== 7b. Fifty Cent giriş şartı: başarı oranı en az %50 (7 dil)");
  for (const lang of LANGS) {
    // %49 (100 oyunda 49): oyun seçenekleri yerine uyarı; oyun açılmaz, çip alınmaz
    const p = await fresh(browser, "Pixel 7 landscape", { lang, played: 100, won: 49 });
    const b0 = await bal(p);
    await p.locator(".ozel-hub").tap(); await W(p, 400);
    const r = await p.evaluate(() => ({ choices: document.querySelectorAll(".ozel-lobby .two-choices button").length, text: document.querySelector(".ozel-lobby .rate-block")?.textContent ?? "" }));
    check(`Fifty Cent (${lang}) %49: oyun düğmeleri yok, uyarı var (%50 ve %49 yazıyor)`, r.choices === 0 && r.text.includes("50") && r.text.includes("49"), r.text.slice(0, 80));
    await p.locator(".leave-round").tap(); await W(p, 300);
    check(`Fifty Cent (${lang}) %49: oyun açılmadı, çip alınmadı`, !(await game(p)) && (await bal(p)) === b0);
    await p.context().close();
    // %50 (2 oyunda 1): oturur
    const q = await fresh(browser, "Pixel 7 landscape", { lang, played: 2, won: 1 });
    await TABLES.find((x) => x.name === "Fifty Cent 100").open(q); await W(q, 1200);
    check(`Fifty Cent (${lang}) %50: oturabilir, oyun başladı`, (await game(q))?.tableId === "ozel2" && (await bal(q)) === 50000 - 100);
    check(`Fifty Cent (${lang}): tarayıcı hatası yok`, !p.errors.length && !q.errors.length, [...p.errors, ...q.errors].slice(0, 2).join(" | "));
    await q.context().close();
  }
  for (const d of ["iPhone SE landscape", "Galaxy S8 landscape"]) {
    const q = await fresh(browser, d, { played: 100, won: 49 });
    await q.locator(".ozel-hub").tap(); await W(q, 400);
    const r = await q.evaluate(() => { const g = (x) => document.querySelector(x).getBoundingClientRect(); const i = g(".ozel-lobby .lobby-info"), h = g(".ozel-lobby .vip-search-seat"), m = g(".ozel-lobby .lobby-me"); return { top: i.top - h.bottom, bot: m.top - i.bottom }; });
    check(`Fifty Cent uyarısı (${d}): başlık ve oyuncu rozetiyle çakışmıyor`, r.top >= 0 && r.bot >= 0, JSON.stringify(r));
    await q.context().close();
  }
  {
    const p = await fresh(browser, "Pixel 7 landscape", { played: 0, won: 0 });
    await p.locator(".ozel-hub").tap(); await W(p, 400);
    check("yeni oyuncu (%0) Fifty Cent'e oturamaz", (await p.locator(".ozel-lobby .two-choices button").count()) === 0 && (await p.locator(".ozel-lobby .rate-block").count()) === 1);
    await p.context().close();
  }
  }

  if (want("7c")) {
  console.log("\n== 7c. Çarli giriş şartı: başarı oranı en az %31 (7 dil)");
  for (const lang of LANGS) {
    // %30 (10 oyunda 3): oturma düğmesi yerine uyarı; oyun açılmaz, çip alınmaz
    const p = await fresh(browser, "Pixel 7 landscape", { lang, played: 10, won: 3 });
    const b0 = await bal(p);
    await p.locator(".carli-hub").tap(); await W(p, 400);
    const r = await p.evaluate(() => ({ sit: !!document.querySelector(".carli-lobby .sosyete-sit"), text: document.querySelector(".carli-lobby .rate-block")?.textContent ?? "", dice: !!document.querySelector(".carli-lobby .dice-icon") }));
    check(`Çarli (${lang}) %30: oturma düğmesi yok, uyarı var (%31 ve %30 yazıyor)`, !r.sit && r.text.includes("31") && r.text.includes("30") && r.dice, r.text.slice(0, 80));
    await p.locator(".leave-round").tap(); await W(p, 300);
    check(`Çarli (${lang}) %30: oyun açılmadı, çip alınmadı`, !(await game(p)) && (await bal(p)) === b0);
    const dice = await p.evaluate(() => { const d = document.querySelector(".carli-hub .dice-icon"); return d ? d.querySelectorAll("circle").length : 0; });
    check(`Çarli düğmesi (${lang}): iki zar, ikisi de 4 (8 nokta)`, dice === 8, String(dice));
    await p.context().close();
    // %31 (100 oyunda 31): oturur, 4 kişilik, en az 3 harf
    const q = await fresh(browser, "Pixel 7 landscape", { lang, played: 100, won: 31 });
    await TABLES.find((x) => x.name === "Çarli 100").open(q); await W(q, 1200);
    const g = await game(q);
    check(`Çarli (${lang}) %31: oturabilir, 4 kişilik, en az 3 harf`, g?.tableId === "carli" && g?.state.players.length === 4 && g?.state.minWord === 3 && (await bal(q)) === 50000 - 100);
    check(`Çarli (${lang}): tarayıcı hatası yok`, !p.errors.length && !q.errors.length, [...p.errors, ...q.errors].slice(0, 2).join(" | "));
    await q.context().close();
  }
  for (const d of ["iPhone SE landscape", "Galaxy S8 landscape"]) {
    const q = await fresh(browser, d, { played: 10, won: 3 });
    await q.locator(".carli-hub").tap(); await W(q, 400);
    const r = await q.evaluate(() => { const g = (x) => document.querySelector(x).getBoundingClientRect(); const i = g(".carli-lobby .lobby-info"), h = g(".carli-lobby .vip-search-seat"), m = g(".carli-lobby .lobby-me"); return { top: i.top - h.bottom, bot: m.top - i.bottom }; });
    check(`Çarli uyarısı (${d}): başlık ve oyuncu rozetiyle çakışmıyor`, r.top >= 0 && r.bot >= 0, JSON.stringify(r));
    await q.context().close();
  }
  {
    // %30 oyuncu Çayhane'de oynar
    const p = await fresh(browser, "Pixel 7 landscape", { played: 10, won: 3 });
    await TABLES[0].open(p); await W(p, 1000);
    check("%30 oyuncu Çayhane'de oynayabilir", (await game(p))?.tableId === "caylak");
    await p.context().close();
  }
  }

  if (want("8")) {
  console.log("\n== 8. Sosyete sohbetli masa (ücretsiz, küfür filtreli)");
  const CHAT = { tr: "Ücretsiz sohbet", en: "Free chat", de: "Gratis-Chat", fr: "Chat gratuit", es: "Chat gratis", it: "Chat gratis", pt: "Chat grátis" };
  for (const lang of LANGS) {
    const p = await fresh(browser, "Pixel 7 landscape", { lang });
    // Ekranda büyük harfle gösterilir; asıl metin (textContent) karşılaştırılır (Türkçe İ/i farkı)
    const tag = await p.locator(".usta-hub .chat-tag").textContent().catch(() => "");
    check(`Sosyete düğmesi (${lang}): "${CHAT[lang]}" etiketi`, (tag ?? "").includes(CHAT[lang]), tag ?? "");
    await p.context().close();
  }
  {
    // Yetişkin: ilk girişte sohbet kuralları onayı; oyunda serbest yazı kutusu
    const p = await fresh(browser, "Pixel 7 landscape");
    await p.evaluate(() => localStorage.removeItem("wordokey.vipTerms"));
    await p.locator(".usta-hub").tap(); await W(p, 400);
    check("Sosyete ilk girişte sohbet kuralları penceresi", (await p.locator(".vip-terms").count()) === 1 && /Sosyete/.test(await p.locator(".vip-terms h3").innerText()));
    await p.locator(".vip-terms .primary").tap(); await W(p, 300);
    check("lobide 'Sohbetli oyun · ücretsiz' etiketi", /Sohbetli oyun/.test(await p.locator(".sosyete-lobby .vip-chat-tag").innerText().catch(() => "")));
    await p.locator(".sosyete-sit").tap(); await W(p, 300); await p.locator(".lobby-panel .primary").tap(); await W(p, 1500);
    await p.locator(".chat-room-btn").first().tap(); await W(p, 400);
    check("Sosyete oyununda serbest yazı kutusu var (yetişkin)", (await p.locator(".chat-panel input, .chat-text input, input[type=text]").count()) > 0);
    check("tarayıcı hatası yok", !p.errors.length, p.errors.slice(0, 2).join(" | "));
    await p.context().close();
    // Fifty Cent ve Çayhane'de serbest yazı yok (yalnızca hazır mesaj ve emoji)
    for (const tb of [TABLES.find((x) => x.name === "Fifty Cent 100"), TABLES[0]]) {
      const q = await fresh(browser, "Pixel 7 landscape");
      await tb.open(q); await W(q, 1500);
      await q.locator(".chat-room-btn").first().tap().catch(() => {}); await W(q, 400);
      check(`${tb.name}: serbest yazı kutusu yok`, (await q.locator("input[type=text]").count()) === 0);
      await q.context().close();
    }
    // 18 yaş altı: Sosyete'de oynar ama yazamaz
    const m = await fresh(browser, "Pixel 7 landscape");
    await m.evaluate(() => localStorage.setItem("wordokey.birthYear", "2012")); await m.reload(); await W(m, 600);
    if (await m.locator(".splash-hit").count()) await m.locator(".splash-hit").tap(); await W(m, 400);
    await m.locator(".usta-hub").tap(); await W(m, 400);
    await m.locator(".sosyete-sit").tap(); await W(m, 300); await m.locator(".lobby-panel .primary").tap(); await W(m, 1500);
    await m.locator(".chat-room-btn").first().tap().catch(() => {}); await W(m, 400);
    check("18 yaş altı Sosyete'de oynar ama serbest yazamaz", (await game(m))?.tableId === "usta" && (await m.locator("input[type=text]").count()) === 0);
    await m.context().close();
  }
  }

  if (want("9")) {
  console.log("\n== 9. Hamle süresi: bütün masalarda (VIP dahil) 60 sn");
  for (const [name, secs] of [["Çayhane 25", 60], ["Çayhane 50", 60], ["Çayhane", 60], ["Çarli 100", 60], ["Çarli 200", 60], ["Çarli 300", 60], ["Fifty Cent 100", 60], ["Fifty Cent 1000", 60], ["Fifty Cent 10000", 60], ["Sosyete 100", 60], ["Sosyete 1000", 60], ["Sosyete 10000", 60], ["VIP", 60]]) {
    const ctx = await browser.newContext({ ...devices["Pixel 7 landscape"] });
    const p = await ctx.newPage(); p.errors = []; p.on("pageerror", (e) => p.errors.push(e.message));
    await p.clock.install();
    await p.goto(BASE);
    await p.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("wordokey.account", '{"method":"guest"}'); localStorage.setItem("wordokey.birthYear", "1980"); localStorage.setItem("wordokey.vipTerms", "2026-11-24"); localStorage.setItem("wordokey.welcomeSeen", "1");
      localStorage.setItem("wordokey.stats", JSON.stringify({ gamesPlayed: 10, gamesWon: 9, gamesLost: 1 }));
      localStorage.setItem("cinali.settings", JSON.stringify({ name: "Yılmaz", uiLang: "tr", gameLang: "tr", music: false, sound: false, gender: "erkek" }));
      localStorage.setItem("cinali.wallet", JSON.stringify({ balance: 50000, vipUntil: Date.now() + 864e5 * 5, lastDaily: new Date().toISOString().slice(0, 10) }));
    });
    await p.reload(); await p.clock.runFor(900); if (await p.locator(".splash-hit").count()) await p.locator(".splash-hit").tap(); await p.clock.runFor(400);
    await TABLES.find((x) => x.name === name).open(p); await p.clock.runFor(1200);
    // Sıra oyuncuda (çekme aşaması)
    await p.evaluate(() => { const g = JSON.parse(localStorage.getItem("cinali.game")); const me = g.state.players.findIndex((x) => !x.isBot); g.state.current = me; g.state.phase = "draw"; g.state.turnPlays = 0; localStorage.setItem("cinali.game", JSON.stringify(g)); const _set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k !== "cinali.game") _set.call(this, k, v); }; });
    await p.reload(); await p.clock.runFor(900); if (await p.locator(".splash-hit").count()) await p.locator(".splash-hit").tap(); await p.clock.runFor(400);
    await p.locator(".hub-right .primary.big").first().tap(); await p.clock.runFor(1500);
    const saved = JSON.parse(await p.evaluate(() => localStorage.getItem("cinali.game")));
    const left = Number((await p.locator(".timer-badge").innerText().catch(() => "")).replace(/\D/g, ""));
    check(`${name}: hamle süresi ${secs} sn (kayıtta ${saved.settings.turnSeconds}, ekranda ⏱ ${left})`, saved.settings.turnSeconds === secs && left <= secs && left >= secs - 3);
    // Süre dolmadan sıra değişmez; dolunca otomatik hamle yapılır (taş çekilip atılır)
    // Oyuncunun attığı taş sayısı oyun kaydından (sonraki oyuncu yandan alabilir; atılanlar yığınına bakılmaz)
    const myDiscards = async () => p.evaluate(() => { const g = JSON.parse(localStorage.getItem("cinali.game")); const me = g.state.players.findIndex((x) => !x.isBot); const name = g.state.players[me].name; return { n: g.state.log.filter((e) => e.k === "discarded" && e.p?.name === name).length, cur: g.state.current === me }; });
    const d0 = await myDiscards();
    await p.clock.runFor((secs - 10) * 1000);
    const mid = Number((await p.locator(".timer-badge").innerText().catch(() => "")).replace(/\D/g, ""));
    const d1 = await myDiscards();
    await p.clock.runFor(15 * 1000);
    // Yavaş makinede kayıt gecikebilir: kısa gerçek bekleme ile birkaç kez yokla
    let d2 = await myDiscards();
    for (let k = 0; k < 10 && d2.n === d0.n; k++) { await p.clock.runFor(1000); await p.waitForTimeout(300); d2 = await myDiscards(); }
    check(`${name}: ${secs - 10}. saniyede sıra hâlâ oyuncuda (⏱ ${mid}), süre dolunca otomatik taş atıldı`, d1.cur && d1.n === d0.n && mid <= 11 && mid >= 8 && d2.n === d0.n + 1, `atılan ${d0.n} → ${d1.n} → ${d2.n}`);
    check(`${name}: tarayıcı hatası yok`, !p.errors.length, p.errors.slice(0, 2).join(" | "));
    await ctx.close();
  }
  }

  await browser.close();
  console.log(fails ? `\n✗ ${fails} DENETİM BAŞARISIZ` : "\nHEPSİ GEÇTİ");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
