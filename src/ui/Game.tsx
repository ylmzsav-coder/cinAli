import { useEffect, useMemo, useRef, useState } from "react";
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
  totals,
} from "../game/engine";
import { COLOR_NAMES, COLORS, LETTER_INDEX, LETTER_VALUE, Letter, Tile } from "../game/tiles";
import { TileView } from "./TileView";

const ME = 0;
const SPEED_MS = { yavas: 1100, normal: 650, hizli: 250 } as const;

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
  onChange: (s: GameState) => void;
  onExit: () => void;
  onNewGame: () => void;
}

export function Game({ dict, state, level, speed, onChange, onExit, onNewGame }: Props) {
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
      if (e instanceof GameError) setMessage({ text: e.message, error: true });
      else throw e;
      return false;
    }
  };

  const toggle = (id: number) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  /** Jokerli desen için harf seçtirir; tek seçenek varsa doğrudan uygular. */
  const resolveJokers = (pattern: (Letter | null)[], title: string, then: (letters: Letter[]) => void) => {
    if (!pattern.includes(null)) return then([]);
    const options = jokerOptions(dict, pattern);
    if (!options.length) {
      setMessage({ text: "Jokerle bu harflerden geçerli kelime çıkmıyor.", error: true });
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
      setMessage({ text: "Kelime için en az 3 taş seçin (seçim sırası harf sırasıdır).", error: true });
      return;
    }
    const pattern = selectedTiles.map((t) => t.letter);
    resolveJokers(pattern, "Joker hangi harf olsun?", (jokerLetters) => {
      let j = 0;
      const word = pattern.map((p) => p ?? jokerLetters[j++]).join("");
      if (!dict.has(word)) {
        setMessage({ text: `"${word}" sözlükte yok.`, error: true });
        return;
      }
      const spec: WordSpec = { tileIds: selected.slice(), jokerLetters };
      if (me.opened) {
        if (!canPlay) {
          setMessage({ text: "Sıranız gelince ve taş çektikten sonra yere koyabilirsiniz.", error: true });
          return;
        }
        act(() => layWord(dict, state, spec), `${word} yere kondu.`);
      } else {
        const value = [...word].reduce((s, ch) => s + LETTER_VALUE[ch], 0);
        setStaged((prev) => [...prev, { ...spec, jokerLetters, word, value }]);
        setSelected([]);
        setMessage({ text: `${word} (${value}) hazırlandı.` });
      }
    });
  };

  const open = () =>
    act(
      () => openHand(dict, state, staged.map(({ tileIds, jokerLetters }) => ({ tileIds, jokerLetters }))),
      "Eliniz açıldı! Artık kelime koyabilir ve yerdeki kelimelere harf ekleyebilirsiniz.",
    ) && setStaged([]);

  const extend = (w: TableWord, side: "start" | "end") => {
    const added = selectedTiles.map((t) => t.letter);
    const base = w.tiles.map((t) => t.letter);
    const pattern = side === "start" ? [...added, ...base] : [...base, ...added];
    resolveJokers(pattern, "Joker hangi harf olsun?", (jokerLetters) =>
      act(() => extendWord(dict, state, w.id, side, { tileIds: selected.slice(), jokerLetters })),
    );
  };

  const discard = () => {
    if (selected.length !== 1) {
      setMessage({ text: "Atmak için tek bir taş seçin.", error: true });
      return;
    }
    act(() => discardTile(state, selected[0]));
  };

  const sortBy = (mode: "harf" | "renk") => {
    const key = (t: Tile) =>
      mode === "harf"
        ? (t.letter ? LETTER_INDEX[t.letter] : 99) * 10 + COLORS.indexOf(t.color)
        : COLORS.indexOf(t.color) * 100 + (t.letter ? LETTER_INDEX[t.letter] : 99);
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
  const seats = [3, 2, 1].map((i) => ({ i, label: i === 3 ? "Sol" : i === 2 ? "Karşı" : "Sağ" }));

  let hint = "";
  if (state.phase === "draw" && state.current === ME) hint = "Sıra sizde: desteden ya da soldan taş çekin.";
  else if (canPlay)
    hint = me.opened
      ? "Kelime koyun, yerdeki kelimelere harf ekleyin ya da bir taş atın."
      : `Kelimeleri hazırlayıp toplam ${RULES.openThreshold}'ya ulaşınca elinizi açın, sonra bir taş atın.`;
  else if (state.phase === "draw" || state.phase === "play") hint = `${state.players[state.current].name} oynuyor…`;

  const myTotal = totals(state);
  const result = state.lastResult;
  const handOver = state.phase === "handOver" || state.phase === "gameOver";
  const colorNow = me.opened ? colorWinOf(me) : null;

  return (
    <div className="game">
      <header className="topbar">
        <button type="button" className="link" onClick={onExit}>‹ Menü</button>
        <div className="title">
          Cinali <span className="muted">· El {state.handNo}/{state.totalHands}</span>
        </div>
        <button type="button" className="link" onClick={() => setShowScores(true)}>Puanlar</button>
      </header>

      <section className="opponents">
        {seats.map(({ i, label }) => {
          const p = state.players[i];
          const top = state.discards[i][state.discards[i].length - 1];
          return (
            <div key={i} className={`opp ${state.current === i && !handOver ? "active" : ""}`}>
              <div className="opp-name">
                {p.name} <span className="muted">({label})</span>
              </div>
              <div className="opp-info">
                <span className="badge">{p.rack.length} taş</span>
                {p.opened && <span className="badge ok">Açtı</span>}
                <span className="muted small">{myTotal[i]} puan</span>
              </div>
              <div className="opp-discard">
                {top ? <TileView tile={top} size="sm" /> : <span className="slot" />}
              </div>
            </div>
          );
        })}
      </section>

      <section className="table" aria-label="Yerdeki kelimeler">
        {state.table.length === 0 && <div className="empty">Henüz yere kelime açılmadı.</div>}
        {state.table.map((w) => {
          const canExtend = canPlay && me.opened && selected.length > 0;
          return (
            <div key={w.id} className={`word owner-${w.owner}`}>
              {canExtend && (
                <button type="button" className="plus" onClick={() => extend(w, "start")} aria-label="Başına ekle">+</button>
              )}
              <div className="word-tiles">
                {w.tiles.map((pt) => (
                  <TileView key={pt.tile.id} tile={pt.tile} as={pt.letter} size="sm" />
                ))}
              </div>
              {canExtend && (
                <button type="button" className="plus" onClick={() => extend(w, "end")} aria-label="Sonuna ekle">+</button>
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
          <span>Desteden çek</span>
        </button>
        <button type="button" className="take" disabled={!(myTurn && state.phase === "draw" && discardTop)}
          onClick={() => act(() => drawFromDiscard(state))}>
          {discardTop ? <TileView tile={discardTop} size="sm" /> : <span className="slot" />}
          <span>Soldan al</span>
        </button>
        <div className="my-discard">
          {state.discards[ME].length ? (
            <TileView tile={state.discards[ME][state.discards[ME].length - 1]} size="sm" />
          ) : (
            <span className="slot" />
          )}
          <span className="muted small">Attığınız</span>
        </div>
      </section>

      <ul className="log">
        {state.log.slice(-3).reverse().map((l, i) => (
          <li key={state.log.length - i}>{l}</li>
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
                <button type="button" className="x" aria-label="Geri al"
                  onClick={() => setStaged((prev) => prev.filter((_, i) => i !== k))}>×</button>
              </div>
            ))}
          </div>
          <button type="button" className="primary" disabled={!canPlay || stagedTotal < RULES.openThreshold} onClick={open}>
            Eli Aç ({stagedTotal}/{RULES.openThreshold})
          </button>
        </section>
      )}

      <section className={`rack ${myTurn ? "my-turn" : ""}`} aria-label="Istaka">
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
          {me.opened ? "Yere Koy" : "Kelime Yap"}
        </button>
        <button type="button" className="danger" disabled={!canPlay || selected.length !== 1} onClick={discard}>
          Taş At
        </button>
        <button type="button" disabled={!selected.length} onClick={() => setSelected([])}>Seçimi Kaldır</button>
        <button type="button" onClick={() => sortBy("harf")}>Harfe Diz</button>
        <button type="button" onClick={() => sortBy("renk")}>Renge Diz</button>
        <button type="button" disabled={selected.length !== 1} onClick={() => moveSelected(-1)} aria-label="Sola taşı">◀</button>
        <button type="button" disabled={selected.length !== 1} onClick={() => moveSelected(1)} aria-label="Sağa taşı">▶</button>
      </section>
      {colorNow && <div className="color-hint">Yere koyduklarınızın hepsi {COLOR_NAMES[colorNow]} — Renk Bitirme yolundasınız!</div>}
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
            <button type="button" className="link" onClick={() => setJokerPrompt(null)}>Vazgeç</button>
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
                    ? "Deste bitti"
                    : `${state.players[result.winner].name} eli bitirdi!`}
                </h3>
                {result.colorWin && (
                  <div className="banner">RENK BİTİRME — hepsi {COLOR_NAMES[result.colorWin]}! ({RULES.colorWinScore})</div>
                )}
              </>
            )}
            <ScoreTable state={state} />
            {state.phase === "gameOver" ? (
              <>
                <p className="winner">Kazanan: {winnerName(state)}</p>
                <button type="button" className="primary" onClick={onNewGame}>Yeni Oyun</button>
              </>
            ) : handOver ? (
              <button type="button" className="primary" onClick={() => { setShowScores(false); onChange(dealHand(state)); }}>
                Sonraki El
              </button>
            ) : (
              <button type="button" className="primary" onClick={() => setShowScores(false)}>Kapat</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function winnerName(state: GameState): string {
  const t = totals(state);
  const min = Math.min(...t);
  return state.players.filter((_, i) => t[i] === min).map((p) => p.name).join(", ");
}

function ScoreTable({ state }: { state: GameState }) {
  const t = totals(state);
  return (
    <table className="scores">
      <thead>
        <tr>
          <th>El</th>
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
          <tr><td colSpan={state.players.length + 1} className="muted">Henüz biten el yok.</td></tr>
        )}
      </tbody>
      <tfoot>
        <tr>
          <th>Toplam</th>
          {t.map((v, i) => <th key={i}>{v}</th>)}
        </tr>
      </tfoot>
    </table>
  );
}

