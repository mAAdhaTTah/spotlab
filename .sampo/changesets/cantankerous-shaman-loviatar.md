---
cargo/spotlab-range: minor
---

Parse range shorthand and render back to it. `22+` (pairs up to `AA`), `A2s+` / `KTo+` / `QJ+` (kicker up to just below the high card) and `TT-77` / `A5s-A2s` (inclusive runs, either order) now parse, with a trailing `:weight` applying to every covered combo. `Display` now compacts contiguous same-weight runs within a family to `X+` / `HI-LO` (e.g. `AA,KK,QQ` renders `QQ+`; the full range renders as 25 tokens), so rendered strings change for ranges that contain such runs.
