import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, mocked, within } from "storybook/test";
import { COMBOS } from "@spotlab/range";
import { RangeMatrixEditor } from "./matrix-editor";
import type { EditorCell } from "./cells";
import type { PaintTool } from "./use-range-painting";
import {
  dragAcross,
  firePointer,
  labelFor,
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

const rootOf = (canvasElement: HTMLElement) => {
  const root = canvasElement.querySelector<HTMLElement>(".spotlab-hm-root");
  if (!root) throw new Error("expected a .spotlab-hm-root");
  return root;
};

const weightsOf = (cells: EditorCell[], combo: string) =>
  cells[COMBOS.indexOf(combo)].weights;

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

const paintBrush = [0, 100];
const strokes = ["AA", mockCappedCombo, "AQs", "KQs"];

const expectStrokePainted = (onCellsChange: unknown) => {
  const calls = mocked(onCellsChange as (cells: EditorCell[]) => void).mock
    .calls;
  // One change per cell, each building on the previous paint even though the
  // controlled `cells` prop never updates here.
  expect(calls).toHaveLength(strokes.length);
  const painted = calls.at(-1)![0];
  for (const combo of strokes)
    expect(weightsOf(painted, combo)).toEqual(paintBrush);
  expect(weightsOf(painted, "AJs")).toEqual(weightsOf(mockEditorCells, "AJs"));
};

// The touch case: every event targets the cell the stroke started on, as an
// implicitly captured touch does, so the editor can only paint the rest by
// hit-testing `pointermove` coordinates.
export const TouchDragPaints: Story = {
  args: { brush: paintBrush },
  play: async ({ canvasElement, args }) => {
    const root = rootOf(canvasElement);
    expect(getComputedStyle(root).touchAction).toBe("none");

    dragAcross(root, strokes, "touch");
    expectStrokePainted(args.onCellsChange);

    // Released: moving on paints nothing more.
    const start = labelFor(root, "AA");
    firePointer("pointermove", start, labelFor(root, "AJs"), "touch");
    expect(args.onCellsChange).toHaveBeenCalledTimes(strokes.length);
  },
};

export const MouseDragPaints: Story = {
  args: { brush: paintBrush },
  play: async ({ canvasElement, args }) => {
    const root = rootOf(canvasElement);

    dragAcross(root, strokes, "mouse");
    expectStrokePainted(args.onCellsChange);

    // Hovering with no stroke in progress paints nothing.
    const ajs = labelFor(root, "AJs");
    firePointer("pointermove", ajs, ajs, "mouse");
    expect(args.onCellsChange).toHaveBeenCalledTimes(strokes.length);
  },
};

export const PointerCancelEndsStroke: Story = {
  args: { brush: paintBrush },
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
  args: { brush: paintBrush },
};
