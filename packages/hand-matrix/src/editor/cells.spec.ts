import {
  cellsToComboWeights,
  comboWeightsToCells,
  seedCells,
  type EditorCell,
} from "./cells";
import { COMBOS } from "@spotlab/range";
import { describe, expect, it } from "vitest";

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
