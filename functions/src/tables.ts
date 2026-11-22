/**
 * Çevrimiçi masalar: oyunu sunucu yönetir.
 *
 * Firestore:
 *  tables/{id}                 herkese açık görünüm (ıstakalar ve deste gizli) + masa bilgisi
 *  tables/{id}/hands/{uid}     her oyuncunun kendi ıstakası (yalnızca kendisi okur)
 *  tables/{id}/server/state    tam oyun durumu (yalnızca sunucu)
 *  users/{uid}.activeTable     oyuncunun oturduğu masa
 *
 * Firestore iç içe dizileri desteklemediği için oyun durumu ve görünüm JSON
 * metni olarak saklanır.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Transaction } from "firebase-admin/firestore";
import { onCall } from "firebase-functions/v2/https";
import { BotLevel, botStep } from "../../src/game/bot";
import { Dictionary } from "../../src/game/dictionary";
import {
  GameError,
  GameState,
  RULES,
  dealHand,
  discardTile,
  drawFromDeck,
  drawFromDiscard,
  extendWord,
  layWord,
  layPair,
  openPairs,
  newGame,
  openHand,
  timeoutMove,
  totals,
  colorWinsOf,
} from "../../src/game/engine";
import { LANGS, LangCode, setGameLang } from "../../src/game/lang";
import { TABLES, TableConfig, payout } from "../../src/economy/tables";
import { WalletDoc, applyTx, db, fail, uidOf, walletRef } from "./common";
import { cleanName } from "./profanity";
import { publicView, type Action, type PublicView, type SeatInfo } from "../../src/online/view";

/** Masanın başlamadan önce oyuncu beklediği süre. */
export const WAIT_MS = 8_000;
/** Hamle süresi (sunucu tarafı; istemcideki çerçeveyle aynı). */
export const TURN_MS = 45_000;
/** Ağ gecikmesi için ek süre. */
const GRACE_MS = 1_500;
/** El bittikten sonra sonraki ele geçmeden önce sonuç ekranı süresi. */
const HAND_BREAK_MS = 12_000;
const BOT_NAMES = ["Bot Ada", "Bot Deniz", "Bot Kaan", "Bot Ece", "Bot Arda", "Bot Lale"];

// ---- Sözlükler (sıcak örnekte bir kez yüklenir) -------------------------
const dicts = new Map<LangCode, Dictionary>();
function dictFor(code: LangCode): Dictionary {
  let d = dicts.get(code);
  if (!d) {
    const text = readFileSync(join(__dirname, "dict", `${code}.txt`), "utf-8");
    d = Dictionary.fromText(text, LANGS[code]);
    dicts.set(code, d);
  }
  return d;
}

// ---- Veri tipleri -------------------------------------------------------
export interface TableDoc {
  type: string;
  /** Özel (arkadaş) masası: rastgele eşleşmeye kapalı, kurucu başlatır. */
  private: boolean;
  /** Özel masanın davet kodu. */
  code: string | null;
  lang: LangCode;
  status: "waiting" | "playing" | "finished" | "abandoned";
  seats: SeatInfo[];
  /** Masadaki gerçek oyuncular (güvenlik kuralları için). */
  uids: string[];
  createdAt: number;
  startAt: number;
  /** Sıradaki insan oyuncunun ya da el arasının son anı (ms). */
  deadline: number | null;
  version: number;
  /** PublicView JSON. */
  view: string | null;
  payouts?: Record<string, number>;
}

const tableRef = (id: string) => db.collection("tables").doc(id);
const stateRef = (id: string) => tableRef(id).collection("server").doc("state");
const handRef = (id: string, uid: string) => tableRef(id).collection("hands").doc(uid);
const userRef = (uid: string) => db.collection("users").doc(uid);

function configFor(type: unknown): TableConfig {
  const c = TABLES.find((t) => t.id === type);
  if (!c) fail("badRequest", {}, "invalid-argument");
  return c;
}

function langOf(v: unknown): LangCode {
  if (typeof v === "string" && v in LANGS && LANGS[v as LangCode].playable) return v as LangCode;
  return fail("badRequest", {}, "invalid-argument");
}

/** Motor hatasını istemciye çevrilebilir hata olarak iletir. */
function engine<T>(fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    if (e instanceof GameError) fail(e.code, e.params);
    throw e;
  }
}

// ---- Oyun ilerletme -----------------------------------------------------
/** Sıra insana gelene (veya el/oyun bitene) kadar botları oynatır. */
function runBots(state: GameState, level: BotLevel): GameState {
  const dict = dictFor(state.lang);
  let guard = 0;
  while ((state.phase === "draw" || state.phase === "play") && state.players[state.current].isBot) {
    state = botStep(dict, state, level);
    if (++guard > 400) break;
  }
  return state;
}

function deadlineFor(state: GameState, now: number): number | null {
  if (state.phase === "handOver") return now + HAND_BREAK_MS;
  if (state.phase === "draw" || state.phase === "play") return now + TURN_MS;
  return null;
}

/** Oyun bittiyse insan oyunculara ödül öder (bir kez). Bot payları kasada kalır. */
async function settle(t: Transaction, table: TableDoc, state: GameState, wallets: Map<string, WalletDoc>) {
  const cfg = configFor(table.type);
  const sums = totals(state);
  const payouts: Record<string, number> = {};
  table.seats.forEach((seat, i) => {
    if (!seat.uid) return;
    const amount = payout(cfg, sums, i, colorWinsOf(state, i));
    payouts[seat.uid] = amount;
    const w = wallets.get(seat.uid);
    if (amount > 0 && w) wallets.set(seat.uid, applyTx(t, seat.uid, w, amount, "masa-odul", cfg.id));
  });
  return payouts;
}

/**
 * Masanın son durumunu yazar: açık görünüm, ıstakalar, gizli durum.
 * Oyun bittiyse ödülleri öder ve oyuncuların aktif masasını temizler.
 */
async function persist(t: Transaction, id: string, table: TableDoc, state: GameState, wallets: Map<string, WalletDoc>) {
  const now = Date.now();
  const next: TableDoc = { ...table, version: table.version + 1, deadline: deadlineFor(state, now) };
  if (state.phase === "gameOver" && table.status === "playing") {
    next.status = "finished";
    next.payouts = await settle(t, table, state, wallets);
    for (const uid of table.uids) t.set(userRef(uid), { activeTable: null }, { merge: true });
  }
  next.view = JSON.stringify(publicView(state, next.seats));
  t.set(tableRef(id), next);
  t.set(stateRef(id), { json: JSON.stringify(state) });
  table.seats.forEach((seat, i) => {
    if (seat.uid) t.set(handRef(id, seat.uid), { seat: i, rack: state.players[i].rack, version: next.version });
  });
}

/** Bir masanın hem açık belgesini hem gizli durumunu okur (işlem içinde). */
async function load(t: Transaction, id: string) {
  const [tSnap, sSnap] = await Promise.all([t.get(tableRef(id)), t.get(stateRef(id))]);
  if (!tSnap.exists) fail("tableNotFound", {}, "not-found");
  const table = tSnap.data() as TableDoc;
  const state = sSnap.exists ? (JSON.parse(sSnap.data()!.json) as GameState) : null;
  return { table, state };
}

async function walletsOf(t: Transaction, uids: string[]) {
  const snaps = await Promise.all(uids.map((u) => t.get(walletRef(u))));
  const m = new Map<string, WalletDoc>();
  snaps.forEach((s, i) => s.exists && m.set(uids[i], s.data() as WalletDoc));
  return m;
}

/** Bekleyen masayı botlarla doldurup başlatır. */
function startGame(table: TableDoc, seed: number): { table: TableDoc; state: GameState } {
  const seats = table.seats.slice();
  let b = seed % BOT_NAMES.length;
  while (seats.length < 4) seats.push({ uid: null, name: BOT_NAMES[b++ % BOT_NAMES.length], bot: true });
  setGameLang(table.lang);
  const cfg = configFor(table.type);
  let state = newGame(seats.map((s) => s.name), seats.map((s) => s.bot), cfg.hands, seed);
  state = runBots(state, cfg.level);
  return { table: { ...table, seats, status: "playing" }, state };
}

// ---- Çağrılabilir fonksiyonlar -----------------------------------------
/** Karışmayan, okunaklı davet kodu (0/O, 1/I yok). */
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function newCode(): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

/** Oyuncu zaten bir masadaysa o masanın kimliği. */
async function activeTableOf(t: Transaction, uid: string): Promise<string | null> {
  const user = (await t.get(userRef(uid))).data() ?? {};
  if (!user.activeTable) return null;
  const st = (await t.get(tableRef(user.activeTable))).data()?.status;
  return st === "waiting" || st === "playing" ? user.activeTable : null;
}

/** Arkadaşlarla oynamak için özel masa kurar; giriş ücretini alır, davet kodu döndürür. */
export const createPrivateTable = onCall(async (req) => {
  const uid = uidOf(req);
  const cfg = configFor(req.data?.type);
  const lang = langOf(req.data?.lang);
  const name = cleanName(req.data?.name, uid, lang);
  // Kod çakışmasını önlemek için birkaç deneme
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newCode();
    const taken = await db.collection("tables").where("code", "==", code).where("status", "==", "waiting").limit(1).get();
    if (!taken.empty) continue;
    return db.runTransaction(async (t) => {
      const active = await activeTableOf(t, uid);
      if (active) return { tableId: active, resumed: true, code: null };
      const w = (await t.get(walletRef(uid))).data() as WalletDoc | undefined;
      if (!w) return fail("noWallet");
      if (w.balance < cfg.entry) fail("notEnoughChips", { need: cfg.entry, have: w.balance });
      applyTx(t, uid, w, -cfg.entry, "masa-giris", cfg.id);
      const id = db.collection("tables").doc().id;
      const now = Date.now();
      const table: TableDoc = {
        type: cfg.id, private: true, code, lang, status: "waiting",
        seats: [{ uid, name, bot: false }], uids: [uid],
        createdAt: now, startAt: now + 24 * 3600_000, deadline: null, version: 0, view: null,
      };
      t.set(tableRef(id), table);
      t.set(userRef(uid), { activeTable: id }, { merge: true });
      return { tableId: id, resumed: false, code };
    });
  }
  return fail("network");
});

/** Davet koduyla özel masaya oturur. */
export const joinPrivateTable = onCall(async (req) => {
  const uid = uidOf(req);
  const code = String(req.data?.code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  const rawName = req.data?.name;
  if (code.length !== 6) fail("codeNotFound", {}, "not-found");
  return db.runTransaction(async (t) => {
    const active = await activeTableOf(t, uid);
    const found = await t.get(
      db.collection("tables").where("code", "==", code).where("status", "==", "waiting").limit(1),
    );
    if (active) return { tableId: active, resumed: true };
    const snap = found.docs[0];
    if (!snap) return fail("codeNotFound", {}, "not-found");
    const table = snap.data() as TableDoc;
    if (table.seats.length >= 4) fail("tableFull");
    const cfg = configFor(table.type);
    const w = (await t.get(walletRef(uid))).data() as WalletDoc | undefined;
    if (!w) return fail("noWallet");
    if (w.balance < cfg.entry) fail("notEnoughChips", { need: cfg.entry, have: w.balance });
    applyTx(t, uid, w, -cfg.entry, "masa-giris", cfg.id);
    const name = cleanName(rawName, uid, table.lang);
    t.set(tableRef(snap.id), {
      ...table,
      seats: [...table.seats, { uid, name, bot: false }],
      uids: [...table.uids, uid],
      version: table.version + 1,
    });
    t.set(userRef(uid), { activeTable: snap.id }, { merge: true });
    return { tableId: snap.id, resumed: false };
  });
});

/** Masaya otur: giriş ücretini alır; uygun bekleyen masa yoksa yenisini açar. */
export const joinTable = onCall(async (req) => {
  const uid = uidOf(req);
  const cfg = configFor(req.data?.type);
  const lang = langOf(req.data?.lang);
  const name = cleanName(req.data?.name, uid, lang);

  return db.runTransaction(async (t) => {
    const user = (await t.get(userRef(uid))).data() ?? {};
    if (user.activeTable) {
      const active = await t.get(tableRef(user.activeTable));
      const st = active.data()?.status;
      if (st === "waiting" || st === "playing") return { tableId: user.activeTable, resumed: true };
    }
    const w = (await t.get(walletRef(uid))).data() as WalletDoc | undefined;
    if (!w) return fail("noWallet");
    if (w.balance < cfg.entry) fail("notEnoughChips", { need: cfg.entry, have: w.balance });

    const now = Date.now();
    const open = await t.get(
      db.collection("tables")
        .where("status", "==", "waiting")
        .where("private", "==", false)
        .where("type", "==", cfg.id)
        .where("lang", "==", lang)
        .where("startAt", ">", now + 500)
        .limit(5),
    );
    const candidate = open.docs.find((d) => (d.data() as TableDoc).seats.length < 4);

    applyTx(t, uid, w, -cfg.entry, "masa-giris", cfg.id);
    let id: string;
    if (candidate) {
      id = candidate.id;
      const table = candidate.data() as TableDoc;
      const seats = [...table.seats, { uid, name, bot: false }];
      const next: TableDoc = { ...table, seats, uids: [...table.uids, uid], version: table.version + 1 };
      if (seats.length === 4) {
        const started = startGame(next, now % 1_000_000);
        await persist(t, id, started.table, started.state, new Map());
      } else {
        t.set(tableRef(id), next);
      }
    } else {
      id = db.collection("tables").doc().id;
      const table: TableDoc = {
        type: cfg.id, private: false, code: null, lang, status: "waiting",
        seats: [{ uid, name, bot: false }], uids: [uid],
        createdAt: now, startAt: now + WAIT_MS, deadline: null, version: 0, view: null,
      };
      t.set(tableRef(id), table);
    }
    t.set(userRef(uid), { activeTable: id }, { merge: true });
    return { tableId: id, resumed: false };
  });
});

/** Bekleme süresi dolan masayı botlarla başlatır (masadaki herhangi bir oyuncu çağırabilir). */
export const startTable = onCall(async (req) => {
  const uid = uidOf(req);
  const id = String(req.data?.tableId ?? "");
  return db.runTransaction(async (t) => {
    const { table } = await load(t, id);
    if (!table.uids.includes(uid)) fail("notAtTable", {}, "permission-denied");
    if (table.status !== "waiting") return { ok: true };
    if (table.private) {
      // Özel masayı yalnızca kuran kişi başlatır
      if (table.seats[0]?.uid !== uid) fail("hostOnly", {}, "permission-denied");
    } else if (Date.now() < table.startAt) fail("notYet");
    const started = startGame(table, Date.now() % 1_000_000);
    await persist(t, id, started.table, started.state, new Map());
    return { ok: true };
  });
});


/** Oyuncu hamlesi: sunucu doğrular, uygular, botları oynatır. */
export const act = onCall(async (req) => {
  const uid = uidOf(req);
  const id = String(req.data?.tableId ?? "");
  const action = req.data?.action as Action;
  return db.runTransaction(async (t) => {
    const { table, state } = await load(t, id);
    if (table.status !== "playing" || !state) fail("notNow");
    const seat = table.seats.findIndex((s) => s.uid === uid);
    if (seat < 0) fail("notAtTable", {}, "permission-denied");
    if (state.current !== seat) fail("notYourTurn");
    const cfg = configFor(table.type);
    setGameLang(state.lang);
    const dict = dictFor(state.lang);
    let next = engine(() => {
      switch (action?.type) {
        case "drawDeck": return drawFromDeck(state);
        case "drawDiscard": return drawFromDiscard(state);
        case "open": return openHand(dict, state, action.specs);
        case "lay": return layWord(dict, state, action.spec);
        case "openPairs": return openPairs(state, action.specs);
        case "layPair": return layPair(state, action.spec);
        case "extend": return extendWord(dict, state, action.wordId, action.side, action.spec);
        case "discard": return discardTile(state, action.tileId);
        default: return fail("badRequest", {}, "invalid-argument");
      }
    });
    next = runBots(next, cfg.level);
    const wallets = next.phase === "gameOver" ? await walletsOf(t, table.uids) : new Map();
    await persist(t, id, table, next, wallets);
    return { ok: true };
  });
});

/**
 * Süre dolduysa otomatik hamle yapar ya da el arası bittiyse sonraki eli
 * dağıtır. Masadaki herhangi bir oyuncu çağırabilir; sunucu süreyi kontrol eder.
 */
export const claimTimeout = onCall(async (req) => {
  const uid = uidOf(req);
  const id = String(req.data?.tableId ?? "");
  return db.runTransaction(async (t) => {
    const { table, state } = await load(t, id);
    if (!table.uids.includes(uid)) fail("notAtTable", {}, "permission-denied");
    if (table.status !== "playing" || !state || !table.deadline) return { ok: false };
    if (Date.now() + 250 < table.deadline + GRACE_MS) return { ok: false };
    const cfg = configFor(table.type);
    setGameLang(state.lang);
    let next: GameState;
    if (state.phase === "handOver") next = dealHand(state);
    else if (state.phase === "draw" || state.phase === "play") next = timeoutMove(state);
    else return { ok: false };
    next = runBots(next, cfg.level);
    const wallets = next.phase === "gameOver" ? await walletsOf(t, table.uids) : new Map();
    await persist(t, id, table, next, wallets);
    return { ok: true };
  });
});

/** El sonucu ekranında "Sonraki El": masadaki herkes hazırsa beklemeden dağıtır. */
export const nextHand = onCall(async (req) => {
  const uid = uidOf(req);
  const id = String(req.data?.tableId ?? "");
  return db.runTransaction(async (t) => {
    const { table, state } = await load(t, id);
    if (!table.uids.includes(uid)) fail("notAtTable", {}, "permission-denied");
    if (table.status !== "playing" || !state || state.phase !== "handOver") return { ok: false };
    // Tek gerçek oyunculu masada beklemeye gerek yok; çok oyunculuda süre dolunca dağıtılır.
    if (table.uids.length > 1) return { ok: false };
    const cfg = configFor(table.type);
    setGameLang(state.lang);
    const next = runBots(dealHand(state), cfg.level);
    await persist(t, id, table, next, new Map());
    return { ok: true };
  });
});

/** Masadan kalk: yeri bota devredilir, giriş ücreti iade edilmez. */
export const leaveTable = onCall(async (req) => {
  const uid = uidOf(req);
  const id = String(req.data?.tableId ?? "");
  return db.runTransaction(async (t) => {
    // İşlemde önce tüm okumalar, sonra yazmalar.
    const { table, state } = await load(t, id);
    const seat = table.seats.findIndex((s) => s.uid === uid);
    const uids = table.uids.filter((u) => u !== uid);
    const w = (await t.get(walletRef(uid))).data() as WalletDoc | undefined;
    const others = table.status === "playing" ? await walletsOf(t, uids) : new Map<string, WalletDoc>();
    t.set(userRef(uid), { activeTable: null }, { merge: true });
    if (seat < 0) return { ok: true };
    const seats = table.seats.map((s, i) => (i === seat ? { uid: null, name: s.name, bot: true } : s));
    if (table.status === "waiting") {
      // Başlamamış masadan kalkan oyuncuya giriş ücreti iade edilir.
      if (w) applyTx(t, uid, w, configFor(table.type).entry, "iade", table.type);
      const rest = table.seats.filter((_, i) => i !== seat);
      t.set(tableRef(id), { ...table, seats: rest, uids, status: rest.length ? "waiting" : "abandoned", version: table.version + 1 });
      return { ok: true };
    }
    if (!state || table.status !== "playing") return { ok: true };
    if (!uids.length) {
      t.set(tableRef(id), { ...table, seats, uids, status: "abandoned", deadline: null, version: table.version + 1 });
      return { ok: true };
    }
    const cfg = configFor(table.type);
    setGameLang(state.lang);
    state.players[seat].isBot = true;
    const next = runBots(state, cfg.level);
    await persist(t, id, { ...table, seats, uids }, next, others);
    return { ok: true };
  });
});

export type { PublicView };
