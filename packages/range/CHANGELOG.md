# @spotlab/range

## 0.3.0 — 2026-10-17

### Minor changes

- [e5c307c](https://github.com/mAAdhaTTah/spotlab/commit/e5c307c806aae67c338a25a92c353f9571c822f9) Add `expandComboWeights`, which expands a per-combo weight map to every hand of each combo. It is the inverse of `toComboWeights` and throws `SpotlabInputError` for an unknown combo or a weight outside [0, 1].

## 0.2.0 — 2026-10-16

### Minor changes

- [2421e81](https://github.com/mAAdhaTTah/spotlab/commit/2421e81503259edf1b7ba82c932f793042976548) Drop the runtime `zod` dependency. `Hand` is now a type-only brand (`string & { readonly __brand: "Hand" }`), so importing `@spotlab/range` no longer pulls zod into consumer bundles. Breaking: `Hand` is no longer exported as a value, and as a type it is no longer interchangeable with a zod `z.string().brand("Hand")` brand (consumers aliasing their own zod brand should re-export this type instead); code that called `Hand.parse(...)` should cast a validated token (`token as Hand`) or validate with its own schema. Also drops the `Error: ` prefix from `SpotlabInputError.message` when `formatRange` / `toComboWeights` reject malformed input.
- [7b012a8](https://github.com/mAAdhaTTah/spotlab/commit/7b012a8b9c4831c4f89e274dd9716c40613f2c35) Bundles spotlab-range 0.2.0: `parseRange` accepts range shorthand (`22+`, `A2s+`, `KTo+`, `TT-77`, `A5s-A2s`), and `formatRange` renders contiguous same-weight runs back to it (e.g. `AA,KK,QQ` → `QQ+`).

## 0.1.0 — 2026-10-16

Initial release. Bundles spotlab-range 0.1.0 compiled to wasm, behind `initRange()`: `parseRange`, `formatRange`, `comboOf`, `handsOfCombo`, `toComboWeights`, `fullRange`, the `RANKS` / `SUITS` / `COMBOS` constants, a zod-branded `Hand` schema, and the `SpotlabInputError`, `RangeInitError` and `RangeNotInitializedError` error types.
