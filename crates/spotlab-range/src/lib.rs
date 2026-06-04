use std::collections::HashMap;

use serde::Serialize;
use specta::Type;
use winnow::prelude::*;

mod parser;

#[cfg(test)]
mod test;

/// A single combo (e.g. `AKs`, `AKo`, `QQ`) mapped to its weight within a range.
///
/// `weight` is the parsed numeric frequency in `[0, 1]`. `raw` preserves the exact
/// frequency text as written in the source range string, so the solver command wire
/// format is reproduced byte-for-byte (e.g. `0.75` stays `0.75`, `1` stays `1`).
#[derive(Debug, Clone, PartialEq)]
struct RangeEntry {
    weight: f64,
    raw: String,
}

/// Structured representation of a poker range string.
///
/// Maps each combo present in the range to its weight. Built by [`Range::parse`] from
/// the comma- or space-separated range strings stored on `DbPlayerAction.range`.
#[derive(Debug, Clone, PartialEq)]
pub(crate) struct Range {
    entries: HashMap<String, RangeEntry>,
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
}

impl Range {
    /// Parse a range string into its structured representation.
    ///
    /// Accepts both comma-separated (frontend wire format) and space-separated
    /// (legacy) tokens. An empty or whitespace-only string yields an empty range.
    /// Malformed tokens produce a [`RangeParseError`].
    pub(crate) fn parse(input: &str) -> Result<Self, RangeParseError> {
        let entries = parser::range
            .parse(input.trim())
            .map_err(|e| RangeParseError::Invalid(e.to_string()))?
            .into_iter()
            .collect();

        Ok(Self { entries })
    }

    /// Frequency for a 4-character hand token (e.g. `AsKd`), resolving it to its
    /// combo (e.g. `AKo`) first, or `0.0` when the combo is absent.
    ///
    /// This is the `(range_string, hand) -> f64` lookup that unblocks #304. It has no
    /// in-tree caller yet — #304 itself is out of scope — hence `allow(dead_code)`.
    #[allow(dead_code)]
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

    /// Combo string + frequency pairs for each entry in the range.
    ///
    /// Exposes the range's internal structure without coupling it to any IPC type; the
    /// command layer maps these pairs into the FE-facing response struct.
    pub(crate) fn frequencies(&self) -> impl Iterator<Item = (&str, f64)> {
        self.entries
            .iter()
            .map(|(combo, entry)| (combo.as_str(), entry.weight))
    }
}
