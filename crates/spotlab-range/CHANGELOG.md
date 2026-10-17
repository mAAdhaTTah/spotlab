# spotlab-range

## 0.3.0 — 2026-10-17

### Minor changes

- [e5c307c](https://github.com/mAAdhaTTah/spotlab/commit/e5c307c806aae67c338a25a92c353f9571c822f9) Add `Range::from_combo_weights`, which expands per-combo weights to every hand of each combo. It is the inverse of `to_combo_weights` and rejects unknown combos and out-of-range weights.

## 0.2.0 — 2026-10-16

### Minor changes

- [7b012a8](https://github.com/mAAdhaTTah/spotlab/commit/7b012a8b9c4831c4f89e274dd9716c40613f2c35) Parse range shorthand and render back to it. `22+` (pairs up to `AA`), `A2s+` / `KTo+` / `QJ+` (kicker up to just below the high card) and `TT-77` / `A5s-A2s` (inclusive runs, either order) now parse, with a trailing `:weight` applying to every covered combo. `Display` now compacts contiguous same-weight runs within a family to `X+` / `HI-LO` (e.g. `AA,KK,QQ` renders `QQ+`; the full range renders as 25 tokens), so rendered strings change for ranges that contain such runs.

