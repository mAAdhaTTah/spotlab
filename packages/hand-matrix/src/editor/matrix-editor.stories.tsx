import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, within } from "storybook/test";
import { RangeMatrixEditor } from "./matrix-editor";
import {
  mockCappedCombo,
  mockEditorActions,
  mockEditorCells,
  mockEditorOrder,
} from "../fixtures";

const meta: Meta<typeof RangeMatrixEditor> = {
  component: RangeMatrixEditor,
  args: {
    actions: mockEditorActions,
    order: mockEditorOrder,
    cells: mockEditorCells,
    brush: [60, 40],
    tool: "brush",
    onCellsChange: fn(),
    onBrushChange: fn(),
    onToolChange: fn(),
  },
};
export default meta;
type Story = StoryObj<typeof RangeMatrixEditor>;

export const PartiallyCapped: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const cappedCell = canvas
      .getByText(mockCappedCombo)
      .closest(".spotlab-hm-cell");
    if (!cappedCell) {
      throw new Error(
        `expected a .spotlab-hm-cell ancestor for ${mockCappedCombo}`,
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
