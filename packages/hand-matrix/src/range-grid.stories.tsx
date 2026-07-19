import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { RangeGrid } from "./range-grid";
import { mockOopFlopRange } from "@/tests/fixtures";

const meta: Meta<typeof RangeGrid> = {
  component: RangeGrid,
  args: {
    range: mockOopFlopRange,
    className: "w-[420px]",
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
