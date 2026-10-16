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

- `HandMatrix` — the bare 13x13 grid primitive. Takes no range data; styling
  is entirely the caller's job via `comboStyle`, keyed by combo string (e.g.
  `"AKs"`).
- `RangeGrid` — a read-only display component. Accepts the expanded
  `HandFrequency[]` form or a range string directly (parsed via
  `@spotlab/range`), and fills each cell to its combo's mean weight.
- `cellFillGradient` / `CELL_FILL_DIRECTION` — the canonical left-to-right
  gradient helper used to render a cell's fill.

`RangeGrid`'s combo collapse (`toComboWeights`) is a wasm call, so
`initRange()` must have resolved before rendering it — see
[`@spotlab/range`](../range)'s own README for why that call is explicit
rather than automatic.

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
