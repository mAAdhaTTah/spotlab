export {
  HandMatrix,
  cellFillGradient,
  CELL_FILL_DIRECTION,
  type CellPointerHandler,
} from "./hand-matrix";
export { RangeGrid } from "./range-grid";

export {
  RangeMatrixEditor,
  type RangeMatrixEditorProps,
} from "./editor/matrix-editor";
export {
  ActionWeightSliders,
  type ActionWeightSlidersProps,
  type WeightInputProps,
} from "./editor/action-sliders";
export { useRangePainting, type PaintTool } from "./editor/use-range-painting";
export {
  seedCells,
  cellsToComboWeights,
  comboWeightsToCells,
  type EditorCell,
} from "./editor/cells";
export { rebalance, type EditorActionSpec } from "./editor/weights";
