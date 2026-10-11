import { z } from "zod";

/**
 * A canonical 4-character hand token (e.g. `AsKd`), branded so a bare `string`
 * cannot be passed where a validated hand is required. Mirrors the Rust
 * crate's `Hand` newtype and the app's own hand-written brand in
 * `src/tauri/branded.ts`.
 */
export const Hand = z.string().brand("Hand");
export type Hand = z.infer<typeof Hand>;

/**
 * A single concrete hand mapped to its weight in `[0, 1]`. Mirrors the Rust
 * crate's `HandFrequency` wire type.
 */
export type HandFrequency = {
  hand: Hand;
  frequency: number;
};
