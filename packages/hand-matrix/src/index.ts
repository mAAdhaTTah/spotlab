export { RangeMatrix, type RangeMatrixProps } from "./range-matrix";
export { rangeToMatrix } from "./range-to-matrix";

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
  cellsToRanges,
  comboWeightsToCells,
  type EditorCell,
} from "./editor/cells";
export { rebalance, type EditorActionSpec } from "./editor/weights";
