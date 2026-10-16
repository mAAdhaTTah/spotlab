---
npm/@spotlab/hand-matrix: patch
---

Painting in `RangeMatrixEditor` now works on touch devices. The grid uses pointer events and hit-tests each `pointermove` against the cell under the pointer, so a finger drag paints every cell it crosses, and the grid sets `touch-action: none` so the drag doesn't scroll the page. Mouse painting is unchanged. `HandMatrix` gains generic `onPointerDown`/`onPointerEnter` props (`(combo, event)`) for building drag interactions, and each `.spotlab-hm-cell` now carries a `data-combo` attribute.

`RangeMatrixEditor` no longer draws a cell as fully painted when `order` covers only part of its weight: the uncovered remainder is now transparent instead of taking the last band's color. Capped cells (`avail` below 1) now draw their bands in the right proportions across the available portion, rather than scaled down by `avail` a second time.

The README now documents every public export and notes that the editor works at combo level, so suit-specific hands such as `AsKd` are not preserved through it.
