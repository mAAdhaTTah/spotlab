use std::fmt;

use indexmap::IndexMap;
use serde::Serialize;
use specta::Type;
use winnow::prelude::*;

use crate::tree::public::ComboFrequency;

mod parser;

#[cfg(test)]
mod test;

/// A single combo (e.g. `AKs`, `AKo`, `QQ`) mapped to its weight within a range.
///
/// `weight` is the parsed numeric frequency in `[0, 1]`. `raw` preserves the exact
/// frequency text as written in the source range string, so the solver command wire
/// format is reproduced faithfully (e.g. `0.75` stays `0.75`, `1` stays `1`). Note that
/// canonical rendering via [`Range::to_range_string`] still normalizes a weight-1 entry
/// to a bare combo; `raw` itself is the unmodified source text.
#[derive(Debug, Clone, PartialEq)]
struct RangeEntry {
    weight: f64,
    raw: String,
}

/// Structured representation of a poker range string.
///
/// Maps each combo present in the range to its weight. Built by [`Range::parse`] from
/// the comma- or space-separated range strings stored on `DbPlayerAction.range`.
///
/// `entries` is an [`IndexMap`] so iteration follows parse/insertion order (which the
/// canonical [`Range::to_range_string`] rendering relies on) while keyed lookups stay
/// O(1).
#[derive(Debug, Clone, PartialEq)]
pub(crate) struct Range {
    entries: IndexMap<String, RangeEntry>,
}

/// Error produced when a range string contains malformed tokens.
///
/// Empty or whitespace-only input is *not* an error — it parses to an empty range.
/// Only genuinely malformed tokens (e.g. an unrecognized combo, or a `:` with no
/// frequency digits) produce this.
#[derive(Debug, thiserror::Error, Type, Serialize)]
#[serde(tag = "type", content = "data", rename_all = "camelCase")]
pub enum RangeParseError {
    #[error("Invalid range string: {0}")]
    Invalid(String),
    #[error("Frequency {frequency} for combo {combo} is outside [0, 1]")]
    FrequencyOutOfRange { combo: String, frequency: f64 },
}

impl Range {
    /// Parse a range string into its structured representation.
    ///
    /// Accepts both comma-separated (frontend wire format) and space-separated
    /// (legacy) tokens. An empty or whitespace-only string yields an empty range.
    /// Malformed tokens produce a [`RangeParseError`].
    ///
    /// A combo with an explicit `:0` weight is *dropped* — a 0% combo is not in the range,
    /// so it is never stored. A bare combo (no `:freq`, weight 1) is kept.
    pub(crate) fn parse(input: &str) -> Result<Self, RangeParseError> {
        let entries = parser::range
            .parse(input.trim())
            .map_err(|e| RangeParseError::Invalid(e.to_string()))?
            .into_iter()
            .filter(|(_, entry)| entry.weight != 0.0)
            .collect();

        Ok(Self { entries })
    }

    /// Domain constructor that builds a range from validated `(combo, frequency)` pairs,
    /// checking each combo against the combo grammar and each frequency against `[0, 1]`.
    ///
    /// REJECTS an unrecognized combo or an out-of-range frequency with a
    /// [`RangeParseError`] rather than silently dropping it. A *valid* `0.0` frequency is
    /// dropped (a 0% combo is not in the range), not stored as a 0-weight entry.
    ///
    /// Takes raw `(combo, frequency)` pairs — not any IPC type — so the domain type stays
    /// decoupled from the wire format. Insertion order of the input is preserved (the
    /// backing [`IndexMap`] keeps it). On a duplicate combo the last pair wins (via
    /// [`IndexMap::insert`]), matching [`Range::parse`].
    pub(crate) fn from_pairs<I, S>(pairs: I) -> Result<Self, RangeParseError>
    where
        I: IntoIterator<Item = (S, f64)>,
        S: AsRef<str>,
    {
        let mut entries = IndexMap::new();

        for (combo, frequency) in pairs {
            let combo = parser::parse_combo(combo.as_ref())?;

            if !(0.0..=1.0).contains(&frequency) {
                return Err(RangeParseError::FrequencyOutOfRange { combo, frequency });
            }

            // A 0% combo is not in the range: drop it rather than storing a 0-weight entry.
            // The `[0, 1]` check above still runs first, so an out-of-range freq errors.
            if frequency == 0.0 {
                continue;
            }

            // `{}` on f64 omits trailing zeros, producing tokens that match the
            // `digit1 (. digit1)?` frequency grammar and round-trip through `Range::parse`.
            let raw = format!("{frequency}");
            entries.insert(
                combo,
                RangeEntry {
                    weight: frequency,
                    raw,
                },
            );
        }

        Ok(Self { entries })
    }

    /// Frequency for a 4-character hand token (e.g. `AsKd`), resolving it to its
    /// combo (e.g. `AKo`) first, or `0.0` when the combo is absent.
    ///
    /// This `(range_string, hand) -> f64` lookup is currently exercised only by tests
    /// (range round-trip / membership checks) and retained as part of the `Range` API
    /// for future production callers; #304's deal path uses `frequencies()` /
    /// `to_combo_frequencies()` instead.
    #[cfg_attr(not(test), allow(dead_code))]
    pub(crate) fn hand_frequency(&self, hand: &str) -> f64 {
        self.entries
            .get(&parser::hand_to_combo(hand))
            .map(|entry| entry.weight)
            .unwrap_or(0.0)
    }

    /// Append the solver weight for a 4-character hand token to `target`, matching the
    /// PIOSolver `set_range` wire format: the raw frequency text when present with a
    /// suffix, `1` when present without one, and `0` when absent.
    pub(crate) fn append_solver_weight(&self, target: &mut String, hand: &str) {
        if !target.is_empty() {
            target.push(' ');
        }

        match self.entries.get(&parser::hand_to_combo(hand)) {
            Some(entry) => target.push_str(&entry.raw),
            None => target.push('0'),
        }
    }

    /// Render the range to its *canonical* range string.
    ///
    /// This is a canonical rendering, not a byte-for-byte echo of the input. For
    /// weighted combos the per-combo frequency *text* is preserved exactly via
    /// [`RangeEntry::raw`] (e.g. `0.75` stays `0.75`, `0` stays `0`), so the solver
    /// command wire format is reproduced faithfully. But weight-1 entries normalize to
    /// a bare combo: whether the input wrote `QQ` or an explicit `QQ:1`, both render as
    /// `QQ` (the `:1` suffix is normalized away). Entries are joined with the canonical
    /// comma separator that matches the frontend's `join(",")`, and order follows
    /// insertion/parse order.
    pub(crate) fn to_range_string(&self) -> String {
        let mut out = String::new();

        for (combo, entry) in &self.entries {
            if !out.is_empty() {
                out.push(',');
            }

            out.push_str(combo);

            if entry.raw != "1" {
                out.push(':');
                out.push_str(&entry.raw);
            }
        }

        out
    }

    /// Combo string + frequency pairs for each entry in the range.
    ///
    /// Exposes the range's internal structure without coupling it to any IPC type; the
    /// command layer maps these pairs into the FE-facing response struct.
    pub(crate) fn frequencies(&self) -> impl Iterator<Item = (&str, f64)> {
        self.entries
            .iter()
            .map(|(combo, entry)| (combo.as_str(), entry.weight))
    }

    /// Convert the range into the structured combo-weight pairs sent over IPC.
    ///
    /// Preserves the range's insertion order (it is `IndexMap`-backed). An empty range
    /// yields an empty `Vec`, which is a distinct, meaningful state from `None` ("no range").
    pub(crate) fn to_combo_frequencies(&self) -> Vec<ComboFrequency> {
        self.frequencies()
            .map(|(combo, frequency)| ComboFrequency::new(combo, frequency))
            .collect()
    }
}

impl fmt::Display for Range {
    // Renders the canonical range string; see `Range::to_range_string`.
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.to_range_string())
    }
}

impl TryFrom<Vec<ComboFrequency>> for Range {
    type Error = RangeParseError;

    /// Materialize a validated domain [`Range`] from structured combo-weight pairs.
    ///
    /// An unrecognized combo or an out-of-range frequency produces a [`RangeParseError`]
    /// rather than being dropped. Input order is preserved. This is the validate-at-write
    /// boundary — once it returns `Ok`, the manager receives a `Range` it can store directly.
    fn try_from(combos: Vec<ComboFrequency>) -> Result<Self, Self::Error> {
        Range::from_pairs(combos.into_iter().map(|cf| (cf.combo, cf.frequency)))
    }
}
