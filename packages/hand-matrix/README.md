# @spotlab/hand-matrix

A 13x13 poker hand-matrix React component. Peer-deps `react`, `react-dom`,
and [`@spotlab/range`](../range) — no Tailwind, no bundler-plugin
requirement.

```tsx
import { RangeGrid } from "@spotlab/hand-matrix";
import "@spotlab/hand-matrix/style.css";
import { initRange } from "@spotlab/range";

await initRange(); // once, at startup

<RangeGrid range="AKs:0.5,QQ" />;
```

## Exports

Everything below is exported from the package root.

### Display

- `HandMatrix` — the bare 13x13 grid primitive. Takes no range data; styling
  is entirely the caller's job via `comboStyle`, keyed by combo string (e.g.
  `"AKs"`). Each cell carries a `data-combo` attribute. Props:
  - `comboStyle?: (combo) => CSSProperties` — per-cell style.
  - `onPointerDown?`, `onPointerEnter?: CellPointerHandler` — the
    `(combo, event)` handlers to use for dragging across cells, with a mouse
    or a finger. `onPointerDown` releases the implicit pointer capture a
    touch takes on its first cell. `onPointerEnter` fires once each time the
    pointer moves onto a new cell, found by hit-testing each `pointermove`
    (`elementFromPoint`), so it also fires during a touch drag, where
    enter events never reach the other cells. Passing `onPointerDown` sets
    `touch-action: none` and `user-select: none` on the grid, so a drag
    neither scrolls the page nor selects the combo text it crosses.
  - `className?: string` — merged onto the `.spotlab-hm-root` wrapper.
- `RangeGrid` — a read-only display component. Accepts the expanded
  `HandFrequency[]` form or a range string directly (parsed via
  `@spotlab/range`), and fills each cell to its combo's mean weight. Props:
  `range: HandFrequency[] | string`, `fill?: string` (a CSS color, defaulting
  to `var(--spotlab-hm-fill)`), `className?: string`.
- `cellFillGradient(stops: string[]): string` / `CELL_FILL_DIRECTION` — the
  canonical left-to-right gradient helper used to render a cell's fill.
  Returns `"transparent"` for no stops.

`RangeGrid`'s combo collapse (`toComboWeights`) is a wasm call, so
`initRange()` must have resolved before rendering it — see
[`@spotlab/range`](../range)'s own README for why that call is explicit
rather than automatic.

### Editing

The editor splits a parent range across a set of actions (e.g. fold, call,
raise). Its state is an array of 169 `EditorCell`s, one per combo in
`@spotlab/range`'s `COMBOS` order. Every component is fully controlled: state
goes in as props and changes come out through `on*Change` callbacks.

- `RangeMatrixEditor` — the paintable grid. Draws each cell's action bands,
  hatches dead cells (`avail` 0), marks capped cells (`avail` below 1), and
  wires brush/eyedropper painting onto `HandMatrix` for mouse and touch.
  Props (`RangeMatrixEditorProps`):
  - `cells: EditorCell[]` and `onCellsChange(cells)`.
  - `actions: EditorActionSpec[]` — index-aligned with each cell's
    `weights`.
  - `order: number[]` — indices into `actions`, in the order bands stack.
  - `brush: number[]` and `onBrushChange(brush)` — the weights a paint
    stroke applies, index-aligned with `actions`.
  - `tool: PaintTool` and `onToolChange(tool)` — `"brush"` paints on press
    and drag; `"eyedropper"` loads a cell's weights onto the brush and
    switches back to `"brush"`.
  - `className?: string`.
- `ActionWeightSliders` — one slider and numeric input per action for
  editing a brush (or any weight row). Moving one action rebalances the
  others so the row keeps summing to 100. Props (`ActionWeightSlidersProps`):
  - `actions`, `order`, `weights: number[]` and `onWeightsChange(weights)`.
  - `passive: number` — the index of the remainder action, which absorbs
    whatever the others leave.
  - `renderActionLabel?(action, index, isPassive)` — replaces a row's
    default label.
  - `renderActionExtra?(action, index)` — content after the label (e.g. a
    remove button).
  - `components?: { WeightInput?: ComponentType<WeightInputProps> }` — swap
    the default `<input type="number">`.
  - `className?: string`.
- `useRangePainting(opts)` — the brush/eyedropper state machine behind
  `RangeMatrixEditor`, for building your own grid. `opts` takes the editor's
  `cells`, `brush`, `tool` and their three `on*Change` callbacks. Returns
  `{ onCellDown(combo), onCellEnter(combo) }`; wire them to `HandMatrix`'s
  `onPointerDown`/`onPointerEnter`. A stroke ends on any window `pointerup`
  or `pointercancel`.
- `seedCells(avail, actionWeights, passive): EditorCell[]` — build the
  initial grid from a parent range's per-combo availability (`null` for
  unconstrained) and each action's absolute per-combo weights (the
  `Map<string, number>` that `toComboWeights` from `@spotlab/range`
  produces).
- `cellsToComboWeights(cells, actionIndex): Map<string, number>` — collapse
  one action back to absolute per-combo weights, ready to save as a range.
- `cellsToRanges(original, seed, cells): HandFrequency[][]` — turn the
  edited grid back into one hand-keyed range per action. `original` holds
  each action's range (or `null`) in editor action order, `seed` the cells
  the editor opened with, and `cells` the cells after editing. Combos whose
  cell still matches its seed keep each action's original hands verbatim;
  changed combos, and every combo of a `null` action, are rebuilt from the
  cells.
- `comboWeightsToCells(cells, actionWeights, passive): EditorCell[]` — the
  inverse: re-derive the cells' conditional weights from absolute
  per-action ranges, keeping each cell's `avail`.
- `rebalance(weights, index, value, passive): number[]` — set one action's
  weight and rescale the rest so the row sums to 100. This is what
  `ActionWeightSliders` uses.
- Types: `EditorCell` (`{ avail: number; weights: number[] }`, where `avail`
  is the combo's cap in the parent range and `weights` are each action's
  share of it, summing to 100), `EditorActionSpec`
  (`{ id: string; label: string; color: string }`), `PaintTool`,
  `CellPointerHandler`, `RangeMatrixEditorProps`, `ActionWeightSlidersProps`,
  `WeightInputProps`.

**The editor works at combo level.** A cell is one of the 169 combos (`AKs`,
`AKo`, `QQ`) at a whole-percent weight, so suit-specific hands such as
`AsKd:0.7` and fractional weights such as `QQ:0.333` can't be shown exactly:
`seedCells` takes combo weights, and `cellsToComboWeights` returns them. Save
with `cellsToRanges` to keep them for every combo the user didn't repaint.

## Theming

The package ships `hand-matrix.css` (`@spotlab/hand-matrix/style.css`),
scoped entirely under a `.spotlab-hm-root` wrapper that every top-level
component renders for itself, merged with any `className` passed in. Every
custom property has a default declared on `.spotlab-hm-root`, so the
component renders correctly with zero theming.

Because the `className` you pass to a component lands on that same root, a
class that sets variables works there too (`<RangeGrid className="my-theme" />`
with `.my-theme { --spotlab-hm-border: … }`), in addition to the
`.spotlab-hm-root` selector form below.

**To override a variable, target `.spotlab-hm-root` itself** — not `:root`
and not any other ancestor. Because the package's own default is declared
directly on `.spotlab-hm-root`, a value set only on an ancestor loses to it
regardless of specificity (an element's own declared value always beats an
inherited one). This is the single most likely integration mistake:

```css
/* This does NOT win: */
:root {
  --spotlab-hm-fill: #f59e0b;
}

/* This does: */
.spotlab-hm-root {
  --spotlab-hm-fill: #f59e0b;
}
```

**The package's defaults live in a named CSS cascade layer** (`@layer
spotlab-hand-matrix`), not unlayered — this is what makes the above override
reliable. Per the CSS cascade, unlayered styles always beat every `@layer`
regardless of specificity or source order, so if the package's defaults were
unlayered, a plain override would only win when it happened to load _after_
the package's stylesheet; load it first, or wrap it in your own `@layer`,
and the override would silently lose instead. Putting the defaults in a
named layer makes any unlayered override — the common case for a plain CSS
file or style tag, which is exactly what most consumers write — win
automatically, regardless of import order.

The one case this doesn't cover for free: if **your own styles are also
inside a named layer** (for example, a Tailwind v4 app that wraps its design
tokens in `@layer base`), layer priority is decided by each layer name's
_first appearance_ in the stylesheet, not by where the override rule itself
sits. A layer named for the first time later in the cascade outranks one
named earlier, so you must import `@spotlab/hand-matrix/style.css` **before**
whatever first establishes your own layer order (e.g. before `@import
"tailwindcss"`, which emits `@layer theme, base, components, utilities;` as
its first statement) — otherwise `spotlab-hand-matrix` gets appended last and
outranks your override instead:

```css
/* Correct: registers `spotlab-hand-matrix` before Tailwind's layers, so
   `@layer base` (where your override lives) outranks it. */
@import "@spotlab/hand-matrix/style.css";
@import "tailwindcss";
```

If you don't use cascade layers yourself (e.g. a plain CSS file, or an
Obsidian plugin with no bundler-level layer system), none of this applies —
your override is unlayered and wins unconditionally, in any import order.

Available variables: `--spotlab-hm-border`, `--spotlab-hm-border-width`,
`--spotlab-hm-cell-bg`, `--spotlab-hm-cell-fg`, `--spotlab-hm-fill`,
`--spotlab-hm-font-family`, `--spotlab-hm-font-size`,
`--spotlab-hm-font-weight`, `--spotlab-hm-radius`, `--spotlab-hm-surface-bg`,
`--spotlab-hm-muted-bg`, `--spotlab-hm-muted-fg`, `--spotlab-hm-track-bg`,
`--spotlab-hm-row-passive-bg`, `--spotlab-hm-dead-hatch`.

Action/fill colors (`RangeGrid`'s `fill` prop) are **not** theme variables —
they are data, passed as props. `--spotlab-hm-fill` is only the default used
when `fill` is omitted.

## License

MIT — see `LICENSE`.
