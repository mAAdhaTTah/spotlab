# @spotlab/hand-matrix

A 13x13 poker hand-matrix React component. Peer-deps `react`, `react-dom`,
and [`@spotlab/range`](../range) — no Tailwind, no bundler-plugin
requirement.

```tsx
import { RangeMatrix, rangeToMatrix } from "@spotlab/hand-matrix";
import "@spotlab/hand-matrix/style.css";
import { initRange } from "@spotlab/range";

await initRange(); // once, at startup

<RangeMatrix {...rangeToMatrix("AKs:0.5,QQ")} />;
```

## Exports

Everything below is exported from the package root.

### Display

- `RangeMatrix` — the read-only grid, for one range or several actions at
  once, drawn exactly as `RangeMatrixEditor` draws it but without painting.
  Each cell stacks its actions' weights as colored bands, dead cells
  (`avail` 0) are hatched, and capped cells (`avail` below 1) show a cap
  line with the rest hatched. Each cell carries a `data-combo` attribute.
  Props (`RangeMatrixProps`):
  - `cells: EditorCell[]` — one per combo, in `@spotlab/range`'s `COMBOS`
    order (see [Editing](#editing)).
  - `actions: EditorActionSpec[]` — index-aligned with each cell's
    `weights`.
  - `order: number[]` — indices into `actions`, in the order bands stack.
    An action left out isn't drawn, so its share of a cell stays
    transparent; include it to give it a color.
  - `className?: string`.
- `rangeToMatrix(range, { color?, labels? }): RangeMatrixProps` (without
  `className`) — `RangeMatrix`'s props for drawing one range:
  `<RangeMatrix {...rangeToMatrix(range)} />`. Takes a range string (parsed
  via `@spotlab/range`) or the expanded `HandFrequency[]` form, and fills
  each cell to its combo's mean weight in `color` (default
  `var(--spotlab-hm-fill)`), leaving the rest blank. The returned `actions`
  are `in` and `out`, labeled by `labels.in` (default `"In range"`) and
  `labels.out` (default `"Out of range"`), for building your own legend.
  Memoize the result (e.g. `useMemo`) rather than calling it on every
  render.

`rangeToMatrix`'s parse and combo collapse (`toComboWeights`) are wasm
calls, so `initRange()` must have resolved before calling it — see
[`@spotlab/range`](../range)'s own README for why that call is explicit
rather than automatic.

### Editing

The editor splits a parent range across a set of actions (e.g. fold, call,
raise). Its state is an array of 169 `EditorCell`s, one per combo in
`@spotlab/range`'s `COMBOS` order. Every component is fully controlled: state
goes in as props and changes come out through `on*Change` callbacks.

- `RangeMatrixEditor` — the paintable grid: `RangeMatrix`'s cells with
  brush/eyedropper painting wired on for mouse and touch.
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
  `{ onCellDown(combo), onCellEnter(combo) }`: call `onCellDown` when a
  pointer goes down on a cell and `onCellEnter` each time it moves onto
  another one. A stroke ends on any window `pointerup` or `pointercancel`.
- `seedCells(avail, actionWeights, passive): EditorCell[]` — build the
  initial grid from a parent range's per-combo availability (`null` for
  unconstrained) and each action's absolute per-combo weights (the
  `Map<string, number>` that `toComboWeights` from `@spotlab/range`
  produces).
- `cellsToComboWeights(cells, actionIndex): Map<string, number>` — collapse
  one action back to absolute per-combo weights, ready to save as a range.
- `cellsToRanges(original, seed, cells, avail?): HandFrequency[][]` — turn
  the edited grid back into one hand-keyed range per action. `original`
  holds each action's range (or `null`) in editor action order, `seed` the
  cells the editor opened with, and `cells` the cells after editing.
  `avail` is the parent range per hand (`null` for unconstrained); leave it
  out when the parent gives every hand of a combo the same weight. Combos
  whose cell still matches its seed keep each action's original hands
  verbatim, and a `null` action takes what's left of each hand there.
  Changed combos are rebuilt from the cells. Either way, each hand's
  actions sum to its parent weight.
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
  `RangeMatrixEditorProps`, `ActionWeightSlidersProps`,
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
class that sets variables works there too (`<RangeMatrix className="my-theme" … />`
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

Action colors (each `EditorActionSpec`'s `color`, or `rangeToMatrix`'s
`color` option) are **not** theme variables — they are data, passed as props.
`--spotlab-hm-fill` is only the default `rangeToMatrix` uses when `color` is
omitted.

## License

MIT — see `LICENSE`.
