import { COMBOS, initRange, parseRange } from "@spotlab/range";
import { beforeAll, describe, expect, it } from "vitest";
import { rangeToMatrix } from "./range-to-matrix";
import type { EditorCell } from "./editor/cells";

describe("rangeToMatrix", () => {
  beforeAll(async () => {
    await initRange();
  });

  const cellFor = (cells: EditorCell[], combo: string) =>
    cells[COMBOS.indexOf(combo)];

  it("fills each fully available cell to its combo's exact mean weight", () => {
    const { cells } = rangeToMatrix("AA,QQ:0.333,AsKs");

    expect(cellFor(cells, "AA")).toEqual({ avail: 1, weights: [100, 0] });
    const qq = cellFor(cells, "QQ");
    expect(qq.avail).toBe(1);
    expect(qq.weights[0]).toBeCloseTo(33.3, 10);
    expect(qq.weights[0] + qq.weights[1]).toBe(100);
    expect(cellFor(cells, "AKs")).toEqual({ avail: 1, weights: [25, 75] });
    expect(cellFor(cells, "72o")).toEqual({ avail: 1, weights: [0, 100] });
  });

  it("draws only the in-range action, in the given color", () => {
    const { actions, order } = rangeToMatrix("AA", { color: "red" });

    expect(order).toEqual([0]);
    expect(actions[0].color).toBe("red");
    expect(rangeToMatrix("AA").actions[0].color).toBe("var(--spotlab-hm-fill)");
  });

  it("labels its actions, defaulting to in and out of range", () => {
    expect(rangeToMatrix("AA").actions.map((a) => a.label)).toEqual([
      "In range",
      "Out of range",
    ]);
    expect(
      rangeToMatrix("AA", { labels: { in: "Raise" } }).actions.map(
        (a) => a.label,
      ),
    ).toEqual(["Raise", "Out of range"]);
    expect(
      rangeToMatrix("AA", { labels: { in: "Raise", out: "Fold" } }).actions.map(
        (a) => a.label,
      ),
    ).toEqual(["Raise", "Fold"]);
  });

  it("takes the expanded hand-keyed form as well as a string", () => {
    expect(rangeToMatrix(parseRange("AA,AKo:0.5"))).toEqual(
      rangeToMatrix("AA,AKo:0.5"),
    );
  });
});
