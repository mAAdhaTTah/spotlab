import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { mockOopFlopRange } from "./fixtures";
import { RangeGrid } from "./range-grid";

const meta: Meta<typeof RangeGrid> = {
  component: RangeGrid,
  args: {
    range: mockOopFlopRange,
  },
};

export default meta;
type Story = StoryObj<typeof RangeGrid>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(await canvas.findByText("AA")).toBeInTheDocument();
  },
};

function findCell(canvas: ReturnType<typeof within>, combo: string): Element {
  const cell = canvas.getByText(combo).closest(".spotlab-hm-cell");
  if (!cell) {
    throw new Error(`expected an ancestor .spotlab-hm-cell for combo ${combo}`);
  }
  return cell;
}

export const HostileTheme: Story = {
  args: {
    range: mockOopFlopRange,
  },
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
    const canvas = within(canvasElement);
    await canvas.findByText("AA");

    // AA has full weight, so its cell is entirely filled with --spotlab-hm-fill;
    // its border and font-family still come straight off the overridden variables.
    const aaStyle = getComputedStyle(findCell(canvas, "AA"));
    expect(aaStyle.borderColor).toBe("rgb(58, 58, 64)");
    expect(aaStyle.fontFamily).toContain("Georgia");

    // 72o has zero weight, so it renders with no inline background override —
    // its background comes straight off --spotlab-hm-cell-bg.
    const deadStyle = getComputedStyle(findCell(canvas, "72o"));
    expect(deadStyle.backgroundColor).toBe("rgb(26, 26, 30)");
  },
};

export const ClassNameTheme: Story = {
  args: {
    range: mockOopFlopRange,
    className: "spotlab-classname-theme-demo",
  },
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
    const canvas = within(canvasElement);
    await canvas.findByText("AA");

    expect(getComputedStyle(findCell(canvas, "AA")).borderColor).toBe(
      "rgb(255, 0, 255)",
    );
  },
};
