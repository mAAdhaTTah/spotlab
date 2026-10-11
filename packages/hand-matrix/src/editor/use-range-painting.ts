import { useCallback, useEffect, useRef } from "react";
import { COMBO_INDEX, type EditorCell } from "./cells";

export type PaintTool = "brush" | "eyedropper";

/**
 * The brush/eyedropper state machine behind `RangeMatrixEditor`: drag-painting
 * (tracked across `pointerdown`/mouse-enter without a React re-render per
 * cell) and eyedropping a cell's weights back onto the brush. Fully
 * controlled — all state changes go out through the `on*Change` callbacks.
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

  useEffect(() => {
    const onUp = () => (paintingRef.current = false);
    window.addEventListener("pointerup", onUp);
    return () => window.removeEventListener("pointerup", onUp);
  }, []);

  const paintCell = useCallback(
    (combo: string) => {
      const index = COMBO_INDEX.get(combo)!;
      if (cells[index].avail <= 0) return;
      const next = cells.slice();
      next[index] = { avail: cells[index].avail, weights: [...brush] };
      onCellsChange(next);
    },
    [cells, brush, onCellsChange],
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
