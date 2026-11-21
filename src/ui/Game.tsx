import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { BotLevel, botStep } from "../game/bot";
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
} from "../game/engine";
import { COLORS, Letter, Tile, letterIndex, wordValue } from "../game/tiles";
import { buzz, tick } from "../feedback";
import { formatNumber, t, tk } from "../i18n";
import { TileView } from "./TileView";

const ME = 0;
const SPEED_MS = { yavas: 1100, normal: 650, hizli: 250 } as const;
/** Son kaç saniyede ses/titreşim uyarısı verilir. */
const WARN_SECONDS = 5;

interface Staged {
  tileIds: number[];
  jokerLetters: Letter[];
  word: string;
  value: number;
}

interface JokerPrompt {
  title: string;
  words: string[];
  options: Letter[][];
  onPick: (letters: Letter[]) => void;
}

interface Props {
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
  /** Çipli masa adı (pratikte boş). */
  tableName?: string;
  /** Oyun sonunda kazanılan çip. */
  payout?: number;
}

export function Game({ dict, state, level, speed, turnSeconds, sound, vibration, onChange, onExit, onNewGame, tableName, payout }: Props) {
  const me = state.players[ME];
  const [order, setOrder] = useState<number[]>(() => me.rack.map((t) => t.id));
  const [selected, setSelected] = useState<number[]>([]);
  const [staged, setStaged] = useState<Staged[]>([]);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [jokerPrompt, setJokerPrompt] = useState<JokerPrompt | null>(null);
  const [showScores, setShowScores] = useState(false);
  const handRef = useRef(state.handNo);

  // Yeni elde yerel seçimleri sıfırla
  useEffect(() => {
    if (handRef.current !== state.handNo) {
      handRef.current = state.handNo;
      setSelected([]);
      setStaged([]);
      setMessage(null);
      setOrder(state.players[ME].rack.map((t) => t.id));
    }
  }, [state.handNo, state.players]);

  // Istaka sırasını raf içeriğiyle eşitle (yeni taşlar sona eklenir)
  useEffect(() => {
    const ids = new Set(me.rack.map((t) => t.id));
    setOrder((prev) => {
      const kept = prev.filter((id) => ids.has(id));
      const added = me.rack.filter((t) => !kept.includes(t.id)).map((t) => t.id);
      return added.length || kept.length !== prev.length ? [...kept, ...added] : prev;
    });
    setSelected((prev) => prev.filter((id) => ids.has(id)));
    setStaged((prev) => prev.filter((s) => s.tileIds.every((id) => ids.has(id))));
  }, [me.rack]);

  // Bilgisayar oyuncuları
  useEffect(() => {
    if (state.phase !== "draw" && state.phase !== "play") return;
    if (!state.players[state.current].isBot) return;
    const timer = setTimeout(() => onChange(botStep(dict, state, level)), SPEED_MS[speed]);
    return () => clearTimeout(timer);
  }, [state, dict, level, speed, onChange]);

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
  const deadline = timer.key === turnKey ? timer.at : 0;
  useEffect(() => {
    if (!timerOn) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [timerOn]);
  const remainingMs = timerOn ? (deadline ? Math.max(0, deadline - now) : turnSeconds * 1000) : 0;
  const fraction = timerOn ? Math.min(1, remainingMs / (turnSeconds * 1000)) : 0;
  const timerColor = fraction > 0.5 ? "var(--timer-green)" : fraction > 0.2 ? "var(--timer-yellow)" : "var(--timer-red)";
  const secondsLeft = Math.ceil(remainingMs / 1000);

  const myTurn = state.current === ME && (state.phase === "draw" || state.phase === "play");
  const canPlay = myTurn && state.phase === "play";
  const tileById = useMemo(() => new Map(me.rack.map((t) => [t.id, t])), [me.rack]);
  const stagedIds = new Set(staged.flatMap((s) => s.tileIds));
  const rackTiles = order.map((id) => tileById.get(id)).filter((t): t is Tile => !!t && !stagedIds.has(t.id));
  const selectedTiles = selected.map((id) => tileById.get(id)!).filter(Boolean);
  const stagedTotal = staged.reduce((s, w) => s + w.value, 0);
  // Sizin alabileceğiniz taş: soldaki oyuncunun attığı en üst taş
  const leftPile = state.discards[prevIndex(state, ME)];
  const discardTop = leftPile.length ? leftPile[leftPile.length - 1] : null;

  const act = (fn: () => GameState, okMsg?: string) => {
    try {
      onChange(fn());
      setSelected([]);
      setMessage(okMsg ? { text: okMsg } : null);
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

  // Süre dolunca: sizin sıranızdaysa otomatik çek/at (her tur için bir kez)
  const firedRef = useRef("");
  useEffect(() => {
    if (!timerOn || state.current !== ME || remainingMs > 0 || !deadline) return;
    if (firedRef.current === turnKey) return;
    firedRef.current = turnKey;
    setJokerPrompt(null);
    setSelected([]);
    onChange(timeoutMove(state, stagedIds));
    setMessage(null);
  });

  /** Sıradaki oyuncunun çerçevesine süre göstergesi. */
  const timerStyle = (player: number) =>
    timerOn && state.current === player
      ? ({ "--p": `${(fraction * 100).toFixed(1)}%`, "--tc": timerColor } as CSSProperties)
      : undefined;

  const toggle = (id: number) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

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

  const makeWord = () => {
    if (selectedTiles.length < 3) {
      setMessage({ text: t("selectMin3"), error: true });
      return;
    }
    const pattern = selectedTiles.map((t) => t.letter);
    resolveJokers(pattern, t("jokerWhich"), (jokerLetters) => {
      let j = 0;
      const word = pattern.map((p) => p ?? jokerLetters[j++]).join("");
      if (!dict.has(word)) {
        setMessage({ text: t("err.notInDict", { word }), error: true });
        return;
      }
      const spec: WordSpec = { tileIds: selected.slice(), jokerLetters };
      if (me.opened) {
        if (!canPlay) {
          setMessage({ text: t("playAfterDraw"), error: true });
          return;
        }
        act(() => layWord(dict, state, spec), t("wordLaid", { word }));
      } else {
        const value = wordValue(word);
        setStaged((prev) => [...prev, { ...spec, jokerLetters, word, value }]);
        setSelected([]);
        setMessage({ text: t("wordPrepared", { word, value }) });
      }
    });
  };

  const open = () =>
    act(
      () => openHand(dict, state, staged.map(({ tileIds, jokerLetters }) => ({ tileIds, jokerLetters }))),
      t("openedOk"),
    ) && setStaged([]);

  const extend = (w: TableWord, side: "start" | "end") => {
    const added = selectedTiles.map((t) => t.letter);
    const base = w.tiles.map((t) => t.letter);
    const pattern = side === "start" ? [...added, ...base] : [...base, ...added];
    resolveJokers(pattern, t("jokerWhich"), (jokerLetters) =>
      act(() => extendWord(dict, state, w.id, side, { tileIds: selected.slice(), jokerLetters })),
    );
  };

  const discard = () => {
    if (selected.length !== 1) {
      setMessage({ text: t("oneToDiscard"), error: true });
      return;
    }
    act(() => discardTile(state, selected[0]));
  };

  const sortBy = (mode: "harf" | "renk") => {
    const key = (t: Tile) =>
      mode === "harf"
        ? (t.letter ? letterIndex(t.letter) : 99) * 10 + COLORS.indexOf(t.color)
        : COLORS.indexOf(t.color) * 100 + (t.letter ? letterIndex(t.letter) : 99);
    setOrder(me.rack.slice().sort((a, b) => key(a) - key(b)).map((t) => t.id));
  };

  const moveSelected = (dir: -1 | 1) => {
    if (selected.length !== 1) return;
    setOrder((prev) => {
      const visible = prev.filter((id) => !stagedIds.has(id));
      const i = visible.indexOf(selected[0]);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= visible.length) return prev;
      const a = prev.indexOf(visible[i]);
      const b = prev.indexOf(visible[j]);
      const next = prev.slice();
      [next[a], next[b]] = [next[b], next[a]];
      return next;
    });
  };

  // Rakipler: sol (taşını aldığınız), karşı, sağ
  const seats = [3, 2, 1].map((i) => ({ i, label: t(i === 3 ? "seat_left" : i === 2 ? "seat_across" : "seat_right") }));

  let hint = "";
  if (state.phase === "draw" && state.current === ME) hint = t("hintDraw");
  else if (canPlay) hint = me.opened ? t("hintPlayOpened") : t("hintPlayClosed", { n: RULES.openThreshold });
  else if (state.phase === "draw" || state.phase === "play") hint = t("hintOther", { name: state.players[state.current].name });

  const myTotal = totals(state);
  const result = state.lastResult;
  const handOver = state.phase === "handOver" || state.phase === "gameOver";
  const colorNow = me.opened ? colorWinOf(me) : null;

  return (
    <div className="game">
      <header className="topbar">
        <button type="button" className="link" onClick={onExit}>{t("menu")}</button>
        <div className="title">
          {tableName ?? t("practiceShort")} <span className="muted">· {t("handOf", { n: state.handNo, total: state.totalHands })}</span>
        </div>
        <button type="button" className="link" onClick={() => setShowScores(true)}>{t("scores")}</button>
      </header>

      <section className="opponents">
        {seats.map(({ i, label }) => {
          const p = state.players[i];
          const top = state.discards[i][state.discards[i].length - 1];
          return (
            <div key={i} className={`opp ${state.current === i && !handOver ? "active" : ""} ${timerStyle(i) ? "timed" : ""}`}
              style={timerStyle(i)}>
              <div className="opp-name">
                {p.name} <span className="muted">({label})</span>
              </div>
              <div className="opp-info">
                <span className="badge">{t("tilesN", { n: p.rack.length })}</span>
                {p.opened && <span className="badge ok">{t("openedBadge")}</span>}
                <span className="muted small">{t("pointsN", { n: myTotal[i] })}</span>
              </div>
              <div className="opp-discard">
                {top ? <TileView tile={top} size="sm" /> : <span className="slot" />}
              </div>
            </div>
          );
        })}
      </section>

      <section className="table" aria-label={t("tableAria")}>
        {state.table.length === 0 && <div className="empty">{t("noWordsYet")}</div>}
        {state.table.map((w) => {
          const canExtend = canPlay && me.opened && selected.length > 0;
          return (
            <div key={w.id} className={`word owner-${w.owner}`}>
              {canExtend && (
                <button type="button" className="plus" onClick={() => extend(w, "start")} aria-label={t("addStart")}>+</button>
              )}
              <div className="word-tiles">
                {w.tiles.map((pt) => (
                  <TileView key={pt.tile.id} tile={pt.tile} as={pt.letter} size="sm" />
                ))}
              </div>
              {canExtend && (
                <button type="button" className="plus" onClick={() => extend(w, "end")} aria-label={t("addEnd")}>+</button>
              )}
              <span className="word-owner">{state.players[w.owner].name}</span>
            </div>
          );
        })}
      </section>

      <section className="center">
        <button type="button" className="deck" disabled={!(myTurn && state.phase === "draw")}
          onClick={() => act(() => drawFromDeck(state))}>
          <span className="deck-count">{state.deck.length}</span>
          <span>{t("drawDeck")}</span>
        </button>
        <button type="button" className="take" disabled={!(myTurn && state.phase === "draw" && discardTop)}
          onClick={() => act(() => drawFromDiscard(state))}>
          {discardTop ? <TileView tile={discardTop} size="sm" /> : <span className="slot" />}
          <span>{t("takeLeft")}</span>
        </button>
        <div className="my-discard">
          {state.discards[ME].length ? (
            <TileView tile={state.discards[ME][state.discards[ME].length - 1]} size="sm" />
          ) : (
            <span className="slot" />
          )}
          <span className="muted small">{t("yourDiscard")}</span>
        </div>
      </section>

      <ul className="log">
        {state.log.slice(-3).reverse().map((l, i) => (
          <li key={state.log.length - i}>{tk(`log.${l.k}`, l.p)}</li>
        ))}
      </ul>

      <div className="dock">
      <div className={`hint ${message?.error ? "error" : ""}`} role="status">
        {message?.text ?? hint}
      </div>

      {!me.opened && staged.length > 0 && (
        <section className="staging">
          <div className="staging-words">
            {staged.map((s, k) => (
              <div key={k} className="staged">
                <div className="word-tiles">
                  {s.tileIds.map((id, idx) => {
                    const t = tileById.get(id)!;
                    const jokerIdx = s.tileIds.slice(0, idx + 1).filter((x) => tileById.get(x)?.letter === null).length - 1;
                    return <TileView key={id} tile={t} as={t.letter ?? s.jokerLetters[jokerIdx]} size="sm" />;
                  })}
                </div>
                <span className="muted small">{s.value}</span>
                <button type="button" className="x" aria-label={t("undo")}
                  onClick={() => setStaged((prev) => prev.filter((_, i) => i !== k))}>×</button>
              </div>
            ))}
          </div>
          <button type="button" className="primary" disabled={!canPlay || stagedTotal < RULES.openThreshold} onClick={open}>
            {t("openHand", { total: stagedTotal, need: RULES.openThreshold })}
          </button>
        </section>
      )}

      <section className={`rack ${myTurn ? "my-turn" : ""} ${timerStyle(ME) ? "timed" : ""}`} aria-label={t("rackAria")}
        style={timerStyle(ME)}>
        {timerStyle(ME) && (
          <span className={`timer-badge ${secondsLeft <= WARN_SECONDS ? "urgent" : ""}`} style={{ background: timerColor }} role="timer" aria-label={t("timeLeft", { n: secondsLeft })}>
            ⏱ {secondsLeft}
          </span>
        )}
        {rackTiles.map((t) => {
          const idx = selected.indexOf(t.id);
          return (
            <TileView key={t.id} tile={t} selected={idx >= 0} order={idx >= 0 ? idx + 1 : undefined}
              onClick={() => toggle(t.id)} />
          );
        })}
      </section>

      <section className="actions">
        <button type="button" className="primary" disabled={selected.length < 3} onClick={makeWord}>
          {me.opened ? t("layWord") : t("makeWord")}
        </button>
        <button type="button" className="danger" disabled={!canPlay || selected.length !== 1} onClick={discard}>
          {t("discard")}
        </button>
        <button type="button" disabled={!selected.length} onClick={() => setSelected([])}>{t("clearSelection")}</button>
        <button type="button" onClick={() => sortBy("harf")}>{t("sortLetter")}</button>
        <button type="button" onClick={() => sortBy("renk")}>{t("sortColor")}</button>
        <button type="button" disabled={selected.length !== 1} onClick={() => moveSelected(-1)} aria-label={t("moveLeft")}>◀</button>
        <button type="button" disabled={selected.length !== 1} onClick={() => moveSelected(1)} aria-label={t("moveRight")}>▶</button>
      </section>
      {colorNow && <div className="color-hint">{t("colorPath", { color: t(`color_${colorNow}`) })}</div>}
      </div>

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
                {result.colorWin && (
                  <div className="banner">{t("colorBanner", { color: t(`color_${result.colorWin}`), score: RULES.colorWinScore })}</div>
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
              <button type="button" className="primary" onClick={() => { setShowScores(false); onChange(dealHand(state)); }}>
                {t("nextHand")}
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

