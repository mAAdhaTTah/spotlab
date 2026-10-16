import {
  type CSSProperties,
  type FC,
  type PointerEvent as ReactPointerEvent,
  useRef,
} from "react";
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

export type CellPointerHandler = (
  combo: string,
  event: ReactPointerEvent<HTMLDivElement>,
) => void;

type ComboStyleProp = {
  comboStyle?: (combo: string) => CSSProperties;
};

type GridPointerHandlers = {
  /**
   * A pointer (mouse, pen or touch) went down on `combo`'s cell. The grid
   * first releases the implicit pointer capture a touch takes on the element
   * it starts on, so later moves can resolve to other cells. Passing this
   * also gives the grid root `touch-action: none`.
   */
  onPointerDown?: CellPointerHandler;
  /**
   * The pointer moved onto `combo`'s cell. Resolved by hit-testing each
   * `pointermove` (`elementFromPoint`) rather than by enter events, so it
   * fires across a touch drag, where `mouseenter`/`pointerenter` never reach
   * the other cells, as well as for a mouse. Fires once per change of cell,
   * whether or not a button is pressed.
   */
  onPointerEnter?: CellPointerHandler;
};

// Touch input implicitly captures the pointer to the event's target (the element it landed on), so
// every later `pointermove` targets that element. Release it so the drag can travel. The
// `hasPointerCapture` guard matters: `releasePointerCapture` throws for a pointer id that isn't
// active, as with a synthetic event from a test, where `hasPointerCapture` is simply false. A
// pointer event's target is always an element; cast rather than narrowed with
// `instanceof Element`, which fails for elements from another window (e.g. a popout).
const releaseImplicitCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
  const target = event.target as Element;
  if (target.hasPointerCapture(event.pointerId)) {
    target.releasePointerCapture(event.pointerId);
  }
};

/** The combo of the cell under a viewport point, if that cell belongs to `root`. */
const comboAtPoint = (
  root: HTMLElement,
  clientX: number,
  clientY: number,
): string | null => {
  const hit = root.ownerDocument.elementFromPoint(clientX, clientY);
  const cell = hit?.closest("[data-combo]");
  if (!cell || !root.contains(cell)) return null;
  return cell.getAttribute("data-combo");
};

type CellProps = ComboStyleProp & { onPointerDown?: CellPointerHandler };

const Combo: FC<{ combo: string } & CellProps> = ({
  combo,
  onPointerDown,
  comboStyle,
}) => {
  return (
    <div
      className="spotlab-hm-cell"
      data-combo={combo}
      style={comboStyle?.(combo)}
      onPointerDown={
        onPointerDown &&
        ((event) => {
          releaseImplicitCapture(event);
          onPointerDown(combo, event);
        })
      }
    >
      <div className="spotlab-hm-cell-inner">
        <div data-combo={combo}>{combo}</div>
      </div>
    </div>
  );
};

const Row: FC<{ row: string[] } & CellProps> = ({ row, ...cellProps }) => (
  <div className="spotlab-hm-row">
    {row.map((combo, j) => (
      <Combo key={j} combo={combo} {...cellProps} />
    ))}
  </div>
);

/**
 * The bare 13x13 grid. Each cell carries a `data-combo` attribute. Passing
 * `onPointerDown` marks the grid as a drag surface: its root gets
 * `touch-action: none`, so a touch drag reaches the handlers instead of
 * scrolling the page.
 */
export const HandMatrix: FC<
  { className?: string } & ComboStyleProp & GridPointerHandlers
> = ({ className, onPointerDown, onPointerEnter, ...cellProps }) => {
  // The cell the pointer was last resolved to, so `onPointerEnter` fires once per cell change.
  const lastComboRef = useRef<string | null>(null);

  const trackPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const combo = comboAtPoint(
      event.currentTarget,
      event.clientX,
      event.clientY,
    );
    if (combo === lastComboRef.current) return;
    lastComboRef.current = combo;
    if (combo) onPointerEnter?.(combo, event);
  };

  return (
    <div
      className={["spotlab-hm-root", className].filter(Boolean).join(" ")}
      style={onPointerDown ? { touchAction: "none" } : undefined}
      onPointerDown={
        onPointerEnter &&
        ((event) => {
          // The down cell is already handled by `onPointerDown`; only a move
          // off it should report an enter.
          lastComboRef.current = comboAtPoint(
            event.currentTarget,
            event.clientX,
            event.clientY,
          );
        })
      }
      onPointerMove={onPointerEnter && trackPointer}
      onPointerLeave={onPointerEnter && (() => (lastComboRef.current = null))}
    >
      {chunk(COMBOS, 13).map((row, i) => (
        <Row key={i} row={row} onPointerDown={onPointerDown} {...cellProps} />
      ))}
    </div>
  );
};
