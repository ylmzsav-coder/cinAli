import { Letter, Tile, letterValue } from "../game/tiles";
import { t } from "../i18n";

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

/** Okey (joker) taşının resmi. */
const JOKER_IMG = `${import.meta.env.BASE_URL}joker.png`;

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
      {letter ? (
        <span className="tile-letter">{letter}</span>
      ) : (
        <>
          <span className="tile-joker-j top" aria-hidden>J</span>
          <img className="tile-joker-img" src={JOKER_IMG} alt="" draggable={false} />
          <span className="tile-joker-j bottom" aria-hidden>J</span>
        </>
      )}
      {letter && <span className="tile-value">{letterValue(letter)}</span>}
      {isJoker && letter && <img className="tile-joker-mini" src={JOKER_IMG} alt="" draggable={false} />}
      {order !== undefined && <span className="tile-order">{order}</span>}
    </>
  );
  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick} aria-pressed={selected}
        aria-label={isJoker ? t("joker") : `${letter} ${t(`color_${tile.color}`)}`} data-color={tile.color}>
        {content}
      </button>
    );
  }
  return <span className={cls}>{content}</span>;
}
