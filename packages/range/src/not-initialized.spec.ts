import { describe, expect, it } from "vitest";
import {
  COMBOS,
  RANKS,
  SUITS,
  comboOf,
  formatRange,
  fullRange,
  handsOfCombo,
  parseRange,
  toComboWeights,
} from "./index.js";
import { RangeNotInitializedError } from "./errors.js";

// This file must never call `initRange()` — it exercises the guard every other
// export has before the wasm module is ready. Vitest isolates module state per
// test file, so this is safe to run alongside index.spec.ts, which does init.
describe("before initRange() resolves", () => {
  it.each([
    ["parseRange", () => parseRange("AKs")],
    ["formatRange", () => formatRange([])],
    ["comboOf", () => comboOf("AsKd")],
    ["handsOfCombo", () => handsOfCombo("AKs")],
    ["toComboWeights", () => toComboWeights([])],
    ["fullRange", () => fullRange()],
  ])("%s throws RangeNotInitializedError", (name, call) => {
    expect(call).toThrow(RangeNotInitializedError);
    expect(call).toThrow(
      `call initRange() and await it before using ${name}()`,
    );
  });

  it("RANKS, SUITS, and COMBOS are readable without calling initRange()", () => {
    expect(RANKS).toHaveLength(13);
    expect(SUITS).toHaveLength(4);
    expect(COMBOS).toHaveLength(169);
  });
});
