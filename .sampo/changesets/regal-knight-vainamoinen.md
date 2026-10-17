---
cargo/spotlab-range: minor
---

Add `Range::from_combo_weights`, which expands per-combo weights to every hand of each combo. It is the inverse of `to_combo_weights` and rejects unknown combos and out-of-range weights.
