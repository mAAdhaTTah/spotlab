export {
  HandMatrix,
  cellFillGradient,
  CELL_FILL_DIRECTION,
} from "./hand-matrix";
export type { CellPointerHandler } from "./hand-matrix";
export { RangeGrid } from "./range-grid";

export { RangeMatrixEditor } from "./editor/matrix-editor";
export type { RangeMatrixEditorProps } from "./editor/matrix-editor";
export { ActionWeightSliders } from "./editor/action-sliders";
export type {
  ActionWeightSlidersProps,
  WeightInputProps,
} from "./editor/action-sliders";
export { useRangePainting } from "./editor/use-range-painting";
export type { PaintTool } from "./editor/use-range-painting";
export {
  seedCells,
  cellsToComboWeights,
  comboWeightsToCells,
} from "./editor/cells";
export type { EditorCell } from "./editor/cells";
export { rebalance } from "./editor/weights";
export type { EditorActionSpec } from "./editor/weights";
