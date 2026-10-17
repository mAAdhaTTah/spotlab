import {
  cellsToComboWeights,
  cellsToRanges,
  comboWeightsToCells,
  seedCells,
  withCell,
  type EditorCell,
} from "./cells";
import {
  COMBOS,
  formatRange,
  initRange,
  parseRange,
  toComboWeights,
} from "@spotlab/range";
import { beforeAll, describe, expect, it } from "vitest";

const FOLD = 0;
const RAISE = 1;

const weightsOf = (combos: Record<string, number>): Map<string, number> =>
  new Map(Object.entries(combos));

const cellFor = (cells: EditorCell[], combo: string) =>
  cells[COMBOS.indexOf(combo)];

const weightOf = (weights: Map<string, number>, combo: string) =>
  weights.get(combo);

describe("seedCells", () => {
  it("divides the stored absolute frequency by the combo's availability", () => {
    const cells = seedCells(
      weightsOf({ AKs: 0.5 }),
      [weightsOf({ AKs: 0.25 }), weightsOf({ AKs: 0.25 })],
      FOLD,
    );

    expect(cellFor(cells, "AKs")).toEqual({ avail: 0.5, weights: [50, 50] });
  });

  it("reads a stored frequency directly when the combo is fully available", () => {
    const cells = seedCells(
      null,
      [weightsOf({ AKs: 0.75 }), weightsOf({ AKs: 0.25 })],
      FOLD,
    );

    expect(cellFor(cells, "AKs")).toEqual({ avail: 1, weights: [75, 25] });
  });

  it("marks a combo outside the parent's availability dead and folds it", () => {
    const cells = seedCells(
      weightsOf({ AKs: 1 }),
      [null, weightsOf({ AKs: 1 })],
      FOLD,
    );

    expect(cellFor(cells, "72o")).toEqual({ avail: 0, weights: [100, 0] });
  });

  it("rescales when the stored frequencies exceed the combo's availability", () => {
    const cells = seedCells(
      weightsOf({ AKs: 0.5 }),
      [null, weightsOf({ AKs: 0.75 })],
      FOLD,
    );

    expect(cellFor(cells, "AKs")).toEqual({ avail: 0.5, weights: [0, 100] });
  });
});

describe("cellsToComboWeights", () => {
  it("multiplies the conditional weight by the combo's availability", () => {
    const cells = seedCells(
      weightsOf({ AKs: 0.5 }),
      [weightsOf({ AKs: 0.25 }), weightsOf({ AKs: 0.25 })],
      FOLD,
    );

    expect(weightOf(cellsToComboWeights(cells, RAISE), "AKs")).toBe(0.25);
    expect(weightOf(cellsToComboWeights(cells, FOLD), "AKs")).toBe(0.25);
  });

  it("skips dead combos", () => {
    const cells = seedCells(
      weightsOf({ AKs: 1 }),
      [null, weightsOf({ AKs: 1 })],
      FOLD,
    );

    expect(weightOf(cellsToComboWeights(cells, RAISE), "72o")).toBeUndefined();
    expect(weightOf(cellsToComboWeights(cells, FOLD), "72o")).toBeUndefined();
  });
});

describe("comboWeightsToCells", () => {
  it("divides the absolute frequencies rendered by cellsToComboWeights back to the weights they came from", () => {
    const seeded = seedCells(
      weightsOf({ AA: 1, AKs: 0.35, KK: 0.5 }),
      [
        weightsOf({ AA: 0.4, AKs: 0.245, KK: 0.1 }),
        weightsOf({ AA: 0.6, AKs: 0.105, KK: 0.4 }),
      ],
      FOLD,
    );

    const ingested = comboWeightsToCells(
      seeded,
      [null, cellsToComboWeights(seeded, RAISE)],
      FOLD,
    );

    expect(cellFor(seeded, "AKs")).toEqual({ avail: 0.35, weights: [70, 30] });
    expect(ingested).toEqual(seeded);
  });
});

describe("cellsToRanges", () => {
  beforeAll(async () => {
    await initRange();
  });

  const IN_RANGE = 0;
  const PASSIVE = 1;

  // One in-range action plus an implicit passive remainder, seeded the way the
  // editor seeds a single stored range.
  const open = (range: string) => {
    const hands = parseRange(range);
    const seed = seedCells(null, [toComboWeights(hands), null], PASSIVE);
    return { hands, seed, original: [hands, null] };
  };

  it("keeps an unedited range verbatim, including what the grid can't show", () => {
    const { hands, seed, original } = open("AhKh:0.7,QQ:0.333,KK+");

    const [inRange] = cellsToRanges(original, seed, seed);

    expect(inRange).toEqual(hands);
    expect(formatRange(inRange)).toBe("AhKh:0.7,QQ:0.333,KK+");
  });

  it("rebuilds a changed combo from the cells in its original position", () => {
    const { seed, original } = open("AhKh:0.7,QQ:0.333,KK+");
    const cells = withCell(seed, "AKs", { avail: 1, weights: [50, 50] });

    const [inRange] = cellsToRanges(original, seed, cells);

    expect(formatRange(inRange)).toBe("AKs:0.5,QQ:0.333,KK+");
  });

  it("appends a combo the original range didn't have", () => {
    const { seed, original } = open("KK+");
    const cells = withCell(seed, "72o", { avail: 1, weights: [100, 0] });

    const [inRange] = cellsToRanges(original, seed, cells);

    expect(formatRange(inRange)).toBe("KK+,72o");
  });

  it("drops a combo painted out of the range", () => {
    const { seed, original } = open("AhKh:0.7,KK+");
    const cells = withCell(seed, "AKs", { avail: 1, weights: [0, 100] });

    const [inRange] = cellsToRanges(original, seed, cells);

    expect(formatRange(inRange)).toBe("KK+");
  });

  it("keeps the original for a cell repainted back to its seed value", () => {
    const { hands, seed, original } = open("AhKh:0.7,KK+");
    const aks = cellFor(seed, "AKs");
    const painted = withCell(seed, "AKs", { avail: 1, weights: [100, 0] });
    const restored = withCell(painted, "AKs", { ...aks });

    const [inRange] = cellsToRanges(original, seed, restored);

    expect(inRange).toEqual(hands);
  });

  it("rebuilds an action with no original range from the cells in full", () => {
    const { seed, original } = open("AhKh:0.7,KK+");

    const [, passive] = cellsToRanges(original, seed, seed);

    expect(toComboWeights(passive).get("KK")).toBe(0);
    expect(toComboWeights(passive).get("72o")).toBe(1);
    expect(toComboWeights(passive).get("AKs")).toBeCloseTo(0.82);
  });

  it("splits a changed combo across every action", () => {
    const call = parseRange("AKs,QQ:0.333");
    const raise = parseRange("KK+");
    const seed = seedCells(
      null,
      [toComboWeights(call), toComboWeights(raise), null],
      2,
    );
    const cells = withCell(seed, "AKs", { avail: 1, weights: [25, 50, 25] });

    const [callOut, raiseOut, foldOut] = cellsToRanges(
      [call, raise, null],
      seed,
      cells,
    );

    expect(formatRange(callOut)).toBe("AKs:0.25,QQ:0.333");
    expect(formatRange(raiseOut)).toBe("KK+,AKs:0.5");
    expect(toComboWeights(foldOut).get("AKs")).toBe(0.25);
  });
});
