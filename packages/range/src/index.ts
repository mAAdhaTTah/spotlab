import * as wasm from "./wasm/range.js";
import { assertInitialized } from "./init.js";
import { SpotlabInputError } from "./errors.js";
import type { Hand, HandFrequency } from "./types.js";

import {
  RANKS as GENERATED_RANKS,
  SUITS as GENERATED_SUITS,
  COMBOS as GENERATED_COMBOS,
} from "./generated/constants.js";

export { initRange } from "./init.js";
// Widened to `readonly string[]` — the generated constants are literal tuples,
// which would otherwise force every consumer indexing them with a dynamic
// `string` (e.g. a combo looked up by name) to fight the narrower type.
export const RANKS: readonly string[] = GENERATED_RANKS;
export const SUITS: readonly string[] = GENERATED_SUITS;
export const COMBOS: readonly string[] = GENERATED_COMBOS;
export {
  SpotlabInputError,
  RangeInitError,
  RangeNotInitializedError,
} from "./errors.js";
export { Hand } from "./types.js";
export type { HandFrequency } from "./types.js";

/** Parse a range string into its expanded hand-keyed form. */
export function parseRange(input: string): HandFrequency[] {
  assertInitialized("parseRange");
  try {
    return wasm.parse_range(input) as HandFrequency[];
  } catch (raw) {
    throw SpotlabInputError.fromWasm(raw);
  }
}

/** Render a hand-keyed range back to its compacted string form. */
export function formatRange(hands: HandFrequency[]): string {
  assertInitialized("formatRange");
  try {
    return wasm.format_range(hands) as string;
  } catch (raw) {
    throw SpotlabInputError.fromWasm(raw);
  }
}

/** The canonical combo a hand token belongs to (e.g. `AsKd` -> `AKo`). */
export function comboOf(hand: string): string {
  assertInitialized("comboOf");
  try {
    return wasm.combo_of(hand) as string;
  } catch (raw) {
    throw SpotlabInputError.fromWasm(raw);
  }
}

/** Every concrete hand of a canonical combo, already canonical. */
export function handsOfCombo(combo: string): Hand[] {
  assertInitialized("handsOfCombo");
  return wasm.hands_of_combo(combo) as Hand[];
}

/**
 * Collapse a hand-keyed range to the mean weight per combo. `serde-wasm-bindgen`
 * serializes the underlying Rust map as a JS `Map`, not a plain object.
 */
export function toComboWeights(hands: HandFrequency[]): Map<string, number> {
  assertInitialized("toComboWeights");
  try {
    return wasm.to_combo_weights(hands) as Map<string, number>;
  } catch (raw) {
    throw SpotlabInputError.fromWasm(raw);
  }
}

/** Every hand in the deck at weight 1 — the unconstrained range. */
export function fullRange(): HandFrequency[] {
  assertInitialized("fullRange");
  return wasm.full_range() as HandFrequency[];
}
