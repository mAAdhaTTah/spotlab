import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, within } from "storybook/test";
import { COMBOS } from "@spotlab/range";
import { RangeMatrixEditor } from "./matrix-editor";
import { seedCells, type EditorCell } from "./cells";
import type { EditorActionSpec } from "./weights";

const actions: EditorActionSpec[] = [
  { id: "fold", label: "Fold", color: "#cbd5e1" },
  { id: "call", label: "Call", color: "#10b981" },
];
const order = [1, 0];

// Every combo starts fully available (avail 1) and split 40/60 between Call
// and Fold; one combo is then knocked down to a partial `avail` to exercise
// the capped-cell border marker, which `mockRangeNodeCapped` in the app's own
// fixtures never does (its combos are all-or-nothing).
const callWeights = new Map(COMBOS.map((combo) => [combo, 0.4]));
const baseCells = seedCells(null, [null, callWeights], 0);
const CAPPED_COMBO = "AKs";
const cappedIndex = COMBOS.indexOf(CAPPED_COMBO);
const cells: EditorCell[] = baseCells.map((cell, i) =>
  i === cappedIndex ? { ...cell, avail: 0.5 } : cell,
);

const meta: Meta<typeof RangeMatrixEditor> = {
  component: RangeMatrixEditor,
  args: {
    actions,
    order,
    cells,
    brush: [60, 40],
    tool: "brush",
    onCellsChange: fn(),
    onBrushChange: fn(),
    onToolChange: fn(),
    className: "w-[420px]",
  },
};
export default meta;
type Story = StoryObj<typeof RangeMatrixEditor>;

export const PartiallyCapped: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const cappedCell = canvas
      .getByText(CAPPED_COMBO)
      .closest(".spotlab-hm-cell");
    if (!cappedCell) {
      throw new Error(
        `expected a .spotlab-hm-cell ancestor for ${CAPPED_COMBO}`,
      );
    }
    const style = getComputedStyle(cappedCell);
    expect(style.backgroundImage).toContain("repeating-linear-gradient");

    const fullCell = canvas.getByText("AA").closest(".spotlab-hm-cell");
    if (!fullCell)
      throw new Error("expected a .spotlab-hm-cell ancestor for AA");
    expect(getComputedStyle(fullCell).backgroundImage).not.toContain(
      "repeating-linear-gradient",
    );
  },
};
