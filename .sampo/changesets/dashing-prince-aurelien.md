---
npm/@spotlab/range: minor
---

Add `expandComboWeights`, which expands a per-combo weight map to every hand of each combo. It is the inverse of `toComboWeights` and throws `SpotlabInputError` for an unknown combo or a weight outside [0, 1].
