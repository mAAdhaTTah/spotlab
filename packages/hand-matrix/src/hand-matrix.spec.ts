import { describe, expect, it } from "vitest";
import { CELL_FILL_DIRECTION, cellFillGradient } from "./hand-matrix";

describe("cellFillGradient", () => {
  it("fills left to right", () => {
    expect(CELL_FILL_DIRECTION).toBe("to right");
  });

  it("builds a linear-gradient using the canonical direction", () => {
    expect(cellFillGradient(["red 0% 50%", "transparent 50% 100%"])).toBe(
      "linear-gradient(to right, red 0% 50%, transparent 50% 100%)",
    );
  });

  it("returns transparent when there are no stops", () => {
    expect(cellFillGradient([])).toBe("transparent");
  });
});
