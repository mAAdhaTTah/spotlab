import { type FC } from "react";
import { HandMatrix, type MatrixDisplayProps } from "../hand-matrix";
import { useRangePainting, type PaintTool } from "./use-range-painting";
import { type EditorCell } from "./cells";

export type RangeMatrixEditorProps = MatrixDisplayProps & {
  brush: number[];
  tool: PaintTool;
  onCellsChange: (cells: EditorCell[]) => void;
  onBrushChange: (brush: number[]) => void;
  onToolChange: (tool: PaintTool) => void;
};

/**
 * The paintable 13x13 range grid: `RangeMatrix`'s cells with brush/eyedropper
 * painting wired onto them. Fully controlled; `useRangePainting` drives the
 * state changes.
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
      cells={cells}
      actions={actions}
      order={order}
      className={className}
      cursorOf={(cell) => {
        if (cell.avail <= 0) return "not-allowed";
        return tool === "eyedropper" ? "copy" : "pointer";
      }}
      onPointerDown={onCellDown}
      onPointerEnter={onCellEnter}
    />
  );
};
