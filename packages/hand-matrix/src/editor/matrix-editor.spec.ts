import { describe, expect, it } from "vitest";
import { bandBackground } from "./matrix-editor";
import type { EditorActionSpec } from "./weights";

const actions: EditorActionSpec[] = [
  { id: "in", label: "In", color: "red" },
  { id: "out", label: "Out", color: "blue" },
];

describe("bandBackground", () => {
  it("leaves the part of the cell `order` doesn't cover transparent", () => {
    expect(bandBackground({ avail: 1, weights: [50, 50] }, actions, [0])).toBe(
      "linear-gradient(to right, red 0%, red 50%, transparent 50% 100%)",
    );
  });

  // A capped cell's band layer is already sized to `avail`, so its bands span
  // the layer rather than being scaled by `avail` again.
  it("lays a capped cell's bands out across its band layer", () => {
    expect(
      bandBackground({ avail: 0.5, weights: [100, 0] }, actions, [0, 1]),
    ).toBe("linear-gradient(to right, red 0%, red 100%)");
    expect(
      bandBackground({ avail: 0.5, weights: [50, 50] }, actions, [0]),
    ).toBe("linear-gradient(to right, red 0%, red 50%, transparent 50% 100%)");
  });

  it("adds no tail when the bands fill the cell", () => {
    expect(
      bandBackground({ avail: 1, weights: [30, 70] }, actions, [1, 0]),
    ).toBe("linear-gradient(to right, blue 0%, blue 70%, red 70%, red 100%)");
  });

  it("is transparent when no band has weight", () => {
    expect(bandBackground({ avail: 1, weights: [0, 100] }, actions, [0])).toBe(
      "transparent",
    );
  });
});
