# spotlab-range

## 0.3.1 — 2026-10-30

### Patch changes

- [b984571](https://github.com/mAAdhaTTah/spotlab/commit/b98457177a509d1bc57a2a881ed1e241d7177a12) Declare a minimum supported Rust version (MSRV) of 1.93 via `rust-version`, covering every feature. Cargo now reports a clear error on older toolchains instead of failing partway through the build.
- [ffb0689](https://github.com/mAAdhaTTah/spotlab/commit/ffb0689502aba48de214d8441381eddac3f0dfce) Update Rust crate `specta` from `=2.0.0-rc.25` to `=2.0.0-rc.27` and Rust crate `specta-typescript` from `=0.0.12` to `=0.0.14`.

## 0.3.0 — 2026-10-17

### Minor changes

- [e5c307c](https://github.com/mAAdhaTTah/spotlab/commit/e5c307c806aae67c338a25a92c353f9571c822f9) Add `Range::from_combo_weights`, which expands per-combo weights to every hand of each combo. It is the inverse of `to_combo_weights` and rejects unknown combos and out-of-range weights.

## 0.2.0 — 2026-10-16

### Minor changes

- [7b012a8](https://github.com/mAAdhaTTah/spotlab/commit/7b012a8b9c4831c4f89e274dd9716c40613f2c35) Parse range shorthand and render back to it. `22+` (pairs up to `AA`), `A2s+` / `KTo+` / `QJ+` (kicker up to just below the high card) and `TT-77` / `A5s-A2s` (inclusive runs, either order) now parse, with a trailing `:weight` applying to every covered combo. `Display` now compacts contiguous same-weight runs within a family to `X+` / `HI-LO` (e.g. `AA,KK,QQ` renders `QQ+`; the full range renders as 25 tokens), so rendered strings change for ranges that contain such runs.

## 0.1.0 — 2026-10-16

Initial release. A poker range-string parser and serializer: `Range::parse` and `Display` for weighted combo and hand tokens (`QQ`, `AKs:0.5`, `AsKd`), the canonical `Hand` token type, per-combo weight collapse (`to_combo_weights`), and comparison helpers for weighted ranges.
