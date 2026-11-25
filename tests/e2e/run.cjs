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
  { name: "Çayhane", entry: 100, prize: 400, n: 4, open: async (p) => { await p.locator(".caylak-hub:not(.ozel-hub):not(.vip-hub):not(.usta-hub)").first().tap(); await W(p, 300); await p.locator(".lobby-panel .primary").tap(); } },
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
    const all = [pick("VIP"), pick("Fifty Cent 100"), pick("Fifty Cent 1000"), pick("Fifty Cent 10000"), pick("Çayhane"), pratik, pick("Çarli 100"), pick("Sosyete 100")];
    for (const tb of all) {
      const pro = !["Çayhane", "Pratik"].includes(tb.name);
      for (const [word, value] of WORDS) {
        await toHub(p);
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
    check(`Kurallar (${lang}): 21 madde, 12 satırlık masa tablosu, taşma yok`, r.rows === 12 && r.items === 21 && !r.hscroll && !r.raw, JSON.stringify(r));
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
        bg[".cayhane-hub"].includes("rgb(239, 108, 0)") && bg[".carli-hub"].includes("rgb(245, 197, 24)") && bg[".ozel-hub"].includes("rgb(31, 168, 90)") && bg[".usta-hub"] === bg[".close-game"], JSON.stringify(bg).slice(0, 200));
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
  for (const [name, secs] of [["Çayhane", 60], ["Çarli 100", 60], ["Fifty Cent 100", 60], ["Sosyete 100", 60], ["VIP", 60]]) {
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
