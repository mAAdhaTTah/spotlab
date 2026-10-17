import {
  type CSSProperties,
  type FC,
  type PointerEvent as ReactPointerEvent,
  useRef,
} from "react";
import { COMBOS } from "@spotlab/range";
import { COMBO_INDEX, type EditorCell } from "./editor/cells";
import type { EditorActionSpec } from "./editor/weights";

const chunk = (arr: readonly string[], size: number) =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size),
  );

const cellFillGradient = (stops: string[]): string =>
  `linear-gradient(to right, ${stops.join(", ")})`;

/**
 * A cell's stacked action bands, as a gradient across the band layer. For a
 * capped cell that layer is already sized to the cell's `avail`, so the bands
 * are laid out relative to the layer, not scaled by `avail` a second time.
 * Whatever `order` leaves uncovered stays transparent rather than letting the
 * last band's color run on to the edge. `none` when no band is drawn.
 */
const bandBackground = (
  cell: EditorCell,
  actions: EditorActionSpec[],
  order: number[],
): string => {
  const stops: string[] = [];
  let cursor = 0;
  order.forEach((k) => {
    const fraction = (cell.weights[k] || 0) / 100;
    if (fraction <= 0) return;
    const color = actions[k].color;
    stops.push(`${color} ${cursor * 100}%`);
    stops.push(`${color} ${(cursor + fraction) * 100}%`);
    cursor += fraction;
  });
  // The epsilon keeps float noise in weights summing to 100 from adding a sliver of a tail.
  if (stops.length > 0 && cursor < 1 - 1e-9) {
    stops.push(`transparent ${cursor * 100}% 100%`);
  }
  return stops.length > 0 ? cellFillGradient(stops) : "none";
};

// Only ever `background-image` (never the `background` shorthand, which resets
// `background-color`), so the themed `--spotlab-hm-cell-bg` shows through
// wherever a cell's bands leave it uncovered.
const cellStyle = (
  cell: EditorCell,
  actions: EditorActionSpec[],
  order: number[],
): CSSProperties => {
  if (cell.avail <= 0) {
    return {
      backgroundImage: "var(--spotlab-hm-dead-hatch)",
      backgroundColor: "var(--spotlab-hm-muted-bg)",
      color: "var(--spotlab-hm-muted-fg)",
    };
  }
  if (cell.avail < 1) {
    const capLeft = `${cell.avail * 100}%`;
    const capBorder = `repeating-linear-gradient(180deg, var(--spotlab-hm-muted-fg) 0 4px, transparent 4px 8px)`;
    return {
      backgroundImage: `${capBorder}, var(--spotlab-hm-dead-hatch), ${bandBackground(cell, actions, order)}`,
      backgroundSize: `1px 100%, ${(1 - cell.avail) * 100}% 100%, ${cell.avail * 100}% 100%`,
      backgroundPosition: `${capLeft} center, right center, left center`,
      backgroundRepeat: "no-repeat, no-repeat, no-repeat",
    };
  }
  return { backgroundImage: bandBackground(cell, actions, order) };
};

type CellPointerHandler = (
  combo: string,
  event: ReactPointerEvent<HTMLDivElement>,
) => void;

type GridPointerHandlers = {
  /**
   * A pointer (mouse, pen or touch) went down on `combo`'s cell. The grid
   * first releases the implicit pointer capture a touch takes on the element
   * it starts on, so later moves can resolve to other cells. Passing this
   * also makes the grid root a drag surface (see `dragSurfaceStyle`).
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

// A drag across the grid should neither scroll the page (`touch-action`), select the combo
// text it crosses (`user-select`, prefixed for Safari), nor open iOS's long-press callout.
const dragSurfaceStyle: CSSProperties = {
  touchAction: "none",
  userSelect: "none",
  WebkitUserSelect: "none",
  WebkitTouchCallout: "none",
};

/** The cell data both `RangeMatrix` and `RangeMatrixEditor` draw from. */
export type MatrixDisplayProps = {
  /** The 169-cell grid, in `@spotlab/range`'s `COMBOS` order. */
  cells: EditorCell[];
  /** Index-aligned with each cell's `weights` array. */
  actions: EditorActionSpec[];
  /**
   * Indices into `actions`/`weights`, in the order bands should stack. An
   * action left out isn't drawn, so its share of a cell stays transparent.
   */
  order: number[];
  className?: string;
};

/**
 * The 13x13 grid that `RangeMatrix` and `RangeMatrixEditor` both render, so
 * the two draw cells identically: each cell stacks its actions' weights as
 * bands in `order`, with dead and capped cells marked. Each cell carries a
 * `data-combo` attribute. The editor adds a per-cell cursor and the painting
 * handlers; passing `onPointerDown` also makes the grid a drag surface
 * (`dragSurfaceStyle`), so a drag reaches the handlers instead of scrolling
 * the page or selecting text. Internal: not exported from the package root.
 */
export const HandMatrix: FC<
  MatrixDisplayProps &
    GridPointerHandlers & {
      cursorOf?: (cell: EditorCell) => CSSProperties["cursor"];
    }
> = ({
  cells,
  actions,
  order,
  className,
  cursorOf,
  onPointerDown,
  onPointerEnter,
}) => {
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
      style={onPointerDown ? dragSurfaceStyle : undefined}
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
        <div key={i} className="spotlab-hm-row">
          {row.map((combo) => {
            const cell = cells[COMBO_INDEX.get(combo)!];
            return (
              <div
                key={combo}
                className="spotlab-hm-cell"
                data-combo={combo}
                style={{
                  ...cellStyle(cell, actions, order),
                  cursor: cursorOf?.(cell),
                }}
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
          })}
        </div>
      ))}
    </div>
  );
};
