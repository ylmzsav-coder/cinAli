/**
 * Uçtan uca (tarayıcı) testleri: derlenmiş oyunu gerçek bir tarayıcıda oynar ve denetler.
 *   npm run build && npx vite preview --port 4173 &  node tests/e2e/run.cjs
 * Herhangi bir denetim başarısız olursa çıkış kodu 1 olur (CI kırmızı yanar, e-posta uyarısı gider).
 */
const { chromium, devices } = require("playwright");
const BASE = process.env.E2E_URL || "http://127.0.0.1:4173/";
const LANGS = ["tr", "en", "de", "fr", "es", "it", "pt"];
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
  ...[0, 1, 2].map((i) => ({ name: `Sosyete ${[500, 1000, 5000][i]}`, entry: [500, 1000, 5000][i], prize: [2000, 4000, 20000][i], n: 4, open: async (p) => { await p.locator(".usta-hub").tap(); await W(p, 300); await p.locator(".sosyete-lobby .vip-stake button").nth(i).tap(); await p.locator(".sosyete-sit").tap(); await W(p, 300); await p.locator(".lobby-panel .primary").tap(); } })),
  ...[0, 1, 2].map((i) => ({ name: `Teke Tek ${[100, 250, 500][i]}`, entry: [100, 250, 500][i], prize: [200, 500, 1000][i], n: 2, open: async (p) => { await p.locator(".ozel-hub").tap(); await W(p, 300); await p.locator(".ozel-stake button").nth(i).tap(); await p.locator(".two-choices button").nth(2).tap(); } })),
  { name: "VIP", entry: 100, prize: 200, n: 2, open: async (p) => { await p.locator(".vip-hub").tap(); await W(p, 300); await p.locator(".two-choices button").nth(2).tap(); } },
];

(async () => {
  const browser = await chromium.launch();

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
    check("masalarda tarayıcı hatası yok", !p.errors.length, p.errors.slice(0, 2).join(" | "));
  }

  console.log("\n== 1b. Kimse bitiremedi (deste bitti): kaybeden yok, ücret yeni oyuna, çıkarsa iade");
  {
    const p = await fresh(browser, "Pixel 7 landscape", { balance: 1000 });
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
    const mx = Math.max(...tot);
    // Kimse bitiremediyse (deste bitti) kaybeden yok: ödeme yapılmaz, giriş ücreti yeni oyuna devreder
    const carry = !!g.carry;
    const expected = carry ? 0 : tot[0] === mx ? Math.floor(400 / tot.filter((x) => x === mx).length) : 0;
    await W(p, 600);
    check("oyun bitti ve doğru ödendi", g.state.phase === "gameOver" && (await bal(p)) === 900 + expected, `toplamlar ${tot.join("/")}, bakiye ${await bal(p)}${carry ? " (kimse bitiremedi: ücret devreder)" : ""}`);
    check("sonuç ekranı göründü", (await p.locator(".modal").count()) > 0);
    check("oyun sırasında tarayıcı hatası yok", !p.errors.length, p.errors.slice(0, 2).join(" | "));
  }

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
    const all = [pick("VIP"), pick("Teke Tek 100"), pick("Teke Tek 250"), pick("Teke Tek 500"), pick("Çayhane"), pratik, pick("Sosyete 500")];
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

  console.log("\n== 6. Kurallar sayfası: 7 dilde masa/ücret tablosu ve güncel kurallar");
  for (const lang of LANGS) {
    const p = await fresh(browser, "iPhone SE landscape", { lang });
    await p.locator(".hub-right button").filter({ hasText: /📖/ }).first().tap(); await W(p, 400);
    const r = await p.evaluate(() => ({ rows: document.querySelectorAll(".fee-table tbody tr").length, items: document.querySelectorAll("ol.rules li").length, hscroll: document.documentElement.scrollWidth > innerWidth + 2, raw: /\{[a-z]+\}/.test(document.body.innerText) }));
    await p.locator(".link").first().tap(); await W(p, 300);
    const kb = await p.evaluate(() => { const el = document.querySelector(".kumbara-balance"); return { icon: !!el?.querySelector(".kumbara-icon"), label: el?.querySelector(".kumbara-label")?.textContent ?? "" }; });
    const KB = { tr: "Kumbara", en: "Money box", de: "Spardose", fr: "Tirelire", es: "Hucha", it: "Salvadanaio", pt: "Cofrinho" };
    check(`Menü (${lang}): çipler kumbarada — resim ve "${KB[lang]}" yazısı`, kb.icon && kb.label === KB[lang], JSON.stringify(kb));
    check(`Kurallar (${lang}): 15 madde, 9 satırlık masa tablosu, taşma yok`, r.rows === 9 && r.items === 15 && !r.hscroll && !r.raw, JSON.stringify(r));
    await p.context().close();
  }

  await browser.close();
  console.log(fails ? `\n✗ ${fails} DENETİM BAŞARISIZ` : "\nHEPSİ GEÇTİ");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
