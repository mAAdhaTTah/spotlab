---
npm/@spotlab/range: minor
---

Drop the runtime `zod` dependency. `Hand` is now a type-only brand (`string & { readonly __brand: "Hand" }`), so importing `@spotlab/range` no longer pulls zod into consumer bundles. Breaking: `Hand` is no longer exported as a value, and as a type it is no longer interchangeable with a zod `z.string().brand("Hand")` brand (consumers aliasing their own zod brand should re-export this type instead); code that called `Hand.parse(...)` should cast a validated token (`token as Hand`) or validate with its own schema. Also drops the `Error: ` prefix from `SpotlabInputError.message` when `formatRange` / `toComboWeights` reject malformed input.
