import { LETTER_VALUE, Letter, Tile } from "../game/tiles";

interface Props {
  tile: Tile;
  /** Joker yere konduysa temsil ettiği harf. */
  as?: Letter;
  size?: "sm" | "md";
  selected?: boolean;
  order?: number;
  onClick?: () => void;
  dim?: boolean;
}

export function TileView({ tile, as, size = "md", selected, order, onClick, dim }: Props) {
  const isJoker = tile.letter === null;
  const letter = tile.letter ?? as;
  const cls = [
    "tile",
    `tile-${size}`,
    isJoker ? "tile-joker" : `c-${tile.color}`,
    selected ? "tile-selected" : "",
    onClick ? "tile-btn" : "",
    dim ? "tile-dim" : "",
  ].join(" ");
  const content = (
    <>
      <span className="tile-letter">{letter ?? "★"}</span>
      {letter && <span className="tile-value">{LETTER_VALUE[letter]}</span>}
      {isJoker && <span className="tile-star">★</span>}
      {order !== undefined && <span className="tile-order">{order}</span>}
    </>
  );
  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick} aria-pressed={selected}
        aria-label={isJoker ? "Joker" : `${letter} ${tile.color}`}>
        {content}
      </button>
    );
  }
  return <span className={cls}>{content}</span>;
}
