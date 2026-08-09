use std::fmt;
use std::ops::AddAssign;

use indexmap::IndexMap;
use serde::de::{self, Deserializer};
use serde::{Deserialize, Serialize};
use specta::Type;
use winnow::prelude::*;

pub(crate) mod debug;
mod hand;
pub(crate) mod parser;

#[cfg(test)]
mod test;

pub(crate) use hand::Hand;

/// Canonical hand-to-frequency pair: the hand+weight currency shared by the range's
/// consumed/display/IPC surface and the sampler's internal dealing distribution. `hand` is a
/// 4-char suit-specific hand (e.g. `AsKd`), NOT a canonical combo (`AKo`).
///
/// It is the single wire form for range data on every IPC command surface, read and write alike:
/// the hand-level `RangeSource` yields it for both streets (`SpotAction.range`,
/// `PublicPlayerState.range`, the `PublicPlayerAction` variants, `parse_range`/`format_range`),
/// and the write path (`SetRange` / `AddAction`) accepts it, materializing a domain [`Range`] via
/// [`Range::from_hand_frequencies`]. Internally it is also the dealing/weight currency the drill
/// sampler consumes (`RangeSource::deal_hand_frequencies`). The combo grammar survives only in the
/// parser/renderer and the UI brush; it never crosses IPC.
///
/// Valid-by-construction: `hand` is a validated canonical [`Hand`] and `frequency` is checked to
/// be in `[0, 1]`. Off the IPC wire this is enforced by the custom [`Deserialize`] impl (a
/// malformed hand fails [`Hand`]'s own deserialization; an out-of-range frequency fails here), so
/// [`Range`] always receives already-known-valid data.
#[derive(Debug, Clone, PartialEq, Serialize, Type)]
pub struct HandFrequency {
    pub hand: Hand,
    pub frequency: f64,
}

impl TryFrom<(Hand, f64)> for HandFrequency {
    type Error = RangeParseError;

    /// Build a `HandFrequency` from a [`Hand`] and a frequency, validating the frequency is in
    /// `[0, 1]` (rejecting otherwise with [`RangeParseError::FrequencyOutOfRange`]). The hand is
    /// already valid by virtue of being a [`Hand`].
    fn try_from((hand, frequency): (Hand, f64)) -> Result<Self, Self::Error> {
        if !(0.0..=1.0).contains(&frequency) {
            return Err(RangeParseError::FrequencyOutOfRange {
                combo: hand.to_combo(),
                frequency,
            });
        }
        Ok(Self { hand, frequency })
    }
}

impl<'de> Deserialize<'de> for HandFrequency {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        #[derive(Deserialize)]
        struct Raw {
            hand: Hand,
            frequency: f64,
        }

        let Raw { hand, frequency } = Raw::deserialize(deserializer)?;
        HandFrequency::try_from((hand, frequency)).map_err(de::Error::custom)
    }
}

/// A single concrete hand (e.g. `AsKd`, `QhQs`) mapped to its weight within a range.
///
/// `weight` is the parsed numeric frequency in `[0, 1]`. `raw` preserves the exact frequency
/// text as written in the source range string, so the solver command wire format is reproduced
/// faithfully (e.g. `0.75` stays `0.75`, `1` stays `1`). Note that canonical rendering via
/// [`Range`]'s `Display` impl still normalizes a weight-1 entry to a bare token; `raw` itself is
/// the unmodified source text.
#[derive(Debug, Clone, PartialEq)]
struct RangeEntry {
    weight: f64,
    raw: String,
}

/// The materialized hand-level poker range: the single domain range type.
///
/// Keyed by concrete 4-character hands (e.g. `AsKd`) rather than combos (`AKo`). This is the
/// representation stored on the preflop tree, carried across the IPC surface (`SpotAction.range`,
/// `PublicPlayerState.range`, the `PublicPlayerAction` variants), consumed by the drill
/// sampling/scoring path, and serialized to the solver's `set_range` wire format. The combo
/// string form (`AKo:0.5`) is just a lossless *compacted serialization* of this type: combo
/// tokens expand to their concrete hands on parse and collapse back on render.
///
/// Postflop a range is the solver's authoritative per-hand reach; preflop it is the suit-symmetric
/// expansion of a combo range (every hand of a combo shares one weight). Zero-weight hands are
/// dropped, so a hand is present iff it is live with positive weight — which makes postflop dealing
/// board-aware for free (board-blocked hands never carry weight from the solver, so they are never
/// in the range).
///
/// Backed by an [`IndexMap`] so iteration follows parse/insertion order (deterministic weighted
/// sampling for a given seed, and the order the canonical [`Range`]`::to_string` rendering
/// relies on) while keyed lookups stay O(1). Distinct from the solver-read
/// [`crate::upi::HandRange`], which is the raw 1326-wide ordered read including zeros.
#[derive(Debug, Clone, PartialEq, Default)]
pub(crate) struct Range {
    entries: IndexMap<Hand, RangeEntry>,
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
    /// Build a range from already-valid [`HandFrequency`] items — the single materialization
    /// boundary for both the `SetRange`/`AddAction`/`format_range` IPC write path and the internal
    /// solver-reach path.
    ///
    /// Infallible: each [`HandFrequency`] is valid-by-construction (a canonical [`Hand`] and a
    /// `[0, 1]` frequency), so there is nothing left to validate here. Any hand with a non-positive
    /// frequency is dropped (a 0-weight hand is not in the range). Insertion order is preserved; on
    /// a duplicate hand the last item wins (via [`IndexMap::insert`]), matching [`Range::parse`].
    ///
    /// `raw` is synthesized as `format!("{frequency}")` so a hand built this way still reproduces
    /// the solver wire format (a weight-1 hand renders as the bare token `1`) — [`HandFrequency`]
    /// carries no source text of its own.
    pub(crate) fn from_hand_frequencies<I>(hands: I) -> Self
    where
        I: IntoIterator<Item = HandFrequency>,
    {
        let mut entries = IndexMap::new();
        for HandFrequency { hand, frequency } in hands {
            if frequency <= 0.0 {
                continue;
            }
            let raw = format!("{frequency}");
            entries.insert(
                hand,
                RangeEntry {
                    weight: frequency,
                    raw,
                },
            );
        }
        Self { entries }
    }

    /// Parse a range string into its structured hand-keyed form (expand-on-read).
    ///
    /// Accepts both comma-separated (frontend wire format) and space-separated (legacy) tokens,
    /// each a combo token (e.g. `AKo`, `QQ`) or a suit-specific 4-character hand token (e.g.
    /// `AsKh`). A combo token expands to all of its concrete hands at the shared weight/raw
    /// (`combo_token_to_hands`); a hand token maps to exactly one hand key. An empty or
    /// whitespace-only string yields an empty range. Malformed tokens produce a
    /// [`RangeParseError`].
    ///
    /// A hand/combo with an explicit `:0` weight is *dropped* — a 0% entry is not in the range, so
    /// it is never stored. A bare token (no `:freq`, weight 1) is kept.
    pub(crate) fn parse(input: &str) -> Result<Self, RangeParseError> {
        let entries = parser::hand_range
            .parse(input.trim())
            .map_err(|e| RangeParseError::Invalid(e.to_string()))?
            .into_iter()
            .filter(|(_, entry)| entry.weight != 0.0)
            .collect();

        Ok(Self { entries })
    }

    /// An empty range contributes nothing to a weighted pick, so dealing/validation treat it the
    /// same as absent ("no range set").
    pub(crate) fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    /// Weight for a concrete 4-character hand token, or `0.0` when the hand is absent.
    ///
    /// The single hand-weight lookup, shared by fixture-building tests that build a `Range`
    /// directly and by `scoring::hand_frequency`, which materializes a `Range` from
    /// `SpotAction.range` via `from_hand_frequencies` before looking up the hero's hand — rather
    /// than duplicating this same find-or-default logic against the raw `Vec<HandFrequency>`.
    pub(crate) fn hand_frequency(&self, hand: &str) -> f64 {
        self.entries
            .get(hand)
            .map(|entry| entry.weight)
            .unwrap_or(0.0)
    }

    /// Append the solver weight for a concrete 4-character hand to `target`, matching the
    /// PIOSolver `set_range` wire format: the raw frequency text when the hand is present (a bare
    /// `1` for a weight-1 hand), and `0` when the hand is absent. This is a direct hand-key
    /// lookup — no combo resolution — since the range is already keyed by concrete hands.
    ///
    /// **Canonical-key contract.** `hand` MUST already be in this crate's canonical suit ordering
    /// — the same ordering [`Hand::from_combo`]/[`Range::parse`] produce (e.g. `AdAh`, not the
    /// semantically-equivalent `AhAd`). This does no normalization: a non-canonical key silently
    /// misses the lookup and reads back as absent (`0`), just like a genuinely absent hand. The
    /// solver's `show_hand_order` labels are *not* canonical (a pair's cards are listed
    /// highest-suit-first), so the `SolverRange::as_solver_cmd` call site normalizes each token via
    /// [`Hand::from_solver_token`] before feeding it here. Taking a [`Hand`] makes that ordering a
    /// type-level guarantee; the `debug_assert` re-checks it in case a caller hand-built a
    /// non-canonical [`Hand`].
    pub(crate) fn append_solver_weight(&self, target: &mut String, hand: &Hand) {
        if !target.is_empty() {
            target.push(' ');
        }

        debug_assert!(
            Hand::from_solver_token(hand.as_str()) == *hand,
            "append_solver_weight requires a canonical `Hand` key ({hand}); a non-canonical key \
             silently reads back as absent (0) instead of erroring"
        );

        match self.entries.get(hand) {
            Some(entry) => target.push_str(&entry.raw),
            None => target.push('0'),
        }
    }

    /// The range's [`HandFrequency`] pairs in insertion order — the single hand-weight accessor,
    /// feeding both the IPC surface and the internal dealing/weight path. An empty range yields an
    /// empty `Vec` (distinct from `None`, "no range").
    pub(crate) fn to_hand_frequencies(&self) -> Vec<HandFrequency> {
        self.entries
            .iter()
            .map(|(hand, entry)| HandFrequency {
                hand: hand.clone(),
                frequency: entry.weight,
            })
            .collect()
    }
}

/// Append one `token`/`token:raw` entry to a comma-joined range string, normalizing a
/// weight-1 (`raw == "1"`) entry to the bare token. Shared by the combo-collapse and
/// per-hand-fallback arms of [`Range`]'s `Display` rendering.
fn push_token(out: &mut String, token: &str, raw: &str) {
    if !out.is_empty() {
        out.push(',');
    }
    out.push_str(token);
    if raw != "1" {
        out.push(':');
        out.push_str(raw);
    }
}

impl AddAssign<&Range> for Range {
    /// Fold `other` into this range: a hand present in both keeps the summed weight, capped at
    /// `1`. Used when an action is removed and the range it held has to survive on a sibling
    /// action rather than be dropped.
    fn add_assign(&mut self, other: &Range) {
        for (hand, entry) in &other.entries {
            let weight = (self.hand_frequency(hand.as_str()) + entry.weight).min(1.0);
            self.entries.insert(
                hand.clone(),
                RangeEntry {
                    weight,
                    raw: format!("{weight}"),
                },
            );
        }
    }
}

impl fmt::Display for Range {
    /// Render the range to a range string, collapsing combos on write and falling back to
    /// per-hand tokens where a combo cannot be collapsed losslessly.
    ///
    /// Live hands are grouped by combo ([`Hand::to_combo`]) in first-seen order. A combo is
    /// emitted as a single token *iff* all of its concrete hands are present
    /// ([`Hand::from_combo`] count: 6 pair / 4 suited / 12 offsuit) and they share one
    /// `weight`+`raw` — rendered bare when `raw == "1"`, else `COMBO:raw`, reproducing the
    /// combo-only blobs byte-for-byte. Otherwise (divergent weights, or only some hands
    /// present) each present hand is emitted as its own token (`AsKh` bare when `raw == "1"`,
    /// else `AsKh:raw`), so the range string stays fully lossless. Tokens are joined with the
    /// canonical comma separator matching the frontend's `join(",")`.
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let mut by_combo: IndexMap<String, Vec<(&str, &RangeEntry)>> = IndexMap::new();
        for (hand, entry) in &self.entries {
            by_combo
                .entry(hand.to_combo())
                .or_default()
                .push((hand.as_str(), entry));
        }

        let mut out = String::new();

        for (combo, hands) in &by_combo {
            let (_, first_entry) = hands[0];
            let full = hands.len() == Hand::from_combo(combo).len();
            let uniform = hands.iter().all(|(_, entry)| {
                entry.weight == first_entry.weight && entry.raw == first_entry.raw
            });

            if full && uniform {
                push_token(&mut out, combo, &first_entry.raw);
            } else {
                for (hand, entry) in hands {
                    push_token(&mut out, hand, &entry.raw);
                }
            }
        }

        f.write_str(&out)
    }
}
