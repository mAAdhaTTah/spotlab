import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, mocked, spyOn } from "storybook/test";
import { HandMatrix } from "./hand-matrix";
import {
  dragAcross,
  firePointer,
  labelFor,
  mockEditorActions,
  mockEditorOrder,
  mockVariedEditorCells,
  rootOf,
} from "./fixtures";

// `HandMatrix` is internal: these stories cover the grid and pointer handling
// that `RangeMatrix` and `RangeMatrixEditor` share.
const meta: Meta<typeof HandMatrix> = {
  component: HandMatrix,
  args: {
    cells: mockVariedEditorCells,
    actions: mockEditorActions,
    order: mockEditorOrder,
  },
};

export default meta;
type Story = StoryObj<typeof HandMatrix>;

export const Default: Story = {
  async play({ canvas }) {
    expect(await canvas.findByText("AA")).toBeInTheDocument();
    expect(await canvas.findByText("22")).toBeInTheDocument();
    expect(await canvas.findByText("AKs")).toBeInTheDocument();
  },
};

// A read-only grid keeps the browser's defaults: touch scrolls the page, and
// combo text can be selected and copied.
export const ReadOnlyKeepsScrollAndSelection: Story = {
  async play({ canvasElement }) {
    const style = getComputedStyle(rootOf(canvasElement));
    expect(style.touchAction).toBe("auto");
    expect(style.userSelect).toBe("auto");
  },
};

export const PointerDragAcrossCells: Story = {
  args: { onPointerDown: fn(), onPointerEnter: fn() },
  async play({ canvasElement, args }) {
    const root = rootOf(canvasElement);
    // A drag neither scrolls the page nor selects the combo text it crosses.
    expect(getComputedStyle(root).touchAction).toBe("none");
    expect(getComputedStyle(root).userSelect).toBe("none");

    for (const pointerType of ["touch", "mouse"] as const) {
      mocked(args.onPointerDown!).mockClear();
      mocked(args.onPointerEnter!).mockClear();

      dragAcross(root, ["AA", "AKs", "AQs", "KQs"], pointerType);

      expect(args.onPointerDown).toHaveBeenCalledTimes(1);
      expect(args.onPointerDown).toHaveBeenCalledWith("AA", expect.anything());
      expect(
        mocked(args.onPointerEnter!).mock.calls.map(([combo]) => combo),
      ).toEqual(["AKs", "AQs", "KQs"]);
    }
  },
};

export const PointerDownReleasesImplicitCapture: Story = {
  args: { onPointerDown: fn(), onPointerEnter: fn() },
  async play({ canvasElement, args }) {
    const label = labelFor(rootOf(canvasElement), "AA");
    // A synthetic event can't take a real capture, so stand in for the one a
    // touch implicitly sets on the element it lands on.
    const hasCapture = spyOn(label, "hasPointerCapture").mockReturnValue(true);
    const release = spyOn(label, "releasePointerCapture").mockImplementation(
      () => {},
    );
    firePointer("pointerdown", label, label, "touch");
    expect(hasCapture).toHaveBeenCalledWith(2);
    expect(release).toHaveBeenCalledWith(2);
    expect(args.onPointerDown).toHaveBeenCalledWith("AA", expect.anything());
  },
};
