# @spotlab/hand-matrix

## 0.5.0 — 2026-10-17

### Minor changes

- [f819fcf](https://github.com/mAAdhaTTah/spotlab/commit/f819fcf28229f927c9f20b87ba310876dea1274d) Add `RangeMatrix`, the read-only grid, which replaces `RangeGrid`. It takes the same `cells`, `actions` and `order` as `RangeMatrixEditor` and draws exactly what the editor draws (stacked action bands, a transparent share for actions left out of `order`, hatched dead cells and capped-cell markers), without painting and with the default cursor. `RangeMatrixEditor` now renders through it. For a single range, `rangeToMatrix(range, { color })` builds its props: `<RangeMatrix {...rangeToMatrix(range, { color })} />` draws what `<RangeGrid range={range} fill={color} />` did, and an optional `labels: { in, out }` names its two actions for a legend of your own.
  
  Breaking: `RangeGrid` is removed; use `RangeMatrix` with `rangeToMatrix` instead. The bare `HandMatrix` grid and its helpers `cellFillGradient`, `CELL_FILL_DIRECTION` and `CellPointerHandler` are no longer exported; `RangeMatrix` and `RangeMatrixEditor` are the grids to use. Also, cells now set only `background-image`, so a themed `--spotlab-hm-cell-bg` shows through the uncovered part of every cell (the editor's included) rather than being reset to transparent.

## 0.4.0 — 2026-10-17

### Minor changes

- [cb9bba0](https://github.com/mAAdhaTTah/spotlab/commit/cb9bba0f8a98e4feae907e33ad8c4242f58a04cd) `cellsToRanges` now gives a `null` action exactly what is left of each hand in an unchanged combo (the parent weight minus the preserved originals), so every hand's actions sum to its parent weight even when the originals are suit-specific or fractional. A new optional fourth argument, `avail`, takes the parent range per hand (`null` for unconstrained) for parents that weight a combo's hands differently; changed combos then scale each hand by its own parent weight too. Without it, behavior matches the cell's `avail` as before.

## 0.3.0 — 2026-10-17

### Minor changes

- [e5c307c](https://github.com/mAAdhaTTah/spotlab/commit/e5c307c806aae67c338a25a92c353f9571c822f9) Add `cellsToRanges`, which turns an edited grid back into one range per action. Combos the user did not repaint keep their original hands verbatim, so suit-specific and fractional weights survive a save.

### Patch changes

- Updated dependencies: @spotlab/range (npm)@0.3.0

## 0.2.0 — 2026-10-16

### Minor changes

- [e81fa4d](https://github.com/mAAdhaTTah/spotlab/commit/e81fa4d65ba67327a249fd7d084843399cbb8782) Painting in `RangeMatrixEditor` now works on touch devices. The grid uses pointer events and hit-tests each `pointermove` against the cell under the pointer, so a finger drag paints every cell it crosses, and the grid sets `touch-action: none` and `user-select: none` so a drag neither scrolls the page nor selects the combo text it crosses (with mouse or touch). Mouse painting works as before, through the same pointer events. `HandMatrix` gains generic `onPointerDown`/`onPointerEnter` props (`(combo, event)`) for building drag interactions, and each `.spotlab-hm-cell` now carries a `data-combo` attribute. Breaking: `HandMatrix`'s `onClick`, `onMouseDown` and `onMouseEnter` props are removed; use `onPointerDown`/`onPointerEnter` instead (mouse-enter never fires during a touch drag).
  
  `RangeMatrixEditor` no longer draws a cell as fully painted when `order` covers only part of its weight: the uncovered remainder is now transparent instead of taking the last band's color. Capped cells (`avail` below 1) now draw their bands in the right proportions across the available portion, rather than scaled down by `avail` a second time.
  
  The README now documents every public export and notes that the editor works at combo level, so suit-specific hands such as `AsKd` are not preserved through it.

### Patch changes

- Updated dependencies: @spotlab/range (npm)@0.2.0

## 0.1.0 — 2026-10-16

Initial release. React components for a 13x13 hand matrix: the `HandMatrix` grid, the range-string-aware `RangeGrid`, and the `RangeMatrixEditor` for painting per-action weights, with its `ActionWeightSliders` and cell helpers (`seedCells`, `cellsToComboWeights`, `comboWeightsToCells`, `rebalance`), and the `useRangePainting` hook. Themed through CSS custom properties.
