import { type FC } from "react";
import { cellFillGradient, HandMatrix } from "../hand-matrix";
import { useRangePainting, type PaintTool } from "./use-range-painting";
import { COMBO_INDEX, type EditorCell } from "./cells";
import type { EditorActionSpec } from "./weights";

/**
 * A cell's stacked action bands, as a gradient across the band layer. For a
 * capped cell that layer is already sized to the cell's `avail`, so the bands
 * are laid out relative to the layer, not scaled by `avail` a second time.
 * Whatever `order` leaves uncovered stays transparent rather than letting the
 * last band's color run on to the edge.
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
  return cellFillGradient(stops);
};

export type RangeMatrixEditorProps = {
  /** The 169-cell grid, in `@spotlab/range`'s `COMBOS` order. */
  cells: EditorCell[];
  /** Index-aligned with each cell's `weights` array. */
  actions: EditorActionSpec[];
  /** Indices into `actions`/`weights`, in the order bands should stack — a display concern the consumer owns (e.g. biggest raise first). */
  order: number[];
  brush: number[];
  tool: PaintTool;
  onCellsChange: (cells: EditorCell[]) => void;
  onBrushChange: (brush: number[]) => void;
  onToolChange: (tool: PaintTool) => void;
  className?: string;
};

/**
 * The paintable 13x13 range grid: per-cell action bands, the dead-cell hatch,
 * the capped-cell cap marker, and the brush/eyedropper painting wired onto
 * `HandMatrix`. Fully controlled; `useRangePainting` drives the state changes.
 */
export const RangeMatrixEditor: FC<RangeMatrixEditorProps> = ({
  cells,
  actions,
  order,
  brush,
  tool,
  onCellsChange,
  onBrushChange,
  onToolChange,
  className,
}) => {
  const { onCellDown, onCellEnter } = useRangePainting({
    cells,
    brush,
    tool,
    onCellsChange,
    onBrushChange,
    onToolChange,
  });

  return (
    <HandMatrix
      className={className}
      comboStyle={(combo) => {
        const cell = cells[COMBO_INDEX.get(combo)!];
        if (cell.avail <= 0) {
          return {
            background: "var(--spotlab-hm-dead-hatch)",
            backgroundColor: "var(--spotlab-hm-muted-bg)",
            cursor: "not-allowed",
            color: "var(--spotlab-hm-muted-fg)",
          };
        }
        const cursor = tool === "eyedropper" ? "copy" : "pointer";
        if (cell.avail < 1) {
          const capLeft = `${cell.avail * 100}%`;
          const capBorder = `repeating-linear-gradient(180deg, var(--spotlab-hm-muted-fg) 0 4px, transparent 4px 8px)`;
          return {
            background: `${capBorder}, var(--spotlab-hm-dead-hatch), ${bandBackground(cell, actions, order)}`,
            backgroundSize: `1px 100%, ${(1 - cell.avail) * 100}% 100%, ${cell.avail * 100}% 100%`,
            backgroundPosition: `${capLeft} center, right center, left center`,
            backgroundRepeat: "no-repeat, no-repeat, no-repeat",
            cursor,
          };
        }
        return { background: bandBackground(cell, actions, order), cursor };
      }}
      onPointerDown={onCellDown}
      onPointerEnter={onCellEnter}
    />
  );
};
