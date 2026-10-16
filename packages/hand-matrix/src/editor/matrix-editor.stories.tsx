import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn } from "storybook/test";
import { RangeMatrixEditor } from "./matrix-editor";
import type { PaintTool } from "./use-range-painting";
import {
  backgroundImageOf,
  cellsWith,
  dragAcross,
  expectStrokePainted,
  firePointer,
  gradient,
  labelFor,
  mockBandActions,
  mockBandColors,
  mockCappedCombo,
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

const { red: RED, blue: BLUE, clear: CLEAR } = mockBandColors;

// `order` covers only the first action, so whatever weight it leaves stays
// transparent rather than taking the last band's color.
export const PartialOrderBands: Story = {
  args: {
    actions: mockBandActions,
    order: [0],
    cells: cellsWith(
      { avail: 1, weights: [50, 50] },
      {
        KK: { avail: 1, weights: [0, 100] },
        // A capped cell's band layer is already sized to `avail`, so its bands
        // span that layer instead of being scaled by `avail` again.
        AKs: { avail: 0.5, weights: [100, 0] },
        AQs: { avail: 0.5, weights: [50, 50] },
      },
    ),
  },
  play: async ({ canvasElement }) => {
    const root = rootOf(canvasElement);
    expect(backgroundImageOf(root, "AA")).toBe(
      gradient(`${RED} 0%`, `${RED} 50%`, `${CLEAR} 50%`, `${CLEAR} 100%`),
    );
    expect(backgroundImageOf(root, "KK")).toBe("none");
    expect(
      backgroundImageOf(root, "AKs").endsWith(
        gradient(`${RED} 0%`, `${RED} 100%`),
      ),
    ).toBe(true);
    expect(
      backgroundImageOf(root, "AQs").endsWith(
        gradient(`${RED} 0%`, `${RED} 50%`, `${CLEAR} 50%`, `${CLEAR} 100%`),
      ),
    ).toBe(true);
  },
};

// Bands that fill the cell end exactly at 100%, with no transparent tail.
export const FullOrderBands: Story = {
  args: {
    actions: mockBandActions,
    order: [1, 0],
    cells: cellsWith({ avail: 1, weights: [30, 70] }, {}),
  },
  play: async ({ canvasElement }) => {
    expect(backgroundImageOf(rootOf(canvasElement), "AA")).toBe(
      gradient(`${BLUE} 0%`, `${BLUE} 70%`, `${RED} 70%`, `${RED} 100%`),
    );
  },
};

export const PartiallyCapped: Story = {
  play: async ({ canvasElement }) => {
    const root = rootOf(canvasElement);
    expect(backgroundImageOf(root, mockCappedCombo)).toContain(
      "repeating-linear-gradient",
    );
    expect(backgroundImageOf(root, "AA")).not.toContain(
      "repeating-linear-gradient",
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
