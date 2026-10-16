/**
 * A canonical 4-character hand token (e.g. `AsKd`), branded so a bare `string`
 * cannot be passed where a validated hand is required. Mirrors the Rust
 * crate's `Hand` newtype.
 *
 * Type-only: the brand has no runtime presence, so importing this package
 * pulls in no validation library. Values come branded from this package's
 * own exports (`parseRange`, `handsOfCombo`, ...); a consumer holding a token
 * it has validated itself can cast (`token as Hand`).
 */
export type Hand = string & { readonly __brand: "Hand" };

/**
 * A single concrete hand mapped to its weight in `[0, 1]`. Mirrors the Rust
 * crate's `HandFrequency` wire type.
 */
export type HandFrequency = {
  hand: Hand;
  frequency: number;
};
