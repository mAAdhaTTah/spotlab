import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo } from "react";
import { expect } from "storybook/test";
import { RangeMatrix } from "./range-matrix";
import { rangeToMatrix } from "./range-to-matrix";
import {
  backgroundImageOf,
  cellFor,
  cellsWith,
  gradient,
  mockBandActions,
  mockBandColors,
  mockCappedCombo,
  mockDeadCombo,
  mockEditorActions,
  mockEditorOrder,
  mockOopFlopRange,
  mockVariedEditorCells,
  rootOf,
} from "./fixtures";

const meta: Meta<typeof RangeMatrix> = {
  component: RangeMatrix,
  args: {
    actions: mockEditorActions,
    order: mockEditorOrder,
    cells: mockVariedEditorCells,
  },
};
export default meta;
type Story = StoryObj<typeof RangeMatrix>;

const { red: RED, blue: BLUE, clear: CLEAR } = mockBandColors;

// A read-only grid: no cell offers a pointer, and the grid isn't a drag surface.
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const root = rootOf(canvasElement);
    for (const combo of ["AA", mockCappedCombo, mockDeadCombo]) {
      expect(getComputedStyle(cellFor(root, combo)).cursor).toBe("auto");
    }
    expect(getComputedStyle(root).touchAction).toBe("auto");
  },
};

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

export const DeadCell: Story = {
  play: async ({ canvasElement }) => {
    const root = rootOf(canvasElement);
    const dead = getComputedStyle(cellFor(root, mockDeadCombo));
    expect(dead.backgroundImage).toContain("repeating-linear-gradient");
    expect(dead.backgroundImage).not.toContain("linear-gradient(to right");
  },
};

// One range drawn through `rangeToMatrix`, as `RangeGrid` used to: each cell
// filled to its combo's weight in one color, the rest blank.
const SingleRange = ({
  range,
  color,
  className,
}: {
  range: string;
  color?: string;
  className?: string;
}) => {
  const props = useMemo(() => rangeToMatrix(range, { color }), [range, color]);
  return <RangeMatrix {...props} className={className} />;
};

export const FromRange: Story = {
  render: () => (
    <SingleRange range={mockOopFlopRange} color={mockBandColors.red} />
  ),
  play: async ({ canvasElement }) => {
    const root = rootOf(canvasElement);
    expect(backgroundImageOf(root, "AA")).toBe(
      gradient(`${RED} 0%`, `${RED} 100%`),
    );
    expect(backgroundImageOf(root, "AKo")).toBe(
      gradient(`${RED} 0%`, `${RED} 50%`, `${CLEAR} 50%`, `${CLEAR} 100%`),
    );
    expect(backgroundImageOf(root, "72o")).toBe("none");
    expect(getComputedStyle(cellFor(root, "72o")).cursor).toBe("auto");
  },
};

export const HostileTheme: Story = {
  render: () => <SingleRange range={mockOopFlopRange} />,
  decorators: [
    (Story) => (
      // No Tailwind here on purpose: this is the "hostile" environment a consumer
      // with no build-system assumptions (e.g. the Obsidian plugin) renders into.
      // Overrides target `.spotlab-hm-root` itself, per the package's theming
      // contract — setting the variables on an ancestor alone would not win,
      // because the package's own `.spotlab-hm-root` rule declares them directly.
      <div
        className="spotlab-hostile-theme-demo"
        style={{ background: "#0d0d0f", padding: "2rem" }}
      >
        <style>{`
          .spotlab-hostile-theme-demo .spotlab-hm-root {
            --spotlab-hm-border: #3a3a40;
            --spotlab-hm-cell-bg: #1a1a1e;
            --spotlab-hm-cell-fg: #f4f4f5;
            --spotlab-hm-fill: #f59e0b;
            --spotlab-hm-font-family: Georgia, serif;
          }
        `}</style>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const root = rootOf(canvasElement);

    // AA has full weight, so its cell is entirely filled with --spotlab-hm-fill;
    // its border and font-family still come straight off the overridden variables.
    const aaStyle = getComputedStyle(cellFor(root, "AA"));
    expect(aaStyle.backgroundImage).toBe(
      gradient("rgb(245, 158, 11) 0%", "rgb(245, 158, 11) 100%"),
    );
    expect(aaStyle.borderColor).toBe("rgb(58, 58, 64)");
    expect(aaStyle.fontFamily).toContain("Georgia");

    // Uncovered cells, and the uncovered part of a partly filled one, show
    // --spotlab-hm-cell-bg rather than a band.
    for (const combo of ["72o", "AKo"]) {
      expect(getComputedStyle(cellFor(root, combo)).backgroundColor).toBe(
        "rgb(26, 26, 30)",
      );
    }
  },
};

export const ClassNameTheme: Story = {
  render: () => (
    <SingleRange
      range={mockOopFlopRange}
      className="spotlab-classname-theme-demo"
    />
  ),
  decorators: [
    (Story) => (
      <>
        <style>{`
          .spotlab-classname-theme-demo {
            --spotlab-hm-border: rgb(255, 0, 255);
          }
        `}</style>
        <Story />
      </>
    ),
  ],
  play: async ({ canvasElement }) => {
    expect(
      getComputedStyle(cellFor(rootOf(canvasElement), "AA")).borderColor,
    ).toBe("rgb(255, 0, 255)");
  },
};
