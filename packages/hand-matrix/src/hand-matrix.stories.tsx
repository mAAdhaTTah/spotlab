import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent } from "storybook/test";
import { HandMatrix } from "./hand-matrix";

const meta: Meta<typeof HandMatrix> = {
  component: HandMatrix,
  args: {
    className: "w-[400px]",
    onClick: fn(),
    onMouseDown: fn(),
    onMouseEnter: fn(),
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
