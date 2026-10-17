---
npm/@spotlab/hand-matrix: minor
---

Add `RangeMatrix`, the read-only grid, which replaces `RangeGrid`. It takes the same `cells`, `actions` and `order` as `RangeMatrixEditor` and draws exactly what the editor draws (stacked action bands, a transparent share for actions left out of `order`, hatched dead cells and capped-cell markers), without painting and with the default cursor. `RangeMatrixEditor` now renders through it. For a single range, `rangeToMatrix(range, { color })` builds its props: `<RangeMatrix {...rangeToMatrix(range, { color })} />` draws what `<RangeGrid range={range} fill={color} />` did, and an optional `labels: { in, out }` names its two actions for a legend of your own.

Breaking: `RangeGrid` is removed; use `RangeMatrix` with `rangeToMatrix` instead. The bare `HandMatrix` grid and its helpers `cellFillGradient`, `CELL_FILL_DIRECTION` and `CellPointerHandler` are no longer exported; `RangeMatrix` and `RangeMatrixEditor` are the grids to use. Also, cells now set only `background-image`, so a themed `--spotlab-hm-cell-bg` shows through the uncovered part of every cell (the editor's included) rather than being reset to transparent.
