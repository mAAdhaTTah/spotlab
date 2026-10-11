//! The crate's public constants: the suit and rank alphabets used by the parser and [`Hand`](crate::Hand),
//! the matrix-ordered combo list, and the shared weight-comparison tolerance.

pub const SUITS: [char; 4] = ['c', 'd', 'h', 's'];

/// Ascending `'2'`..`'A'` — this order is part of the crate's public contract (see the crate
/// test asserting `RANKS[0] == '2'` / `RANKS[12] == 'A'`), chosen so that index equals rank
/// strength, the least surprising contract for a general consumer. [`Range::full`](crate::Range::full)
/// walks this array high-to-low internally to keep its own enumeration order (and therefore
/// every full-deck `Range`'s `IndexMap` insertion order, load-bearing for deterministic
/// sampling and canonical rendering) unchanged; any other consumer enumerating the deck by
/// iterating `RANKS` directly gets ascending order.
pub const RANKS: [char; 13] = [
    '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A',
];

/// The 169 canonical combos in the hand matrix's row-major order (`AA, AKs, AQs, …, A2s, AKo,
/// KK, KQs, …, 22`) — a flat row-i/col-j traversal where the diagonal is a pair, the
/// upper-right triangle (`j > i`) is suited, and the lower-left triangle (`j < i`) is offsuit,
/// ranks descending `A`..`2` along both axes.
///
/// This is a *different* ordering from [`Range::full`](crate::Range::full)'s own combo enumeration (which
/// walks [`RANKS`] high-to-low to build `AA, AKs, AKo, AQs, AQo, …`) — deliberately so.
/// [`Range::full`](crate::Range::full)'s order is load-bearing for its `IndexMap` insertion order (deterministic
/// sampling, canonical rendering); `COMBOS` exists only to give a matrix-shaped consumer (a UI
/// grid, a flat per-combo array) the ordering it actually needs. The two enumerations agree as
/// *sets* (see the crate test), never required to agree in order.
pub const COMBOS: [&str; 169] = [
    "AA", "AKs", "AQs", "AJs", "ATs", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s",
    "AKo", "KK", "KQs", "KJs", "KTs", "K9s", "K8s", "K7s", "K6s", "K5s", "K4s", "K3s", "K2s",
    "AQo", "KQo", "QQ", "QJs", "QTs", "Q9s", "Q8s", "Q7s", "Q6s", "Q5s", "Q4s", "Q3s", "Q2s",
    "AJo", "KJo", "QJo", "JJ", "JTs", "J9s", "J8s", "J7s", "J6s", "J5s", "J4s", "J3s", "J2s",
    "ATo", "KTo", "QTo", "JTo", "TT", "T9s", "T8s", "T7s", "T6s", "T5s", "T4s", "T3s", "T2s",
    "A9o", "K9o", "Q9o", "J9o", "T9o", "99", "98s", "97s", "96s", "95s", "94s", "93s", "92s",
    "A8o", "K8o", "Q8o", "J8o", "T8o", "98o", "88", "87s", "86s", "85s", "84s", "83s", "82s",
    "A7o", "K7o", "Q7o", "J7o", "T7o", "97o", "87o", "77", "76s", "75s", "74s", "73s", "72s",
    "A6o", "K6o", "Q6o", "J6o", "T6o", "96o", "86o", "76o", "66", "65s", "64s", "63s", "62s",
    "A5o", "K5o", "Q5o", "J5o", "T5o", "95o", "85o", "75o", "65o", "55", "54s", "53s", "52s",
    "A4o", "K4o", "Q4o", "J4o", "T4o", "94o", "84o", "74o", "64o", "54o", "44", "43s", "42s",
    "A3o", "K3o", "Q3o", "J3o", "T3o", "93o", "83o", "73o", "63o", "53o", "43o", "33", "32s",
    "A2o", "K2o", "Q2o", "J2o", "T2o", "92o", "82o", "72o", "62o", "52o", "42o", "32o", "22",
];

/// The canonical weight tolerance for comparing two ranges' `f64` weights — every
/// range-equality check that compares two ranges' weights (e.g. a PIO-import comparison
/// against config-side ranges) shares this single constant rather than each defining its own
/// copy. Weights ultimately arrive as `f64` from a UI or a solver round-trip and are summed
/// across a node's actions, so exact comparison would reject values like `0.1 + 0.2` spuriously.
pub const WEIGHT_TOLERANCE: f64 = 1e-6;
