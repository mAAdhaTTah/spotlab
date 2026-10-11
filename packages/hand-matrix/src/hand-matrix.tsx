import { type CSSProperties, type FC } from "react";
import { COMBOS } from "@spotlab/range";

const chunk = (arr: readonly string[], size: number) =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size),
  );

// Canonical fill direction for a matrix cell's weight/band gradient — left to right — shared so
// every consumer's gradient stays on the same axis.
export const CELL_FILL_DIRECTION = "to right";

export const cellFillGradient = (stops: string[]): string =>
  stops.length === 0
    ? "transparent"
    : `linear-gradient(${CELL_FILL_DIRECTION}, ${stops.join(", ")})`;

type ComboHandlers = {
  onClick?: (combo: string) => void;
  onMouseDown?: (combo: string) => void;
  onMouseEnter?: (combo: string) => void;
  comboStyle?: (combo: string) => CSSProperties;
};

const Combo: FC<{ combo: string } & ComboHandlers> = ({
  combo,
  onClick,
  onMouseDown,
  onMouseEnter,
  comboStyle,
}) => {
  return (
    <div
      className="spotlab-hm-cell"
      style={comboStyle?.(combo)}
      onClick={() => onClick?.(combo)}
      onMouseDown={() => onMouseDown?.(combo)}
      onMouseEnter={() => onMouseEnter?.(combo)}
    >
      <div className="spotlab-hm-cell-inner">
        <div data-combo={combo}>{combo}</div>
      </div>
    </div>
  );
};

const Row: FC<{ row: string[] } & ComboHandlers> = ({ row, ...handlers }) => (
  <div className="spotlab-hm-row">
    {row.map((combo, j) => (
      <Combo key={j} combo={combo} {...handlers} />
    ))}
  </div>
);

export const HandMatrix: FC<{ className?: string } & ComboHandlers> = ({
  className,
  ...handlers
}) => {
  return (
    <div className={["spotlab-hm-root", className].filter(Boolean).join(" ")}>
      {chunk(COMBOS, 13).map((row, i) => (
        <Row key={i} row={row} {...handlers} />
      ))}
    </div>
  );
};
