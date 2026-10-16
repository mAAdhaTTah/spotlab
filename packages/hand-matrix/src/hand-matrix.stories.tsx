import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, mocked, spyOn, userEvent } from "storybook/test";
import { HandMatrix } from "./hand-matrix";
import { dragAcross, firePointer, labelFor } from "./fixtures";

const meta: Meta<typeof HandMatrix> = {
  component: HandMatrix,
  args: {
    onClick: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof HandMatrix>;

const rootOf = (canvasElement: HTMLElement) => {
  const root = canvasElement.querySelector<HTMLElement>(".spotlab-hm-root");
  if (!root) throw new Error("expected a .spotlab-hm-root");
  return root;
};

export const Default: Story = {
  async play({ canvas }) {
    expect(await canvas.findByText("AA")).toBeInTheDocument();
    expect(await canvas.findByText("22")).toBeInTheDocument();
    expect(await canvas.findByText("AKs")).toBeInTheDocument();
  },
};

export const WithComboStyle: Story = {
  args: {
    comboStyle: (combo) =>
      combo === "AA" ? { backgroundColor: "#22c55e", color: "white" } : {},
  },
  async play({ canvas }) {
    expect(await canvas.findByText("AA")).toBeInTheDocument();
  },
};

export const ClickCombo: Story = {
  async play({ canvas, args }) {
    const aaCell = await canvas.findByText("AA", {
      selector: "[data-combo]",
    });
    await userEvent.click(aaCell);
    expect(args.onClick).toHaveBeenCalledWith("AA");
  },
};

export const ReadOnlyKeepsTouchScrolling: Story = {
  async play({ canvasElement }) {
    expect(getComputedStyle(rootOf(canvasElement)).touchAction).toBe("auto");
  },
};

export const PointerDragAcrossCells: Story = {
  args: { onPointerDown: fn(), onPointerEnter: fn() },
  async play({ canvasElement, args }) {
    const root = rootOf(canvasElement);
    expect(getComputedStyle(root).touchAction).toBe("none");

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
    try {
      firePointer("pointerdown", label, label, "touch");
      expect(hasCapture).toHaveBeenCalledWith(2);
      expect(release).toHaveBeenCalledWith(2);
      expect(args.onPointerDown).toHaveBeenCalledWith("AA", expect.anything());
    } finally {
      firePointer("pointerup", label, label, "touch");
      hasCapture.mockRestore();
      release.mockRestore();
    }
  },
};
