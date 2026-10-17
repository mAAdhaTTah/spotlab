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
  fullRange,
  initRange,
  parseRange,
  toComboWeights,
  type HandFrequency,
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

  // What strategy-builder validates on save: for every hand in the deck, the
  // actions' weights sum to the parent's weight for it (within 1e-6).
  const expectHandsSumTo = (
    ranges: HandFrequency[][],
    parent: HandFrequency[],
  ) => {
    const sums = new Map<string, number>();
    for (const { hand, frequency } of ranges.flat())
      sums.set(hand, (sums.get(hand) ?? 0) + frequency);
    const expected = new Map<string, number>(
      parent.map(({ hand, frequency }) => [hand, frequency]),
    );
    for (const { hand } of fullRange()) {
      expect(sums.get(hand) ?? 0, hand).toBeCloseTo(expected.get(hand) ?? 0, 6);
    }
  };

  it("gives a null action what's left of each hand in an unchanged combo", () => {
    const { seed, original } = open("AhKh:0.7,QQ:0.333,KK+");

    const ranges = cellsToRanges(original, seed, seed);
    const passive = new Map<string, number>(
      ranges[PASSIVE].map(({ hand, frequency }) => [hand, frequency]),
    );

    expect(passive.get("AhKh")).toBe(0.3);
    expect(passive.get("AsKs")).toBe(1);
    expect(passive.get("QhQs")).toBe(0.667);
    expect(passive.has("KhKs")).toBe(false);
    expect(passive.get("7c2d")).toBe(1);
    expectHandsSumTo(ranges, fullRange());
  });

  it("splits what's left of each hand across null actions by cell weight", () => {
    const raise = parseRange("AhKh:0.7");
    const seed = withCell(
      seedCells(null, [toComboWeights(raise), null, null], 2),
      "AKs",
      { avail: 1, weights: [18, 30, 52] },
    );

    const ranges = cellsToRanges([raise, null, null], seed, seed);
    const frequencyOf = (range: HandFrequency[], hand: string) =>
      range.find((h) => h.hand === hand)?.frequency;

    expect(frequencyOf(ranges[1], "AhKh")).toBeCloseTo((0.3 * 30) / 82, 8);
    expect(frequencyOf(ranges[2], "AhKh")).toBeCloseTo((0.3 * 52) / 82, 8);
    expectHandsSumTo(ranges, fullRange());
  });

  it("follows a per-hand parent range in unchanged and changed combos", () => {
    const parent = parseRange("AhKh,AsKs:0.5,QQ");
    const raise = parseRange("AhKh:0.5,QQ:0.25");
    const seed = seedCells(
      toComboWeights(parent),
      [toComboWeights(raise), null],
      PASSIVE,
    );
    const cells = withCell(seed, "QQ", { avail: 1, weights: [40, 60] });

    const unchanged = cellsToRanges([raise, null], seed, seed, parent);
    expect(formatRange(unchanged[PASSIVE])).toBe("AhKh:0.5,AsKs:0.5,QQ:0.75");
    expectHandsSumTo(unchanged, parent);

    const aks = cellFor(seed, "AKs");
    const repainted = cellsToRanges(
      [raise, null],
      seed,
      withCell(cells, "AKs", { ...aks, weights: [50, 50] }),
      parent,
    );
    expect(formatRange(repainted[IN_RANGE])).toBe("AhKh:0.5,AsKs:0.25,QQ:0.4");
    expectHandsSumTo(repainted, parent);
  });

  it("treats a null parent range as every hand at weight 1", () => {
    const { seed, original } = open("AhKh:0.7,KK+");

    expect(cellsToRanges(original, seed, seed, null)).toEqual(
      cellsToRanges(original, seed, seed),
    );
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
