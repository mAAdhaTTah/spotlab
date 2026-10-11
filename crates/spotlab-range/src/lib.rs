use std::fmt;
use std::ops::AddAssign;

use indexmap::IndexMap;
#[cfg(feature = "serde")]
use serde::de::{self, Deserializer};
#[cfg(feature = "serde")]
use serde::{Deserialize, Serialize};
use winnow::prelude::*;

mod constants;
mod hand;
mod parser;

#[cfg(test)]
mod test;

pub use constants::{COMBOS, RANKS, SUITS, WEIGHT_TOLERANCE};
pub use hand::Hand;

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
#[derive(Debug, Clone, PartialEq)]
#[cfg_attr(feature = "serde", derive(Serialize))]
#[cfg_attr(feature = "specta", derive(specta::Type))]
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

#[cfg(feature = "serde")]
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

/// A hand whose summed assigned weight differs from the weight available for it. Reported by
/// [`Range::first_divergence`] / [`Range::first_oversubscription`]; the caller reads the two
/// weights to build its own message.
#[derive(Debug, Clone, PartialEq)]
pub struct Divergence {
    pub hand: Hand,
    pub available: f64,
    pub assigned: f64,
}

/// A single concrete hand (e.g. `AsKd`, `QhQs`) mapped to its weight within a range.
///
/// `weight` is the parsed numeric frequency in `[0, 1]`. `raw` preserves the exact frequency
/// text as written in the source range string, so a solver command wire format (or any other
/// byte-faithful re-render) is reproduced faithfully (e.g. `0.75` stays `0.75`, `1` stays `1`).
/// Note that canonical rendering via [`Range`]'s `Display` impl still normalizes a weight-1 entry
/// to a bare token; `raw` itself is the unmodified source text.
#[derive(Debug, Clone, PartialEq)]
struct RangeEntry {
    weight: f64,
    raw: String,
}

/// The materialized hand-level poker range: the single domain range type.
///
/// Keyed by concrete 4-character hands (e.g. `AsKd`) rather than combos (`AKo`). The combo
/// string form (`AKo:0.5`) is just a lossless *compacted serialization* of this type: combo
/// tokens expand to their concrete hands on parse and collapse back on render.
///
/// Zero-weight hands are dropped, so a hand is present iff it is live with positive weight —
/// which makes board-aware dealing free for a board-blocked, postflop range (board-blocked hands
/// never carry weight, so they are never in the range).
///
/// Backed by an [`IndexMap`] so iteration follows parse/insertion order (deterministic weighted
/// sampling for a given seed, and the order the canonical [`Range`]`::to_string` rendering
/// relies on) while keyed lookups stay O(1).
#[derive(Debug, Clone, PartialEq, Default)]
pub struct Range {
    entries: IndexMap<Hand, RangeEntry>,
}

/// Error produced when a range string contains malformed tokens.
///
/// Empty or whitespace-only input is *not* an error — it parses to an empty range.
/// Only genuinely malformed tokens (e.g. an unrecognized combo, or a `:` with no
/// frequency digits) produce this.
#[derive(Debug, thiserror::Error)]
#[cfg_attr(feature = "serde", derive(Serialize))]
#[cfg_attr(feature = "specta", derive(specta::Type))]
#[cfg_attr(
    feature = "serde",
    serde(tag = "type", content = "data", rename_all = "camelCase")
)]
pub enum RangeParseError {
    #[error("Invalid range string: {0}")]
    Invalid(String),
    #[error("Frequency {frequency} for combo {combo} is outside [0, 1]")]
    FrequencyOutOfRange { combo: String, frequency: f64 },
}

impl Range {
    /// Build a range from already-valid [`HandFrequency`] items — the single materialization
    /// boundary for a hand-keyed write path (e.g. an IPC `SetRange`/`AddAction` write, or an
    /// internal solver-reach path).
    ///
    /// Infallible: each [`HandFrequency`] is valid-by-construction (a canonical [`Hand`] and a
    /// `[0, 1]` frequency), so there is nothing left to validate here. Any hand with a non-positive
    /// frequency is dropped (a 0-weight hand is not in the range). Insertion order is preserved; on
    /// a duplicate hand the last item wins (via [`IndexMap::insert`]), matching [`Range::parse`].
    ///
    /// `raw` is synthesized as `format!("{frequency}")` so a hand built this way still reproduces
    /// a byte-faithful wire format (a weight-1 hand renders as the bare token `1`) —
    /// [`HandFrequency`] carries no source text of its own.
    pub fn from_hand_frequencies<I>(hands: I) -> Self
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

    /// Every hand in the deck at weight 1 — the unconstrained range, and the reach of a player
    /// who has not acted yet.
    ///
    /// Walks [`RANKS`] high-to-low (rather than in its own ascending index order) so this
    /// enumeration's order — and therefore the resulting `Range`'s `IndexMap` insertion order,
    /// load-bearing for deterministic sampling and canonical rendering — stays `AA, AKs, AKo,
    /// AQs, AQo, …` regardless of `RANKS`'s own direction.
    pub fn full() -> Range {
        let mut combos = Vec::with_capacity(169);
        for high_index in (0..RANKS.len()).rev() {
            let high = RANKS[high_index];
            for low_index in (0..=high_index).rev() {
                let low = RANKS[low_index];
                if high == low {
                    combos.push(format!("{high}{low}"));
                } else {
                    combos.push(format!("{high}{low}s"));
                    combos.push(format!("{high}{low}o"));
                }
            }
        }

        Range::from_hand_frequencies(combos.iter().flat_map(|combo| {
            Hand::from_combo(combo)
                .into_iter()
                .map(|hand| HandFrequency {
                    hand,
                    frequency: 1.0,
                })
        }))
    }

    /// Parse a range string into its structured hand-keyed form (expand-on-read).
    ///
    /// Accepts both comma-separated and space-separated tokens, each a combo token (e.g. `AKo`,
    /// `QQ`) or a suit-specific 4-character hand token (e.g. `AsKh`). A combo token expands to
    /// all of its concrete hands at the shared weight/raw (`combo_token_to_hands`); a hand token
    /// maps to exactly one hand key. An empty or whitespace-only string yields an empty range.
    /// Malformed tokens, or a frequency outside `[0, 1]`, produce a [`RangeParseError`].
    ///
    /// A hand/combo with an explicit `:0` weight is *dropped* — a 0% entry is not in the range, so
    /// it is never stored. A bare token (no `:freq`, weight 1) is kept.
    pub fn parse(input: &str) -> Result<Self, RangeParseError> {
        let entries = parser::hand_range
            .parse(input.trim())
            .map_err(|e| RangeParseError::Invalid(e.to_string()))?
            .into_iter()
            .filter(|(_, entry)| entry.weight != 0.0)
            .map(|(hand, entry)| {
                if !(0.0..=1.0).contains(&entry.weight) {
                    return Err(RangeParseError::FrequencyOutOfRange {
                        combo: hand.to_combo(),
                        frequency: entry.weight,
                    });
                }
                Ok((hand, entry))
            })
            .collect::<Result<_, _>>()?;

        Ok(Self { entries })
    }

    /// An empty range contributes nothing to a weighted pick, so dealing/validation treat it the
    /// same as absent ("no range set").
    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    /// Weight for a concrete 4-character hand token, or `0.0` when the hand is absent.
    pub fn hand_frequency(&self, hand: &str) -> f64 {
        self.entries
            .get(hand)
            .map(|entry| entry.weight)
            .unwrap_or(0.0)
    }

    /// The original frequency *text* for a concrete hand (e.g. `"0.75"`, or `"1"` for a weight-1
    /// hand), or `None` when the hand is absent — the raw-text counterpart to
    /// [`Range::hand_frequency`]'s parsed weight. `hand` must already be a canonical [`Hand`]
    /// key; a non-canonical key reads back as absent, like a genuinely absent hand.
    pub fn raw_weight(&self, hand: &Hand) -> Option<&str> {
        self.entries.get(hand).map(|entry| entry.raw.as_str())
    }

    /// Canonical, fixed-precision rendering of this range's weights — a single formatting both
    /// sides of a config-vs-artifact range hash can share, so the two agree for the same logical
    /// range regardless of which produced it.
    ///
    /// Weights are rounded to the nearest multiple of [`WEIGHT_TOLERANCE`] (1e-6) rather than
    /// rendered via [`Range`]'s [`Display`][fmt::Display] (which preserves exact source text):
    /// a solver round-trip returns per-combo floats with noise at roughly 1e-7 (e.g.
    /// `0.99999994` for a nominal `1.0`), which would otherwise hash differently from the same
    /// weight typed into a range string. 1e-6 is comfortably looser than that noise floor while
    /// remaining far tighter than any deliberate range edit, and it is the same tolerance
    /// [`Range::approx_eq`] already treats as "the same weight" elsewhere in the crate. Hands
    /// are sorted by their canonical key (rather than iterated in insertion order) because the
    /// two origins populate entries in different orders — range-string parse order vs. a
    /// solver's own hand order.
    ///
    /// Known limitation: this is nearest-multiple rounding, not bucketing with hysteresis, so
    /// two weights within [`WEIGHT_TOLERANCE`] of each other but straddling a `…5e-7` midpoint
    /// can round to different buckets and hash differently. This is accepted as a theoretical
    /// edge case rather than designed around: config weights come from UI entry or ordinary
    /// fractional values, not adversarially-chosen floats, and the 1e-6 bucket width is ~10x
    /// the observed ~1e-7 solver noise floor, so a real round-trip landing exactly on a midpoint
    /// is not expected in practice.
    pub fn canonical_weights(&self) -> String {
        let mut hands: Vec<(&Hand, f64)> = self
            .entries
            .iter()
            .map(|(hand, entry)| (hand, entry.weight))
            .collect();
        hands.sort_by_key(|(hand, _)| (*hand).clone());

        hands
            .into_iter()
            .map(|(hand, weight)| {
                let rounded = (weight / WEIGHT_TOLERANCE).round() * WEIGHT_TOLERANCE;
                format!("{hand}:{rounded:.6}")
            })
            .collect::<Vec<_>>()
            .join(",")
    }

    /// The range's [`HandFrequency`] pairs in insertion order — the single hand-weight accessor,
    /// feeding both a wire surface and an internal dealing/weight path. An empty range yields an
    /// empty `Vec` (distinct from `None`, "no range").
    pub fn to_hand_frequencies(&self) -> Vec<HandFrequency> {
        self.entries
            .iter()
            .map(|(hand, entry)| HandFrequency {
                hand: hand.clone(),
                frequency: entry.weight,
            })
            .collect()
    }

    /// Collapse this range to per-combo weights: for each of the 169 [`COMBOS`], the mean weight
    /// over its total suit-combination count (6 for a pair, 4 suited, 12 offsuit), with absent
    /// hands counting as zero.
    ///
    /// The mean (rather than, say, the max) is the only semantics correct for a board-aware
    /// postflop range, where some suit-combinations are blocked by the board and genuinely carry
    /// zero weight — a `max` would report such a combo at full strength. It is also correct for
    /// a suit-symmetric preflop range, where every hand of a combo shares one weight and the mean
    /// equals it; `max` is only correct in that narrower case. This is the single canonical
    /// combo collapse — anything downstream that needs "weight per combo" should use this rather
    /// than re-deriving it.
    pub fn to_combo_weights(&self) -> IndexMap<String, f64> {
        COMBOS
            .iter()
            .map(|&combo| {
                let hands = Hand::from_combo(combo);
                let sum: f64 = hands
                    .iter()
                    .map(|hand| self.hand_frequency(hand.as_str()))
                    .sum();
                (combo.to_string(), sum / hands.len() as f64)
            })
            .collect()
    }

    /// Whether `self` and `other` assign the same weight to every hand, within
    /// [`WEIGHT_TOLERANCE`]. Built on [`Range::first_divergence`], so a hand present in only one
    /// range still counts as a difference.
    pub fn approx_eq(&self, other: &Range) -> bool {
        self.first_divergence(std::iter::once(other), WEIGHT_TOLERANCE)
            .is_none()
    }

    /// The first hand whose summed weight across `parts` differs from this range's weight for
    /// that hand by more than `tolerance`, in either direction.
    pub fn first_divergence<'a>(
        &self,
        parts: impl IntoIterator<Item = &'a Range>,
        tolerance: f64,
    ) -> Option<Divergence> {
        self.diverging(parts, |available, assigned| {
            (assigned - available).abs() > tolerance
        })
    }

    /// The first hand whose summed weight across `parts` *exceeds* this range's weight for that
    /// hand by more than `tolerance`. Distinct from [`Range::first_divergence`] because a hand
    /// may legally be under-assigned (the remainder folds) while a later hand is over-assigned —
    /// a single either-direction scan would stop at the legal one and miss the violation.
    pub fn first_oversubscription<'a>(
        &self,
        parts: impl IntoIterator<Item = &'a Range>,
        tolerance: f64,
    ) -> Option<Divergence> {
        self.diverging(parts, |available, assigned| {
            assigned - available > tolerance
        })
    }

    /// Iterates this range's hands in insertion order, then any hand present only in `parts`, so
    /// a hand assigned mass it does not have here is reported too.
    ///
    /// Sums `parts` internally and uncapped, so no `Range` ever transiently holds a weight above
    /// 1 and leaks e.g. an `AhKh:1.4` token through [`Display`]. `is_violation` is called as
    /// `(available, assigned)` — this range's weight for the hand, then the summed weight from
    /// `parts`.
    fn diverging<'a>(
        &self,
        parts: impl IntoIterator<Item = &'a Range>,
        is_violation: impl Fn(f64, f64) -> bool,
    ) -> Option<Divergence> {
        let mut assigned: IndexMap<&Hand, f64> = IndexMap::new();
        for part in parts {
            for (hand, entry) in &part.entries {
                *assigned.entry(hand).or_insert(0.0) += entry.weight;
            }
        }

        self.entries
            .keys()
            .chain(
                assigned
                    .keys()
                    .copied()
                    .filter(|hand| !self.entries.contains_key(*hand)),
            )
            .find_map(|hand| {
                let available = self.hand_frequency(hand.as_str());
                let total = assigned.get(hand).copied().unwrap_or(0.0);
                is_violation(available, total).then(|| Divergence {
                    hand: hand.clone(),
                    available,
                    assigned: total,
                })
            })
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
    /// `1`. Used when, for example, an action is removed and the range it held has to survive on
    /// a sibling action rather than be dropped.
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
    /// canonical comma separator.
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
