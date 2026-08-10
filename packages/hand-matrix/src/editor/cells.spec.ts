import { actionRange, ingestRanges, seedStrategy } from "./range-conversion";
import { combosToHands } from "./hand-range";
import type {
  Blinds,
  HandFrequency,
  NodeId,
  PublicToActNode,
} from "@/tauri/bindings";
import { combos } from "../hand-matrix";
import { describe, expect, it } from "vitest";

const FOLD = 0;
const RAISE = 1;

const range = (weights: Record<string, number>): HandFrequency[] =>
  combosToHands(
    Object.entries(weights).map(([combo, frequency]) => ({
      combo,
      frequency,
    })),
  );

const state = { pot: 5 as Blinds, players: [], cause: "Start" };

const endNode = {
  type: "PublicEndNode" as const,
  id: "end-1",
  label: "End",
  state,
};

const raiseTarget: PublicToActNode = {
  type: "PublicToActNode",
  id: "node-2" as NodeId,
  label: "SB",
  player: "SB",
  state,
  actions: [],
};

const node = (
  playerRange: HandFrequency[] | null,
  foldRange: HandFrequency[] | null,
  raiseRange: HandFrequency[] | null,
): PublicToActNode => ({
  type: "PublicToActNode",
  id: "node-1" as NodeId,
  label: "BB",
  player: "BB",
  state: {
    pot: 5 as Blinds,
    players: [{ name: "BB", stack: 100 as Blinds, range: playerRange }],
    cause: "Start",
  },
  actions: [
    {
      type: "fold",
      id: "fold-1",
      range: foldRange,
      next: { type: "end", next: endNode },
    },
    {
      type: "raise",
      id: "raise-1",
      size: 5 as Blinds,
      range: raiseRange,
      next: raiseTarget,
    },
  ],
});

const actions = [
  { id: "fold-1", type: "fold" as const, label: "Fold" },
  { id: "raise-1", type: "raise" as const, label: "Raise", size: 5 },
];

const cellFor = (
  strategy: { avail: number; w: number[] }[][],
  combo: string,
) => {
  const index = combos.indexOf(combo);
  return strategy[Math.floor(index / 13)][index % 13];
};

const frequencyFor = (
  painted: { combo: string; frequency: number }[],
  combo: string,
) => painted.find((entry) => entry.combo === combo)?.frequency;

describe("seedStrategy", () => {
  it("divides the stored absolute frequency by the combo's availability", () => {
    const strategy = seedStrategy(
      node(range({ AKs: 0.5 }), range({ AKs: 0.25 }), range({ AKs: 0.25 })),
      actions,
    );

    expect(cellFor(strategy, "AKs")).toEqual({ avail: 0.5, w: [50, 50] });
  });

  it("reads a stored frequency directly when the combo is fully available", () => {
    const strategy = seedStrategy(
      node(null, range({ AKs: 0.75 }), range({ AKs: 0.25 })),
      actions,
    );

    expect(cellFor(strategy, "AKs")).toEqual({ avail: 1, w: [75, 25] });
  });

  it("marks a combo outside the player's range dead and folds it", () => {
    const strategy = seedStrategy(
      node(range({ AKs: 1 }), null, range({ AKs: 1 })),
      actions,
    );

    expect(cellFor(strategy, "72o")).toEqual({ avail: 0, w: [100, 0] });
  });

  it("rescales when the stored frequencies exceed the combo's availability", () => {
    const strategy = seedStrategy(
      node(range({ AKs: 0.5 }), null, range({ AKs: 0.75 })),
      actions,
    );

    expect(cellFor(strategy, "AKs")).toEqual({ avail: 0.5, w: [0, 100] });
  });
});

describe("actionRange", () => {
  it("multiplies the conditional weight by the combo's availability", () => {
    const strategy = seedStrategy(
      node(range({ AKs: 0.5 }), range({ AKs: 0.25 }), range({ AKs: 0.25 })),
      actions,
    );

    expect(frequencyFor(actionRange(strategy, RAISE), "AKs")).toBe(0.25);
    expect(frequencyFor(actionRange(strategy, FOLD), "AKs")).toBe(0.25);
  });

  it("skips dead combos", () => {
    const strategy = seedStrategy(
      node(range({ AKs: 1 }), null, range({ AKs: 1 })),
      actions,
    );

    expect(frequencyFor(actionRange(strategy, RAISE), "72o")).toBeUndefined();
    expect(frequencyFor(actionRange(strategy, FOLD), "72o")).toBeUndefined();
  });
});

describe("ingestRanges", () => {
  it("divides the absolute frequencies rendered by actionRange back to the weights they came from", () => {
    const seeded = seedStrategy(
      node(
        range({ AA: 1, AKs: 0.35, KK: 0.5 }),
        range({ AA: 0.4, AKs: 0.245, KK: 0.1 }),
        range({ AA: 0.6, AKs: 0.105, KK: 0.4 }),
      ),
      actions,
    );

    const ingested = ingestRanges(seeded, actions, [
      null,
      combosToHands(actionRange(seeded, RAISE)),
    ]);

    expect(cellFor(seeded, "AKs")).toEqual({ avail: 0.35, w: [70, 30] });
    expect(ingested).toEqual(seeded);
  });
});
