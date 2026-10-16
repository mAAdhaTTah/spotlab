import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  comboOf,
  formatRange,
  fullRange,
  handsOfCombo,
  initRange,
  parseRange,
  toComboWeights,
  RANKS,
  SUITS,
  COMBOS,
} from "./index.js";
import {
  RangeInitError,
  RangeNotInitializedError,
  SpotlabInputError,
} from "./errors.js";

describe("error .name discrimination", () => {
  it("each error class carries its literal .name, without relying on instanceof", () => {
    expect(
      SpotlabInputError.fromWasm({ type: "invalid", data: "x" }).name,
    ).toBe("SpotlabInputError");
    expect(new RangeInitError("boom").name).toBe("RangeInitError");
    expect(new RangeNotInitializedError("parseRange").name).toBe(
      "RangeNotInitializedError",
    );
  });
});

describe("initRange()", () => {
  it("is retryable after a failed instantiation, then idempotent on success", async () => {
    const instantiate = vi
      .spyOn(WebAssembly, "instantiate")
      .mockRejectedValueOnce(new Error("forced failure"));

    await expect(initRange()).rejects.toThrow(RangeInitError);

    instantiate.mockRestore();

    const first = initRange();
    const second = initRange();
    expect(second).toBe(first);
    await expect(first).resolves.toBeUndefined();
  });
});

describe("RANKS / SUITS / COMBOS", () => {
  it("have the expected values, independent of initRange()", () => {
    expect(RANKS).toEqual([
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "T",
      "J",
      "Q",
      "K",
      "A",
    ]);
    expect(SUITS).toEqual(["c", "d", "h", "s"]);
    expect(COMBOS).toHaveLength(169);
    expect(COMBOS[0]).toBe("AA");
  });
});

describe("parseRange / formatRange", () => {
  beforeAll(async () => {
    await initRange();
  });

  it.each(["AKs:0.5,QQ", "AA", "72o:0.25", "22+,A2s+:0.5,KTo-K8o", ""])(
    "round-trips %s",
    (rangeString) => {
      expect(formatRange(parseRange(rangeString))).toBe(rangeString);
    },
  );

  it("rejects an out-of-[0,1] frequency", () => {
    expect(() => parseRange("AKs:5")).toThrow(SpotlabInputError);
    try {
      parseRange("AKs:5");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(SpotlabInputError);
      expect((error as SpotlabInputError).kind).toBe("frequencyOutOfRange");
    }
  });

  it("rejects a malformed token", () => {
    try {
      parseRange("notahand");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(SpotlabInputError);
      expect((error as SpotlabInputError).kind).toBe("invalid");
    }
  });
});

describe("combo helpers", () => {
  beforeAll(async () => {
    await initRange();
  });

  it("comboOf collapses a hand to its combo", () => {
    expect(comboOf("AsKd")).toBe("AKo");
    expect(comboOf("AsKs")).toBe("AKs");
  });

  it("handsOfCombo is the inverse of comboOf over a whole combo", () => {
    const hands = handsOfCombo("AKs");
    expect(hands).toHaveLength(4);
    for (const hand of hands) {
      expect(comboOf(hand)).toBe("AKs");
    }
  });

  it("toComboWeights is the mean over a combo's suit-combinations", () => {
    const weights = toComboWeights(parseRange("AsKs:1,AdKd:0"));
    expect(weights.get("AKs")).toBeCloseTo(0.25);
    expect(weights.get("AA")).toBe(0);
  });

  it("fullRange has every hand at weight 1", () => {
    const deck = fullRange();
    expect(deck).toHaveLength(1326);
    expect(deck.every((hand) => hand.frequency === 1)).toBe(true);
  });
});
