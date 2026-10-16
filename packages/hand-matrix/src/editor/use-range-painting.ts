import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { COMBO_INDEX, type EditorCell } from "./cells";

export type PaintTool = "brush" | "eyedropper";

/**
 * The brush/eyedropper state machine behind `RangeMatrixEditor`: drag-painting
 * and eyedropping a cell's weights back onto the brush. Fully controlled — all
 * state changes go out through the `on*Change` callbacks.
 *
 * Wire `onCellDown` to a cell's pointer-down and `onCellEnter` to the pointer
 * moving onto a cell (`HandMatrix`'s `onPointerDown`/`onPointerEnter` do both,
 * for mouse and touch alike). A stroke ends on any window `pointerup` or
 * `pointercancel`.
 */
export function useRangePainting(opts: {
  cells: EditorCell[];
  brush: number[];
  tool: PaintTool;
  onCellsChange: (cells: EditorCell[]) => void;
  onBrushChange: (brush: number[]) => void;
  onToolChange: (tool: PaintTool) => void;
}) {
  const { cells, brush, tool, onCellsChange, onBrushChange, onToolChange } =
    opts;
  const paintingRef = useRef(false);
  // The latest cells including this stroke's own paints, so cells painted by moves that land
  // before the consumer re-renders build on each other instead of on a stale `cells` prop.
  const cellsRef = useRef(cells);
  useLayoutEffect(() => {
    cellsRef.current = cells;
  }, [cells]);

  useEffect(() => {
    const onUp = () => (paintingRef.current = false);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  const paintCell = useCallback(
    (combo: string) => {
      const current = cellsRef.current;
      const index = COMBO_INDEX.get(combo)!;
      if (current[index].avail <= 0) return;
      const next = current.slice();
      next[index] = { avail: current[index].avail, weights: [...brush] };
      cellsRef.current = next;
      onCellsChange(next);
    },
    [brush, onCellsChange],
  );

  const eyedrop = useCallback(
    (combo: string) => {
      const index = COMBO_INDEX.get(combo)!;
      if (cells[index].avail <= 0) return;
      onBrushChange([...cells[index].weights]);
      onToolChange("brush");
    },
    [cells, onBrushChange, onToolChange],
  );

  const onCellDown = useCallback(
    (combo: string) => {
      if (tool === "eyedropper") {
        eyedrop(combo);
        return;
      }
      paintingRef.current = true;
      paintCell(combo);
    },
    [tool, eyedrop, paintCell],
  );

  const onCellEnter = useCallback(
    (combo: string) => {
      if (paintingRef.current && tool === "brush") paintCell(combo);
    },
    [tool, paintCell],
  );

  return { onCellDown, onCellEnter };
}
