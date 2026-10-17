---
npm/@spotlab/hand-matrix: minor
---

`cellsToRanges` now gives a `null` action exactly what is left of each hand in an unchanged combo (the parent weight minus the preserved originals), so every hand's actions sum to its parent weight even when the originals are suit-specific or fractional. A new optional fourth argument, `avail`, takes the parent range per hand (`null` for unconstrained) for parents that weight a combo's hands differently; changed combos then scale each hand by its own parent weight too. Without it, behavior matches the cell's `avail` as before.
