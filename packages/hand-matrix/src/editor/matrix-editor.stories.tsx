import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn } from "storybook/test";
import { RangeMatrixEditor } from "./matrix-editor";
import type { PaintTool } from "./use-range-painting";
import {
  cellFor,
  dragAcross,
  expectStrokePainted,
  firePointer,
  labelFor,
  mockCappedCombo,
  mockDeadCombo,
  mockEditorActions,
  mockEditorCells,
  mockEditorOrder,
  mockPaintBrush,
  mockStroke,
  mockVariedEditorCells,
  rootOf,
  weightsOf,
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

// What the editor adds to `RangeMatrix`'s cells: a pointer to paint with,
// not-allowed on dead cells, and a drag surface for strokes.
export const BrushCursor: Story = {
  args: { cells: mockVariedEditorCells },
  play: async ({ canvasElement }) => {
    const root = rootOf(canvasElement);
    const cursorOf = (combo: string) =>
      getComputedStyle(cellFor(root, combo)).cursor;
    expect(cursorOf("AA")).toBe("pointer");
    expect(cursorOf(mockCappedCombo)).toBe("pointer");
    expect(cursorOf(mockDeadCombo)).toBe("not-allowed");
    expect(getComputedStyle(root).touchAction).toBe("none");
  },
};

export const EyedropperCursor: Story = {
  args: { cells: mockVariedEditorCells, tool: "eyedropper" },
  play: async ({ canvasElement }) => {
    const root = rootOf(canvasElement);
    expect(getComputedStyle(cellFor(root, "AA")).cursor).toBe("copy");
    expect(getComputedStyle(cellFor(root, mockDeadCombo)).cursor).toBe(
      "not-allowed",
    );
  },
};

// The touch case: every event targets the cell the stroke started on, as an
// implicitly captured touch does, so the editor can only paint the rest by
// hit-testing `pointermove` coordinates.
export const TouchDragPaints: Story = {
  args: { brush: mockPaintBrush },
  play: async ({ canvasElement, args }) => {
    const root = rootOf(canvasElement);
    expect(getComputedStyle(root).touchAction).toBe("none");

    dragAcross(root, mockStroke, "touch");
    expectStrokePainted(args.onCellsChange);

    // Released: moving on paints nothing more.
    const start = labelFor(root, "AA");
    firePointer("pointermove", start, labelFor(root, "AJs"), "touch");
    expect(args.onCellsChange).toHaveBeenCalledTimes(mockStroke.length);
  },
};

export const MouseDragPaints: Story = {
  args: { brush: mockPaintBrush },
  play: async ({ canvasElement, args }) => {
    const root = rootOf(canvasElement);

    dragAcross(root, mockStroke, "mouse");
    expectStrokePainted(args.onCellsChange);

    // Hovering with no stroke in progress paints nothing.
    const ajs = labelFor(root, "AJs");
    firePointer("pointermove", ajs, ajs, "mouse");
    expect(args.onCellsChange).toHaveBeenCalledTimes(mockStroke.length);
  },
};

export const PointerCancelEndsStroke: Story = {
  args: { brush: mockPaintBrush },
  play: async ({ canvasElement, args }) => {
    const root = rootOf(canvasElement);
    const start = labelFor(root, "AA");
    firePointer("pointerdown", start, start, "touch");
    firePointer("pointercancel", start, start, "touch");
    firePointer("pointermove", start, labelFor(root, "AKs"), "touch");
    expect(args.onCellsChange).toHaveBeenCalledTimes(1);
  },
};

export const EyedropperPicksCell: Story = {
  args: { tool: "eyedropper" },
  play: async ({ canvasElement, args }) => {
    const root = rootOf(canvasElement);
    dragAcross(root, ["AA", "AKs"], "touch");
    expect(args.onBrushChange).toHaveBeenCalledWith(
      weightsOf(mockEditorCells, "AA"),
    );
    expect(args.onToolChange).toHaveBeenCalledWith("brush");
    expect(args.onCellsChange).not.toHaveBeenCalled();
  },
};

/** A stateful editor to try painting by hand, with a mouse or on a touch device. */
export const Interactive: Story = {
  render: (args) => {
    const [cells, setCells] = useState(args.cells);
    const [brush, setBrush] = useState(args.brush);
    const [tool, setTool] = useState<PaintTool>(args.tool);
    return (
      <div>
        <p>
          <button
            type="button"
            onClick={() => setTool(tool === "brush" ? "eyedropper" : "brush")}
          >
            Tool: {tool}
          </button>{" "}
          Brush: {brush.join(" / ")}
        </p>
        <RangeMatrixEditor
          {...args}
          cells={cells}
          brush={brush}
          tool={tool}
          onCellsChange={setCells}
          onBrushChange={setBrush}
          onToolChange={setTool}
        />
      </div>
    );
  },
  args: { cells: mockVariedEditorCells, brush: mockPaintBrush },
};
