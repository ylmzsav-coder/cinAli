import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { BotLevel, bestArrangement, botStep } from "../game/bot";
import { Dictionary } from "../game/dictionary";
import {
  GameError,
  GameState,
  RULES,
  TableWord,
  WordSpec,
  colorWinOf,
  dealHand,
  discardTile,
  drawFromDeck,
  drawFromDiscard,
  extendWord,
  jokerOptions,
  layWord,
  openHand,
  prevIndex,
  timeoutMove,
  totals,
  placedValue,
  layPair,
  openPairs,
  wordString,
} from "../game/engine";
import { COLORS, Letter, Tile, letterIndex, letterValue } from "../game/tiles";
import { buzz, pop, tick, tileSound, type TileSound } from "../feedback";
import { playLose, playWin, stopJingle } from "../jingles";
import { lookupMeaning, type Meaning } from "../meaning";
import { AUTO_PER_PRODUCT, TEST_MODE, buyAutoPer, ownsAutoPer, purchasesAvailable } from "../economy/store";
import { BOT_REPLIES, BUBBLE_MS, CHAT_COOLDOWN_MS, CHAT_MESSAGES, EMOJIS, MAX_TEXT, type ChatEvent, type ChatMessageId, type SendTextResult } from "../online/chat";
import type { Action } from "../online/view";
import { errorText, formatNumber, t, tk } from "../i18n";
import { TileView } from "./TileView";
import { Slots, arrangeWords, groupsOf, initialSlots, moveGroup, moveTile, packSlots, syncSlots } from "./rack";

const ME = 0;
const SPEED_MS = { yavas: 1100, normal: 650, hizli: 250 } as const;
/** Son kaç saniyede ses/titreşim uyarısı verilir. */
const WARN_SECONDS = 5;

/** Istakadaki bir taş grubunun (yan yana taşlar) kelime değerlendirmesi. */
interface GroupInfo {
  ids: number[];
  slots: number[];
  word: string | null;
  value: number;
  jokerLetters: Letter[];
  /** Jokerin alabileceği harf seçenekleri (birden fazlaysa oyuncu seçebilir). */
  options: Letter[][];
  valid: boolean;
  /** İki aynı harf (ya da harf + joker): çift. */
  pair: boolean;
}

/** Sürükleme: ıstakadan taş(lar) ya da desteden/soldan çekilecek taş. */
interface DragState {
  kind: "tile" | "deck" | "take";
  ids: number[];
  /** Parmakla tutulan taş (seçimle birlikte sürüklenirken). */
  origin?: number;
  x: number;
  y: number;
  sx: number;
  sy: number;
  active: boolean;
  target: string | null;
}

interface JokerPrompt {
  title: string;
  words: string[];
  options: Letter[][];
  onPick: (letters: Letter[]) => void;
}

/** Çevrimiçi masa: hamleler sunucuya gider, süreyi sunucu tutar. */
export interface RemoteControl {
  send(action: Action): Promise<unknown>;
  /** Süre dolduğunda (hamle süresi ya da el arası) sunucudan otomatik ilerletmesini ister. */
  timeout(): Promise<unknown>;
  nextHand(): Promise<unknown>;
  /** Sunucunun belirlediği son an (ms) ya da null. */
  deadline: number | null;
}

/** Çevrimiçi sohbet: olaylar sunucudan gelir (seat = görünümdeki sıra). */
export interface ChatChannel {
  events: ChatEvent[];
  send(kind: "msg" | "emoji", id: string): Promise<unknown>;
  /** Serbest yazışma (yalnızca arkadaş masalarında verilir). */
  sendText?: (text: string) => Promise<SendTextResult>;
}

/** Oyuncu kartına dokununca: sustur / şikâyet et (yalnızca gerçek oyuncular). */
export interface PlayerMenu {
  /** Görünümdeki koltuk için menü açılabilir mi (bot ve siz hariç). */
  available(seat: number): boolean;
  isMuted(seat: number): boolean;
  toggleMute(seat: number): void;
  report(seat: number): Promise<unknown>;
}

interface Props {
  /** Verilirse çevrimiçi mod. */
  remote?: RemoteControl;
  /** Çevrimiçi sohbet kanalı; yoksa yerel (botlar cevap verir). */
  chat?: ChatChannel;
  /** Diğer oyuncuların mesajlarını göster. */
  chatEnabled?: boolean;
  playerMenu?: PlayerMenu;
  dict: Dictionary;
  state: GameState;
  level: BotLevel;
  speed: keyof typeof SPEED_MS;
  /** Hamle süresi (saniye); 0 = kapalı. */
  turnSeconds: number;
  /** Son 5 saniyede ses / titreşim. */
  sound: boolean;
  vibration: boolean;
  onChange: (s: GameState) => void;
  onExit: () => void;
  onNewGame: () => void;
  /** Çevrimiçi masada "Masadan kalk". */
  onLeave?: () => void;
  /** Çipli masa adı (pratikte boş). */
  tableName?: string;
  /** Oyun sonunda kazanılan çip. */
  payout?: number;
}

export function Game({ remote, chat, chatEnabled = true, playerMenu, dict, state, level, speed, turnSeconds, sound, vibration, onChange, onExit, onNewGame, onLeave, tableName, payout }: Props) {
  const me = state.players[ME];
  const [slots, setSlots] = useState<Slots>(() => initialSlots(me.rack.map((t) => t.id)));
  const [selected, setSelected] = useState<number[]>([]);
  const [jokerPick, setJokerPick] = useState<Record<number, Letter[]>>({});
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [jokerPrompt, setJokerPrompt] = useState<JokerPrompt | null>(null);
  const [showScores, setShowScores] = useState(false);
  const handRef = useRef(state.handNo);
  /** Desteden/soldan sürüklenip bırakılan taşın konacağı yuva. */
  const preferredSlotRef = useRef<number | null>(null);
  const play = (kind: TileSound) => sound && tileSound(kind);

  // Yeni elde ıstakayı baştan diz, seçimleri sıfırla
  useEffect(() => {
    if (handRef.current !== state.handNo) {
      handRef.current = state.handNo;
      setSelected([]);
      setJokerPick({});
      setMessage(null);
      setSlots(initialSlots(state.players[ME].rack.map((t) => t.id)));
    }
  }, [state.handNo, state.players]);

  // Istakayı oyun durumuyla eşitle: giden taşın yeri boş kalır, gelen taş
  // bırakılan yuvaya ya da alt sıranın en sağına konur.
  useEffect(() => {
    const ids = me.rack.map((t) => t.id);
    setSlots((prev) => {
      const next = syncSlots(prev, ids, preferredSlotRef.current);
      preferredSlotRef.current = null;
      return next.every((x, i) => x === prev[i]) ? prev : next;
    });
    const set = new Set(ids);
    setSelected((prev) => (prev.every((id) => set.has(id)) ? prev : prev.filter((id) => set.has(id))));
  }, [me.rack]);

  // Bilgisayar oyuncuları (çevrimiçi modda botları sunucu oynatır)
  useEffect(() => {
    if (remote) return;
    if (state.phase !== "draw" && state.phase !== "play") return;
    if (!state.players[state.current].isBot) return;
    const timer = setTimeout(() => onChange(botStep(dict, state, level)), SPEED_MS[speed]);
    return () => clearTimeout(timer);
  }, [remote, state, dict, level, speed, onChange]);

  // ---- Sohbet (hazır mesajlar ve emojiler) ----
  const [localChat, setLocalChat] = useState<ChatEvent[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const lastSentRef = useRef(0);
  const chatEvents = chat ? chat.events : localChat;
  const [chatNow, setChatNow] = useState(() => Date.now());
  const liveBubbles = chatEvents.filter((e) => chatNow - e.at < BUBBLE_MS && (e.seat === ME || chatEnabled));
  useEffect(() => {
    if (!chatEvents.some((e) => Date.now() - e.at < BUBBLE_MS)) return;
    const id = setInterval(() => setChatNow(Date.now()), 300);
    return () => clearInterval(id);
  }, [chatEvents]);
  // Başkasından mesaj gelince ses
  const seenChatRef = useRef(0);
  useEffect(() => {
    const fresh = chatEvents.filter((e) => e.at > seenChatRef.current);
    if (!fresh.length) return;
    seenChatRef.current = Math.max(...fresh.map((e) => e.at));
    setChatNow(Date.now());
    if (sound && chatEnabled && fresh.some((e) => e.seat !== ME && Date.now() - e.at < BUBBLE_MS)) pop();
  }, [chatEvents, sound, chatEnabled]);
  const bubbleFor = (seat: number) => {
    const e = liveBubbles.filter((x) => x.seat === seat).sort((a, b) => b.at - a.at)[0];
    if (!e) return null;
    return (
      <span key={e.at} className={`bubble ${e.kind === "emoji" ? "bubble-emoji" : ""} ${e.kind === "text" ? "bubble-text" : ""}`} role="status">
        {e.kind === "emoji" ? e.id : e.kind === "text" ? e.text : t(`chat_${e.id}` as "chat_hello")}
      </span>
    );
  };
  const [draft, setDraft] = useState("");
  const [chatNote, setChatNote] = useState<string | null>(null);
  const sendText = async () => {
    const text = draft.trim();
    if (!text || !chat?.sendText) return;
    try {
      const res = await chat.sendText(text);
      if (res.ok) {
        setDraft("");
        setChatNote(null);
      } else if (res.muted) setChatNote(t("chatMutedNow"));
      else if (res.blocked) setChatNote(t("profanityBlocked", { n: res.strikesLeft ?? 0 }));
    } catch (e) {
      setChatNote(errorText(e));
    }
  };
  const [menuSeat, setMenuSeat] = useState<number | null>(null);
  const textHistory = chatEvents.filter((e) => e.kind === "text").sort((a, b) => a.at - b.at).slice(-8);

  const sendChat = (kind: "msg" | "emoji", id: string) => {
    if (Date.now() - lastSentRef.current < CHAT_COOLDOWN_MS) return;
    lastSentRef.current = Date.now();
    setChatOpen(false);
    if (chat) {
      void chat.send(kind, id).catch(() => {});
      return;
    }
    setLocalChat((prev) => [...prev.slice(-20), { seat: ME, kind, id, at: Date.now() }]);
    // Bilgisayar oyuncuları bazen cevap verir
    const replies = kind === "msg" ? BOT_REPLIES[id as ChatMessageId] : ["😂", "👍", "😮"];
    if (replies?.length && Math.random() < 0.6) {
      const seat = 1 + Math.floor(Math.random() * 3);
      const reply = replies[Math.floor(Math.random() * replies.length)];
      const replyKind = (EMOJIS as readonly string[]).includes(reply) ? "emoji" : "msg";
      setTimeout(() => setLocalChat((prev) => [...prev.slice(-20), { seat, kind: replyKind, id: reply, at: Date.now() }]), 900 + Math.random() * 1200);
    }
  };

  // ---- El / oyun sonu müziği: kazanana alkışlı fanfar, kaybedene hüzünlü melodi ----
  const prevPhaseRef = useRef(state.phase);
  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = state.phase;
    const ended = state.phase === "handOver" || state.phase === "gameOver";
    const wasActive = prev === "draw" || prev === "play";
    if (!ended && (prev === "handOver" || prev === "gameOver")) stopJingle(); // yeni el başladı
    if (!ended || !wasActive || !sound) return;
    let won: boolean;
    if (state.phase === "gameOver") {
      const sums = totals(state);
      won = sums[ME] === Math.min(...sums);
    } else won = state.lastResult?.winner === ME;
    if (won) playWin();
    else playLose();
    if (vibration && won) navigator.vibrate?.([80, 60, 80, 60, 200]);
  }, [state, sound, vibration]);
  useEffect(() => () => stopJingle(), []);

  // ---- Hamle süresi ----
  const active = state.phase === "draw" || state.phase === "play";
  const timerOn = turnSeconds > 0 && active;
  // Sıra her el ve her atılan taşla değişir
  const turnKey = `${state.handNo}:${state.current}:${state.discards.reduce((n, d) => n + d.length, 0)}`;
  // Son tarih, ait olduğu turla birlikte tutulur: tur değiştiği ilk anda
  // eski (geçmiş) son tarih yüzünden yanlışlıkla süre dolmuş sayılmaz.
  const [timer, setTimer] = useState<{ key: string; at: number }>({ key: "", at: 0 });
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setTimer({ key: turnKey, at: Date.now() + turnSeconds * 1000 });
    setNow(Date.now());
  }, [turnKey, turnSeconds]);
  const deadline = remote ? remote.deadline ?? 0 : timer.key === turnKey ? timer.at : 0;
  const ticking = timerOn || (!!remote && state.phase === "handOver");
  useEffect(() => {
    if (!ticking) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [ticking]);
  const remainingMs = timerOn ? (deadline ? Math.max(0, deadline - now) : turnSeconds * 1000) : 0;
  const fraction = timerOn ? Math.min(1, remainingMs / (turnSeconds * 1000)) : 0;
  const timerColor = fraction > 0.5 ? "var(--timer-green)" : fraction > 0.2 ? "var(--timer-yellow)" : "var(--timer-red)";
  const secondsLeft = Math.ceil(remainingMs / 1000);

  const myTurn = state.current === ME && (state.phase === "draw" || state.phase === "play");
  const canPlay = myTurn && state.phase === "play";
  const tileById = useMemo(() => new Map(me.rack.map((t) => [t.id, t])), [me.rack]);
  const selectedTiles = selected.map((id) => tileById.get(id)!).filter(Boolean);
  // Sizin alabileceğiniz taş: soldaki oyuncunun attığı en üst taş
  const leftPile = state.discards[prevIndex(state, ME)];
  const discardTop = leftPile.length ? leftPile[leftPile.length - 1] : null;

  // ---- Istakadaki gruplar: yan yana taşlar = kelime adayı ----
  const groups: GroupInfo[] = useMemo(() => {
    return groupsOf(slots).map((g) => {
      const tiles = g.ids.map((id) => tileById.get(id)).filter((x): x is Tile => !!x);
      const base: GroupInfo = { ids: g.ids, slots: g.slots, word: null, value: 0, jokerLetters: [], options: [], valid: false, pair: false };
      if (tiles.length === 2) {
        const [a, b] = tiles;
        const l = a.letter ?? b.letter;
        if (l && (a.letter === null || b.letter === null || a.letter === b.letter)) return { ...base, pair: true, word: l + l, value: letterValue(l) * 2 };
        return base;
      }
      if (tiles.length < 3) return base;
      const pattern = tiles.map((x) => x.letter);
      if (!pattern.includes(null)) {
        const word = pattern.join("");
        const valid = dict.has(word);
        return { ...base, word, valid, value: valid ? [...word].reduce((s, ch) => s + letterValue(ch), 0) : 0 };
      }
      const options = jokerOptions(dict, pattern);
      if (!options.length) return { ...base, word: pattern.map((p) => p ?? "?").join("") };
      // Oyuncunun seçtiği harf; yoksa en yüksek değerli seçenek
      const jokerId = tiles.find((x) => x.letter === null)!.id;
      const picked = jokerPick[jokerId];
      const score = (o: Letter[]) => o.reduce((s, l) => s + letterValue(l), 0);
      const choice = options.find((o) => picked && o.join() === picked.join()) ?? options.slice().sort((a, b) => score(b) - score(a))[0];
      let j = 0;
      const word = pattern.map((p) => p ?? choice[j++]).join("");
      return { ...base, word, valid: true, jokerLetters: choice, options, value: [...word].reduce((s, ch) => s + letterValue(ch), 0) };
    });
  }, [slots, tileById, dict, jokerPick]);
  const validGroups = groups.filter((g) => g.valid);
  const groupTotal = validGroups.reduce((s, g) => s + g.value, 0);
  const pairGroups = groups.filter((g) => g.pair);
  /** Çifte gitme: açmadıysa 5 çift ve kelimeler 101'e yetmiyorsa; çifte gittiyse hep. */
  const pairMode = me.pairs ? true : !me.opened && pairGroups.length >= RULES.pairsToOpen && groupTotal < RULES.openThreshold;
  /** Süre dolunca otomatik atılmaması gereken taşlar: geçerli kelime grupları ve çiftler. */
  const groupKeepIds = new Set([...validGroups, ...pairGroups].flatMap((g) => g.ids));

  /**
   * Hamle yapar: yerel modda motoru doğrudan çalıştırır, çevrimiçi modda
   * hamleyi sunucuya gönderir. Başarılıysa true döner.
   */
  const [busy, setBusy] = useState(false);
  const act = async (fn: () => GameState, action: Action, okMsg?: string, okSound?: TileSound): Promise<boolean> => {
    // Taş çekmek seçimi bozmaz: oyuncu çekmeden önce kelimesini seçmiş olabilir.
    const keepSelection = action.type === "drawDeck" || action.type === "drawDiscard";
    if (remote) {
      if (busy) return false;
      setBusy(true);
      try {
        await remote.send(action);
        if (!keepSelection) setSelected([]);
        setMessage(okMsg ? { text: okMsg } : null);
        if (okSound) play(okSound);
        return true;
      } catch (e) {
        setMessage({ text: errorText(e), error: true });
        return false;
      } finally {
        setBusy(false);
      }
    }
    try {
      onChange(fn());
      if (!keepSelection) setSelected([]);
      setMessage(okMsg ? { text: okMsg } : null);
      if (okSound) play(okSound);
      return true;
    } catch (e) {
      if (e instanceof GameError) setMessage({ text: tk(`err.${e.code}`, e.params), error: true });
      else throw e;
      return false;
    }
  };

  // Son 5 saniye: sizin sıranızda her saniye tık sesi ve titreşim (saniye başına bir kez)
  const warnedRef = useRef("");
  useEffect(() => {
    if (!timerOn || state.current !== ME || !deadline) return;
    if (secondsLeft < 1 || secondsLeft > WARN_SECONDS) return;
    const key = `${turnKey}:${secondsLeft}`;
    if (warnedRef.current === key) return;
    warnedRef.current = key;
    const final = secondsLeft === 1;
    if (sound) tick(final);
    if (vibration) buzz(final);
  });

  // Süre dolunca: sizin sıranızdaysa otomatik çek/at (her tur için bir kez).
  // Çevrimiçi modda süreyi sunucu denetler: herhangi bir oyuncunun süresi ya da
  // el arası dolunca (küçük bir payla) sunucudan ilerletmesi istenir.
  const firedRef = useRef("");
  useEffect(() => {
    if (!remote) return;
    if (!deadline || now < deadline + 1800) return;
    if (state.phase !== "handOver" && !active) return;
    const key = `r:${deadline}`;
    if (firedRef.current === key) return;
    firedRef.current = key;
    setJokerPrompt(null);
    remote.timeout().catch(() => {
      firedRef.current = ""; // bağlantı hatasında bir sonraki saniyede tekrar dene
    });
  });
  useEffect(() => {
    if (remote) return;
    if (!timerOn || state.current !== ME || remainingMs > 0 || !deadline) return;
    if (firedRef.current === turnKey) return;
    firedRef.current = turnKey;
    setJokerPrompt(null);
    setSelected([]);
    onChange(timeoutMove(state, groupKeepIds));
    setMessage(null);
  });

  /** Sıradaki oyuncunun çerçevesine süre göstergesi. */
  const timerStyle = (player: number) =>
    timerOn && state.current === player
      ? ({ "--p": `${(fraction * 100).toFixed(1)}%`, "--tc": timerColor } as CSSProperties)
      : undefined;

  /** Yere açılabilecek grup: sözlükte olan kelime; çifte gidebilecek/giden oyuncu için çift. */
  const isLayableGroup = (g: GroupInfo) => g.valid || (g.pair && (me.pairs || !me.opened));
  const toggle = (id: number) => {
    play("pick");
    // Geçerli bir per'in (sözlükte olan kelime ya da çifte gidende çift) herhangi bir
    // taşına dokunmak bütün per'i seçer; anlamsız gruplarda yalnızca o taş seçilir.
    const g = groups.find((x) => x.ids.includes(id));
    if (g && isLayableGroup(g)) {
      setSelected((prev) => (g.ids.every((x) => prev.includes(x)) && prev.length === g.ids.length ? [] : g.ids.slice()));
      return;
    }
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const toggleRef = useRef(toggle);
  toggleRef.current = toggle;
  /** Seçili per (çerçeve çizmek için): seçim tam olarak geçerli bir per'in taşlarıysa. */
  const selectedGroup = groups.find((g) => isLayableGroup(g) && g.ids.length === selected.length && g.ids.every((x) => selected.includes(x)));

  /** Jokerli desen için harf seçtirir; tek seçenek varsa doğrudan uygular. */
  const resolveJokers = (pattern: (Letter | null)[], title: string, then: (letters: Letter[]) => void) => {
    if (!pattern.includes(null)) return then([]);
    const options = jokerOptions(dict, pattern);
    if (!options.length) {
      setMessage({ text: t("jokerNoWord"), error: true });
      return;
    }
    if (options.length === 1) return then(options[0]);
    const words = options.map((opt) => {
      let j = 0;
      return pattern.map((p) => p ?? opt[j++]).join("");
    });
    setJokerPrompt({ title, words, options, onPick: then });
  };

  // Taş çekme düğmelerine kısa süre dikkat çek
  const [nudgeDraw, setNudgeDraw] = useState(0);
  useEffect(() => {
    if (!nudgeDraw) return;
    const id = setTimeout(() => setNudgeDraw(0), 900);
    return () => clearTimeout(id);
  }, [nudgeDraw]);

  /** Eli açmış oyuncu yalnızca kendi sırasında, taş çektikten sonra koyabilir. */
  const needDrawFirst = () => {
    if (canPlay) return false;
    const drawFirst = state.current === ME && state.phase === "draw";
    setMessage({ text: drawFirst ? t("drawBeforeLay") : t("playAfterDraw"), error: true });
    if (drawFirst) setNudgeDraw(Date.now());
    return true;
  };

  /** Seçili taşlarla (seçim sırasıyla) kelime koy. */
  const laySelected = () => {
    if (needDrawFirst()) return;
    if (me.pairs) {
      const spec: WordSpec = { tileIds: selected.slice() };
      void act(() => layPair(state, spec), { type: "layPair", spec }, undefined, "open");
      return;
    }
    const pattern = selectedTiles.map((x) => x.letter);
    resolveJokers(pattern, t("jokerWhich"), (jokerLetters) => {
      let j = 0;
      const word = pattern.map((p) => p ?? jokerLetters[j++]).join("");
      if (!dict.has(word)) {
        setMessage({ text: t("err.notInDict", { word }), error: true });
        return;
      }
      const spec: WordSpec = { tileIds: selected.slice(), jokerLetters };
      void act(() => layWord(dict, state, spec), { type: "lay", spec }, t("wordLaid", { word }), "open");
    });
  };

  /** Istakadaki geçerli kelime gruplarını aç (ilk açılış) ya da yere koy (açtıktan sonra). */
  const layGroups = async () => {
    if (!me.opened && !canPlay) {
      if (needDrawFirst()) return;
    }
    if (me.opened && needDrawFirst()) return;
    if (pairMode) {
      const pspecs = pairGroups.map((g) => ({ tileIds: g.ids }));
      if (!me.opened) {
        await act(() => openPairs(state, pspecs), { type: "openPairs", specs: pspecs }, t("openedPairsOk"), "open");
        return;
      }
      if (!pspecs.length) {
        setMessage({ text: t("noValidGroups"), error: true });
        return;
      }
      if (remote) {
        for (const spec of pspecs) if (!(await act(() => state, { type: "layPair", spec }, undefined, "open"))) break;
        return;
      }
      await act(() => pspecs.reduce((s, spec) => layPair(s, spec), state), { type: "layPair", spec: pspecs[0] }, t("wordLaid", { word: pairGroups.map((g) => g.word).join(", ") }), "open");
      return;
    }
    if (!validGroups.length) {
      setMessage({ text: t("noValidGroups"), error: true });
      return;
    }
    const specs = validGroups.map((g) => ({ tileIds: g.ids, jokerLetters: g.jokerLetters }));
    if (!me.opened) {
      await act(() => openHand(dict, state, specs), { type: "open", specs }, t("openedOk"), "open");
      return;
    }
    if (remote) {
      for (const spec of specs) if (!(await act(() => state, { type: "lay", spec }, undefined, "open"))) break;
      return;
    }
    await act(() => specs.reduce((s, spec) => layWord(dict, s, spec), state), { type: "lay", spec: specs[0] }, t("wordLaid", { word: validGroups.map((g) => g.word).join(", ") }), "open");
  };

  const extendWith = (w: TableWord, side: "start" | "end", ids: number[]) => {
    if (needDrawFirst()) return;
    const tiles = ids.map((id) => tileById.get(id)).filter((x): x is Tile => !!x);
    const added = tiles.map((x) => x.letter);
    const base = w.tiles.map((x) => x.letter);
    const pattern = side === "start" ? [...added, ...base] : [...base, ...added];
    resolveJokers(pattern, t("jokerWhich"), (jokerLetters) =>
      void act(
        () => extendWord(dict, state, w.id, side, { tileIds: ids, jokerLetters }),
        { type: "extend", wordId: w.id, side, spec: { tileIds: ids, jokerLetters } },
        undefined,
        "drop",
      ),
    );
  };

  const discardId = (id: number) => {
    if (needDrawFirst()) return;
    void act(() => discardTile(state, id), { type: "discard", tileId: id }, undefined, "discard");
  };

  const discard = () => {
    if (selected.length !== 1) {
      setMessage({ text: t("oneToDiscard"), error: true });
      return;
    }
    discardId(selected[0]);
  };

  const drawDeck = () => void act(() => drawFromDeck(state), { type: "drawDeck" }, undefined, "drop");
  const drawTake = () => void act(() => drawFromDiscard(state), { type: "drawDiscard" }, undefined, "drop");

  const sortBy = (mode: "harf" | "renk") => {
    const key = (x: Tile) =>
      mode === "harf"
        ? (x.letter ? letterIndex(x.letter) : 99) * 10 + COLORS.indexOf(x.color)
        : COLORS.indexOf(x.color) * 100 + (x.letter ? letterIndex(x.letter) : 99);
    setSlots(packSlots(me.rack.slice().sort((a, b) => key(a) - key(b)).map((x) => x.id)));
    play("open");
  };

  /** Otomatik per: en değerli kelimeleri bulup ıstakaya kelime kelime dizer. */
  // ---- Kelimeye harf eklenince genel toplam kısa bir süre parlar (yeni değer yerinde yazılır) ----
  const prevTotalsRef = useRef<Map<number, number> | null>(null);
  const [wordGain, setWordGain] = useState<Record<number, { n: number; key: number }>>({});
  useEffect(() => {
    const now = new Map(state.table.map((w) => [w.id, placedValue(w.tiles)]));
    const prev = prevTotalsRef.current;
    prevTotalsRef.current = now;
    if (!prev) return;
    const gains: Record<number, { n: number; key: number }> = {};
    now.forEach((v, id) => {
      const before = prev.get(id);
      if (before !== undefined && v > before) gains[id] = { n: v - before, key: Date.now() };
    });
    if (!Object.keys(gains).length) return;
    setWordGain((g) => ({ ...g, ...gains }));
    const ids = Object.keys(gains).map(Number);
    const timer = setTimeout(() => setWordGain((g) => {
      const next = { ...g };
      ids.forEach((id) => { if (next[id]?.key === gains[id].key) delete next[id]; });
      return next;
    }), 3500);
    return () => clearTimeout(timer);
  }, [state.table]);

  // ---- Kelime anlamı: yerdeki kelimeye dokununca Vikisözlük'ten ----
  const [meaning, setMeaning] = useState<{ word: string; status: "loading" | "ok" | "none" | "error"; data?: Meaning } | null>(null);
  const meaningReq = useRef(0);
  const showMeaning = (word: string) => {
    if (suppressClickRef.current) return;
    const req = ++meaningReq.current;
    setMeaning({ word, status: "loading" });
    lookupMeaning(word, state.lang)
      .then((data) => req === meaningReq.current && setMeaning({ word, status: data ? "ok" : "none", data: data ?? undefined }))
      .catch(() => req === meaningReq.current && setMeaning({ word, status: "error" }));
  };

  // Otomatik Per uygulama içi satın almayla açılır (tek sefer, sınırsız kullanım)
  const [autoOwned, setAutoOwned] = useState(ownsAutoPer);
  const [autoOffer, setAutoOffer] = useState(false);
  const [autoBusy, setAutoBusy] = useState(false);
  const [autoErr, setAutoErr] = useState<string | null>(null);
  const buyAuto = async () => {
    setAutoBusy(true);
    setAutoErr(null);
    try {
      await buyAutoPer();
      setAutoOwned(true);
      setAutoOffer(false);
      setMessage({ text: t("autoPerUnlocked") });
    } catch (e) {
      setAutoErr(errorText(e));
    } finally {
      setAutoBusy(false);
    }
  };
  const autoArrange = () => {
    if (!autoOwned) {
      setAutoErr(null);
      setAutoOffer(true);
      return;
    }
    const res = bestArrangement(dict, me.rack);
    if (!res.length) {
      setMessage({ text: t("autoNone"), error: true });
      return;
    }
    const used = new Set(res.flatMap((r) => r.spec.tileIds));
    const rest = slots.filter((id): id is number => id !== null && !used.has(id));
    setSlots(arrangeWords(res.map((r) => r.spec.tileIds), rest));
    // Jokerin seçilen harfini hatırla (ıstakada ve el açarken kullanılsın)
    const picks: Record<number, Letter[]> = {};
    for (const r of res) {
      const jokerId = r.spec.tileIds.find((id) => tileById.get(id)?.letter === null);
      if (jokerId !== undefined && r.spec.jokerLetters?.length) picks[jokerId] = r.spec.jokerLetters;
    }
    setJokerPick((p) => ({ ...p, ...picks }));
    setSelected([]);
    const total = res.reduce((s, r) => s + [...r.word].reduce((a, ch) => a + letterValue(ch), 0), 0);
    setMessage({ text: t("autoDone", { words: res.map((r) => r.word).join(", "), total }) });
    play("open");
  };

  /** Grup etiketine dokununca: jokerli grupta harf seçtir. */
  const chooseGroupJoker = (g: GroupInfo) => {
    if (g.options.length < 2) return;
    const tiles = g.ids.map((id) => tileById.get(id)!);
    const pattern = tiles.map((x) => x.letter);
    const jokerId = tiles.find((x) => x.letter === null)!.id;
    resolveJokers(pattern, t("jokerWhich"), (letters) => setJokerPick((p) => ({ ...p, [jokerId]: letters })));
  };

  // ---- Parmakla sürükleme ----
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);
  const canDraw = myTurn && state.phase === "draw";

  const targetAt = (x: number, y: number): string | null => {
    const el = document.elementFromPoint(x, y)?.closest("[data-drop]") as HTMLElement | null;
    return el?.dataset.drop ?? null;
  };

  /**
   * Bırakma hedefi, parmağın değil sürüklenen taşın (parmağın üstünde görünen)
   * ortasına göre bulunur: oyuncu taşı nereye götürdüğünü görür, oraya düşer.
   * Istakanın içinde ya da kenarındaysa en yakın yuvaya oturur (iki kat arası,
   * raf dudağı gibi boşluklar da yuva sayılır).
   */
  const resolveTarget = (fx: number, fy: number): string | null => {
    const ghost = document.querySelector(".drag-ghost .tile, .drag-ghost .tile-back");
    let px = fx;
    let py = fy;
    if (ghost) {
      const g = ghost.getBoundingClientRect();
      // Taşın ortası parmağa göre sabit uzaklıkta durur (bir önceki konumdan ölçülür)
      const prev = dragRef.current;
      if (prev) {
        px = fx + (g.left + g.width / 2 - prev.x);
        py = fy + (g.top + g.height / 2 - prev.y);
      }
    }
    let t = targetAt(px, py);
    if (!t || t === "rack" || !t.startsWith("slot:")) {
      const rack = document.querySelector(".okey-rack")?.getBoundingClientRect();
      const pad = 24;
      if (rack && px >= rack.left - pad && px <= rack.right + pad && py >= rack.top - pad && py <= rack.bottom + pad && (!t || t === "rack")) {
        let best: string | null = null;
        let bestD = Infinity;
        document.querySelectorAll<HTMLElement>(".okey-rack .rack-slot").forEach((el) => {
          const r = el.getBoundingClientRect();
          const dx = Math.max(r.left - px, 0, px - r.right);
          const dy = Math.max(r.top - py, 0, py - r.bottom);
          const dist = dx * dx + dy * dy * 1.5;
          if (dist < bestD) {
            bestD = dist;
            best = el.dataset.drop ?? null;
          }
        });
        if (best) t = best;
      }
    }
    return t ?? targetAt(fx, fy);
  };

  // Sürükleme pencere düzeyinde izlenir (pointer capture kullanılmaz; böylece
  // taşa normal dokunma/tıklama seçme olarak çalışmaya devam eder).
  const startDrag = (e: React.PointerEvent, kind: DragState["kind"], ids: number[]) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragRef.current = { kind, ids, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, active: false, target: null };
    const move = (ev: PointerEvent) => moveDrag(ev);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      // Dokunma (sürüklemeden): taşı seç. Tarayıcının "click" olayına güvenilmez;
      // bir sürüklemeden sonraki ilk dokunuşta bazı tarayıcılar click üretmiyor.
      const d = dragRef.current;
      if (d && !d.active) {
        dragRef.current = null;
        suppressClickRef.current = true;
        setTimeout(() => (suppressClickRef.current = false), 450);
        if (d.kind === "tile") toggleRef.current(d.ids[0]);
        else if (canDrawRef.current) (d.kind === "deck" ? drawDeckRef.current : drawTakeRef.current)();
        return;
      }
      endDrag();
    };
    const cancel = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      dragRef.current = null;
      setDrag(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
  };

  const moveDrag = (e: { clientX: number; clientY: number; preventDefault?: () => void }) => {
    const d = dragRef.current;
    if (!d) return;
    const dist = Math.hypot(e.clientX - d.sx, e.clientY - d.sy);
    if (!d.active && dist < 8) return;
    if (!d.active) {
      d.active = true;
      // Seçili bir taş sürükleniyorsa tüm seçim birlikte taşınır (işleme için)
      d.origin = d.ids[0];
      if (d.kind === "tile" && selectedRef.current.includes(d.ids[0]) && selectedRef.current.length > 1) d.ids = selectedRef.current.slice();
      play("pick");
    }
    d.target = resolveTarget(e.clientX, e.clientY);
    d.x = e.clientX;
    d.y = e.clientY;
    setDrag({ ...d });
  };

  const endDrag = () => {
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!d || !d.active) return;
    suppressClickRef.current = true;
    setTimeout(() => (suppressClickRef.current = false), 80);
    const target = d.target ?? "";
    if (d.kind === "deck" || d.kind === "take") {
      if (!canDrawRef.current) return;
      if (target.startsWith("slot:")) preferredSlotRef.current = Number(target.slice(5));
      if (target.startsWith("slot:") || target === "rack") (d.kind === "deck" ? drawDeckRef.current : drawTakeRef.current)();
      return;
    }
    // Istakadan taş
    if (target.startsWith("slot:")) {
      const to = Number(target.slice(5));
      if (d.ids.length === 1) {
        setSlots((sl) => moveTile(sl, d.ids[0], to));
        play("drop");
        return;
      }
      // Seçili per bütün olarak taşınır (ıstakadaki sırasıyla); sığmazsa yalnızca tutulan taş
      setSlots((sl) => {
        const ordered = sl.filter((x): x is number => x !== null && d.ids.includes(x));
        const grabbed = d.origin ?? d.ids[0];
        const start = to - Math.max(0, ordered.indexOf(grabbed));
        return moveGroup(sl, ordered, start) ?? moveTile(sl, grabbed, to);
      });
      play("drop");
      return;
    }
    dropActionRef.current(target, d.ids);
  };

  // Pencere dinleyicileri eski kapanışları tutmasın diye güncel değerler ref'te
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const canDrawRef = useRef(canDraw);
  canDrawRef.current = canDraw;
  const drawDeckRef = useRef(drawDeck);
  drawDeckRef.current = drawDeck;
  const drawTakeRef = useRef(drawTake);
  drawTakeRef.current = drawTake;
  const dropActionRef = useRef((_target: string, _ids: number[]) => {});
  dropActionRef.current = (target: string, ids: number[]) => {
    if (target === "discard") {
      if (ids.length === 1) discardId(ids[0]);
      else setMessage({ text: t("oneToDiscard"), error: true });
      return;
    }
    if (target.startsWith("extend:")) {
      const [, wid, side] = target.split(":");
      const w = state.table.find((x) => x.id === Number(wid));
      if (w) extendWith(w, side as "start" | "end", ids);
    }
  };

  const tileHandlers = (id: number) => ({
    onPointerDown: (e: React.PointerEvent) => startDrag(e, "tile", [id]),
  });

  // Rakipler: sol (taşını aldığınız), karşı, sağ
  const seatLabel = (i: number) => t(i === 3 ? "seat_left" : i === 2 ? "seat_across" : "seat_right");

  let hint = "";
  if (state.phase === "draw" && state.current === ME) hint = t("hintDraw");
  else if (canPlay) hint = me.opened ? t("hintPlayOpened") : t("hintPlayClosed", { n: RULES.openThreshold });
  else if (state.phase === "draw" || state.phase === "play") hint = t("hintOther", { name: state.players[state.current].name });

  const myTotal = totals(state);
  const result = state.lastResult;
  const handOver = state.phase === "handOver" || state.phase === "gameOver";
  const colorNow = me.opened ? colorWinOf(me) : null;
  const dragTiles = drag?.active ? (drag.kind === "tile" ? drag.ids.map((id) => tileById.get(id)).filter((x): x is Tile => !!x) : []) : [];
  const draggingTile = !!drag?.active && drag.kind === "tile";
  const showExtendZones = draggingTile && canPlay && me.opened && !me.pairs;

  const renderOpp = (i: number, compact = false) => {
    const p = state.players[i];
    const top = state.discards[i][state.discards[i].length - 1];
    return (
      <div key={i} className={`opp ${compact ? "opp-compact" : ""} ${state.current === i && !handOver ? "active" : ""} ${timerStyle(i) ? "timed" : ""}`}
        style={timerStyle(i)}>
        {bubbleFor(i)}
        <div className="opp-name">
          {playerMenu?.available(i) ? (
            <button type="button" className="name-btn" onClick={() => setMenuSeat(menuSeat === i ? null : i)}
              aria-haspopup="menu" aria-expanded={menuSeat === i}>
              {p.name} {playerMenu.isMuted(i) && <span aria-label={t("mutedTag")}>🔇</span>}
            </button>
          ) : p.name}{" "}
          <span className="muted">({seatLabel(i)})</span>
        </div>
        {menuSeat === i && playerMenu && (
          <div className="player-menu" role="menu">
            <button type="button" role="menuitem" onClick={() => { playerMenu.toggleMute(i); setMenuSeat(null); }}>
              {playerMenu.isMuted(i) ? `🔈 ${t("unmute")}` : `🔇 ${t("mute")}`}
            </button>
            <button type="button" role="menuitem" onClick={() => {
              setMenuSeat(null);
              if (!confirm(t("reportConfirm", { name: p.name }))) return;
              playerMenu.report(i).then(() => setMessage({ text: t("reported") }), (e) => setMessage({ text: errorText(e), error: true }));
            }}>⚠️ {t("report")}</button>
          </div>
        )}
        <div className="opp-info">
          <span className="badge">{t("tilesN", { n: p.rack.length })}</span>
          {p.opened && <span className="badge ok">{t("openedBadge")}</span>}
          <span className="muted small">{t("pointsN", { n: myTotal[i] })}</span>
          {compact && top && <TileView tile={top} size="sm" />}
        </div>
        {!compact && i !== 3 && (
          <div className="opp-discard">{top ? <TileView tile={top} size="sm" /> : <span className="slot" />}</div>
        )}
      </div>
    );
  };

  return (
    <div className={`game okey ${draggingTile ? "dragging" : ""}`}>
      <header className="topbar">
        <button type="button" className="link" onClick={onExit}>{t("menu")}</button>
        <div className="title">
          {tableName ?? t("practiceShort")} <span className="muted">· {t("handOf", { n: state.handNo, total: state.totalHands })}</span>
        </div>
        <div className="topbar-actions">
          {onLeave && <button type="button" className="link leave-link" onClick={onLeave}>{t("leaveTable")}</button>}
          <button type="button" className={`chat-btn ${chatOpen ? "on" : ""}`} onClick={() => setChatOpen((v) => !v)}
            aria-label={t("chatOpen")} aria-expanded={chatOpen}>💬</button>
          <button type="button" className="link" onClick={() => setShowScores(true)}>{t("scores")}</button>
        </div>
      </header>

      <div className="board">
        <aside className="side side-left">
          {renderOpp(3)}
          {/* Soldaki oyuncunun attığı taş: dokun ya da ıstakaya sürükle */}
          <button type="button" className={`take ${nudgeDraw && discardTop ? "nudge" : ""}`} disabled={!(canDraw && discardTop)}
            onClick={() => !suppressClickRef.current && drawTake()}
            onPointerDown={(e) => canDraw && discardTop && startDrag(e, "take", [])}
            aria-label={t("takeLeft")}>
            {discardTop ? <TileView tile={discardTop} /> : <span className="slot slot-lg" />}
            <span className="small">{t("takeLeft")}</span>
          </button>
        </aside>

        <main className="felt">
          {renderOpp(2, true)}
          <div className={`hint ${message?.error ? "error" : ""}`} role="status">{message?.text ?? hint}</div>
          <section className="table" aria-label={t("tableAria")}>
            {state.table.length === 0 && <div className="empty">{t("noWordsYet")}</div>}
            {state.table.map((w) => {
              const canExtend = canPlay && me.opened && !me.pairs && !w.pair && selected.length > 0 && !draggingTile;
              return (
                <div key={w.id} className={`word owner-${w.owner} ${w.pair ? "pair" : ""}`}>
                  <div className="word-row">
                  {showExtendZones && !w.pair && (
                    <span className={`word-drop ${drag?.target === `extend:${w.id}:start` ? "over" : ""}`} data-drop={`extend:${w.id}:start`}>+</span>
                  )}
                  {canExtend && (
                    <button type="button" className="plus" onClick={() => extendWith(w, "start", selected.slice())} aria-label={t("addStart")}>+</button>
                  )}
                  <div className="word-tiles" role={w.pair ? undefined : "button"} tabIndex={w.pair ? undefined : 0} title={w.pair ? undefined : t("tapForMeaning")}
                    onClick={() => !w.pair && showMeaning(wordString(w.tiles))}
                    onKeyDown={(e) => !w.pair && (e.key === "Enter" || e.key === " ") && showMeaning(wordString(w.tiles))}>
                    {w.tiles.map((pt) => (
                      <TileView key={pt.tile.id} tile={pt.tile} as={pt.letter} size="sm" />
                    ))}
                  </div>
                  {canExtend && (
                    <button type="button" className="plus" onClick={() => extendWith(w, "end", selected.slice())} aria-label={t("addEnd")}>+</button>
                  )}
                  {showExtendZones && !w.pair && (
                    <span className={`word-drop ${drag?.target === `extend:${w.id}:end` ? "over" : ""}`} data-drop={`extend:${w.id}:end`}>+</span>
                  )}
                  </div>
                  <div className="word-foot">
                    <span className="word-owner">{state.players[w.owner].name} {w.pair ? <span className="word-info">{t("pairChip")}</span> : <span className="word-info" aria-hidden>📖</span>}</span>
                    <span className={`word-total ${wordGain[w.id] ? "gained" : ""}`} key={wordGain[w.id]?.key ?? 0}>
                      {t("wordTotal", { n: placedValue(w.tiles) })}
                    </span>
                  </div>
                </div>
              );
            })}
          </section>
          <div className="felt-bottom">
            <button type="button" className={`deck ${nudgeDraw ? "nudge" : ""}`} disabled={!canDraw}
              onClick={() => !suppressClickRef.current && drawDeck()}
              onPointerDown={(e) => canDraw && startDrag(e, "deck", [])}
              aria-label={t("drawDeck")}>
              <span className="deck-stack" aria-hidden><span className="deck-count">{state.deck.length}</span></span>
              <span className="small">{t("drawDeck")}</span>
            </button>
            {colorNow && <div className="color-hint">{t("colorPath", { color: t(`color_${colorNow}`) })}</div>}
          </div>
          {chatOpen && (
            <section className="chat-panel" aria-label={t("chat")}>
              <div className="chat-emojis">
                {EMOJIS.map((e) => (
                  <button type="button" key={e} onClick={() => sendChat("emoji", e)}>{e}</button>
                ))}
              </div>
              <div className="chat-msgs">
                {CHAT_MESSAGES.map((m) => (
                  <button type="button" key={m} onClick={() => sendChat("msg", m)}>{t(`chat_${m}`)}</button>
                ))}
              </div>
              {chat?.sendText && (
                <>
                  {textHistory.length > 0 && (
                    <ul className="chat-history">
                      {textHistory.map((e) => (
                        <li key={`${e.at}-${e.seat}`}><b>{state.players[e.seat]?.name}:</b> {e.text}</li>
                      ))}
                    </ul>
                  )}
                  <form className="chat-input" onSubmit={(e) => { e.preventDefault(); void sendText(); }}>
                    <input value={draft} maxLength={MAX_TEXT} onChange={(e) => setDraft(e.target.value)}
                      placeholder={t("textPlaceholder")} aria-label={t("textPlaceholder")} enterKeyHint="send" />
                    <button type="submit" className="primary" disabled={!draft.trim()}>{t("send")}</button>
                  </form>
                  {chatNote && <div className="chat-note" role="alert">{chatNote}</div>}
                </>
              )}
            </section>
          )}
        </main>

        {/* Sağdaki oyuncuya taş atılır: alanın tamamı atma hedefi */}
        <aside className={`side side-right ${draggingTile && canPlay ? "drop-ready" : ""} ${drag?.target === "discard" ? "drop-over" : ""}`} data-drop="discard">
          {renderOpp(1)}
          {/* Atma alanı: taşı buraya sürükle */}
          <div className={`discard-zone ${drag?.target === "discard" ? "over" : ""} ${draggingTile && canPlay ? "ready" : ""}`} data-drop="discard"
            aria-label={t("yourDiscard")}>
            {state.discards[ME].length ? (
              <TileView tile={state.discards[ME][state.discards[ME].length - 1]} />
            ) : (
              <span className="slot slot-lg" />
            )}
            <span className="small">{draggingTile && canPlay ? t("dropToDiscard") : t("yourDiscard")}</span>
          </div>
        </aside>
      </div>

      <div className="rack-area">
        <div className="rack-groups" aria-live="polite">
          {(!me.opened || me.pairs) && pairGroups.map((g) => (
            <span key={`p${g.slots[0]}`} className="group-chip ok pair-chip">{g.word} · {t("pairChip")}</span>
          ))}
          {!me.pairs && groups.filter((g) => g.ids.length >= 3 && (g.valid || g.ids.length <= 8)).map((g) => (
            <button type="button" key={g.slots[0]} className={`group-chip ${g.valid ? "ok" : "bad"} ${g.options.length > 1 ? "has-joker" : ""}`}
              onClick={() => chooseGroupJoker(g)} disabled={g.options.length < 2}>
              {g.word ?? "…"} {g.valid ? `· ${g.value}` : "✗"}{g.options.length > 1 ? " ★" : ""}
            </button>
          ))}
          {!me.opened && (
            <span className="group-total">
              {t("groupsTotal", { total: groupTotal, need: RULES.openThreshold })}
              {pairGroups.length > 0 && <> · {t("pairsCount", { n: pairGroups.length, need: RULES.pairsToOpen })}</>}
            </span>
          )}
        </div>
        <div className="rack-row">
          <section className={`rack okey-rack ${myTurn ? "my-turn" : ""} ${timerStyle(ME) ? "timed" : ""}`} aria-label={t("rackAria")}
            style={timerStyle(ME)} data-drop="rack">
            {bubbleFor(ME)}
            {timerStyle(ME) && (
              <span className={`timer-badge ${secondsLeft <= WARN_SECONDS ? "urgent" : ""}`} style={{ background: timerColor }} role="timer" aria-label={t("timeLeft", { n: secondsLeft })}>
                ⏱ {secondsLeft}
              </span>
            )}
            {slots.map((id, i) => {
              const tile = id !== null ? tileById.get(id) : undefined;
              const idx = id !== null ? selected.indexOf(id) : -1;
              const isDragged = !!drag?.active && drag.kind === "tile" && id !== null && drag.ids.includes(id);
              const jokerAs = tile && tile.letter === null ? groups.find((g) => g.ids.includes(tile.id))?.jokerLetters[0] : undefined;
              const inSel = !!selectedGroup && selectedGroup.slots.includes(i);
              const frame = inSel
                ? `grp-sel ${selectedGroup!.slots[0] === i ? "grp-start" : ""} ${selectedGroup!.slots[selectedGroup!.slots.length - 1] === i ? "grp-end" : ""}`
                : "";
              return (
                <div key={i} className={`rack-slot ${frame} ${drag?.target === `slot:${i}` ? "over" : ""}`} data-drop={`slot:${i}`}>
                  {tile && (
                    <div className={`rack-tile ${isDragged ? "ghosted" : ""}`} {...tileHandlers(tile.id)}>
                      <TileView tile={tile} as={jokerAs} selected={idx >= 0} order={idx >= 0 && selected.length > 1 && !selectedGroup ? idx + 1 : undefined}
                        onClick={() => !suppressClickRef.current && toggle(tile.id)} />
                    </div>
                  )}
                </div>
              );
            })}
          </section>
          {/* Istakanın sağında atma yuvası: taşı sağa sürükleyip bırak */}
          <div className={`rack-discard ${draggingTile && canPlay ? "ready" : ""} ${drag?.target === "discard" ? "over" : ""}`} data-drop="discard"
            aria-label={t("yourDiscard")} onClick={() => canPlay && selected.length === 1 && discard()}>
            {state.discards[ME].length ? (
              <TileView tile={state.discards[ME][state.discards[ME].length - 1]} />
            ) : (
              <span className="rack-discard-arrow" aria-hidden>➜</span>
            )}
            {draggingTile && canPlay && <span className="rack-discard-label">{t("dropToDiscard")}</span>}
          </div>
          <div className="rack-actions">
            {me.opened && (me.pairs ? selected.length === 2 : selected.length >= 3) ? (
              <button type="button" className="primary" onClick={laySelected}>{me.pairs ? t("layPairs") : t("layWord")}</button>
            ) : pairMode ? (
              <button type="button" className="primary pair-mode" disabled={me.opened ? !pairGroups.length : pairGroups.length < RULES.pairsToOpen}
                onClick={() => void layGroups()}>
                <span className="open-title">{me.opened ? t("layPairs") : t("openPairs", { n: pairGroups.length, need: RULES.pairsToOpen })}</span>
                {pairGroups.length > 0 && (
                  <span className="open-words">
                    {pairGroups.map((g) => <span key={g.ids.join("-")} className="open-word">{g.word}</span>)}
                  </span>
                )}
              </button>
            ) : (
              <button type="button" className="primary" disabled={me.opened ? !validGroups.length : groupTotal < RULES.openThreshold}
                onClick={() => void layGroups()}>
                <span className="open-title">{me.opened ? t("layWord") : t("openHand", { total: groupTotal, need: RULES.openThreshold })}</span>
                {validGroups.length > 0 && (
                  <span className="open-words">
                    {validGroups.map((g) => <span key={g.ids.join("-")} className="open-word">{g.word}<small>{g.value}</small></span>)}
                  </span>
                )}
              </button>
            )}
            <button type="button" className={`auto-btn ${autoOwned ? "" : "locked"}`} onClick={autoArrange}>
              {autoOwned ? "✨" : "🔒"} {t("autoArrange")}{!autoOwned && <span className="auto-price">{AUTO_PER_PRODUCT.testPrice}</span>}
            </button>
            <div className="sort-row">
              <button type="button" onClick={() => sortBy("harf")} title={t("sortLetter")}>A–Z</button>
              <button type="button" onClick={() => sortBy("renk")} title={t("sortColor")} aria-label={t("sortColor")}>
                <span className="color-dots" aria-hidden><i /><i /><i /><i /></span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sürüklenen taş parmağın hemen üstünde görünür */}
      {drag?.active && (
        <div className="drag-ghost" style={{ left: drag.x, top: drag.y }} aria-hidden>
          {drag.kind === "tile" ? dragTiles.map((x) => <TileView key={x.id} tile={x} />) : <span className="tile tile-back" />}
        </div>
      )}

      {meaning && (
        <div className="modal-bg" onClick={() => setMeaning(null)}>
          <div className="modal meaning" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={meaning.word}>
            <h3>📖 {meaning.word}</h3>
            {meaning.status === "loading" && <p className="muted">{t("meaningLoading")}</p>}
            {meaning.status === "none" && <p className="muted">{t("meaningNone")}</p>}
            {meaning.status === "error" && <p className="error">{t("meaningError")}</p>}
            {meaning.status === "ok" && meaning.data && (
              <>
                <ol className="senses">
                  {meaning.data.senses.map((x, i) => <li key={i}>{x}</li>)}
                </ol>
                <a className="meaning-src" href={meaning.data.url} target="_blank" rel="noopener noreferrer">{t("meaningSource")} ↗</a>
              </>
            )}
            <div className="modal-actions">
              <button type="button" onClick={() => setMeaning(null)}>{t("close")}</button>
            </div>
          </div>
        </div>
      )}

      {autoOffer && (
        <div className="modal-bg" onClick={() => setAutoOffer(false)}>
          <div className="modal auto-offer" onClick={(e) => e.stopPropagation()}>
            <h3>✨ {t("autoArrange")}</h3>
            <p>{t("autoPerDesc")}</p>
            {TEST_MODE && <div className="test-banner">{t("testMode")}</div>}
            {autoErr && <p className="error">{autoErr}</p>}
            <div className="modal-actions">
              <button type="button" className="auto-buy" disabled={autoBusy || !purchasesAvailable()} onClick={() => void buyAuto()}>
                {autoBusy ? "…" : purchasesAvailable() ? t("autoPerBuy", { price: AUTO_PER_PRODUCT.testPrice }) : t("soon")}
              </button>
              <button type="button" onClick={() => setAutoOffer(false)}>{t("cancel")}</button>
            </div>
          </div>
        </div>
      )}

      {jokerPrompt && (
        <div className="modal-bg" onClick={() => setJokerPrompt(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{jokerPrompt.title}</h3>
            <div className="choices">
              {jokerPrompt.words.slice(0, 40).map((w, i) => (
                <button type="button" key={w} onClick={() => {
                  const pick = jokerPrompt.options[i];
                  setJokerPrompt(null);
                  jokerPrompt.onPick(pick);
                }}>{w}</button>
              ))}
            </div>
            <button type="button" className="link" onClick={() => setJokerPrompt(null)}>{t("cancel")}</button>
          </div>
        </div>
      )}

      {(showScores || handOver) && (
        <div className="modal-bg">
          <div className="modal">
            {handOver && result && (
              <>
                <h3>
                  {result.winner === null
                    ? t("deckEmptyTitle")
                    : t("finishedTitle", { name: state.players[result.winner].name })}
                </h3>
                {result.pairWin && (
                  <div className="banner">{t("pairBanner", { score: result.colorWin ? RULES.pairColorWinScore : RULES.pairWinScore })}</div>
                )}
                {result.colorWin && (
                  <div className="banner">{t("colorBanner", { color: t(`color_${result.colorWin}`), score: result.pairWin ? RULES.pairColorWinScore : RULES.colorWinScore })}</div>
                )}
              </>
            )}
            <ScoreTable state={state} />
            {state.phase === "gameOver" ? (
              <>
                <p className="winner">{t("winnerIs", { names: winnerName(state) })}</p>
                {tableName && (
                  <div className={payout ? "banner" : "muted"}>
                    {payout ? t("chipsWon", { n: payout }) : t("noChipsWon")}
                  </div>
                )}
                <button type="button" className="primary" onClick={onNewGame}>{t("backToMenu")}</button>
              </>
            ) : handOver ? (
              <button type="button" className="primary" onClick={() => {
                setShowScores(false);
                if (remote) void remote.nextHand().catch(() => {});
                else onChange(dealHand(state));
              }}>
                {t("nextHand")}
                {remote && deadline > now ? ` · ${t("nextHandIn", { n: Math.ceil((deadline - now) / 1000) })}` : ""}
              </button>
            ) : (
              <button type="button" className="primary" onClick={() => setShowScores(false)}>{t("close")}</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function winnerName(state: GameState): string {
  const sums = totals(state);
  const min = Math.min(...sums);
  return state.players.filter((_, i) => sums[i] === min).map((p) => p.name).join(", ");
}

function ScoreTable({ state }: { state: GameState }) {
  const sums = totals(state);
  return (
    <table className="scores">
      <thead>
        <tr>
          <th>{t("handCol")}</th>
          {state.players.map((p, i) => <th key={i}>{p.name}</th>)}
        </tr>
      </thead>
      <tbody>
        {state.history.map((h, k) => (
          <tr key={k}>
            <td>{k + 1}</td>
            {h.map((v, i) => <td key={i} className={v < 0 ? "neg" : ""}>{v}</td>)}
          </tr>
        ))}
        {state.history.length === 0 && (
          <tr><td colSpan={state.players.length + 1} className="muted">{t("noHandsYet")}</td></tr>
        )}
      </tbody>
      <tfoot>
        <tr>
          <th>{t("totalRow")}</th>
          {sums.map((v, i) => <th key={i}>{formatNumber(v)}</th>)}
        </tr>
      </tfoot>
    </table>
  );
}

