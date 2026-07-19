use std::fmt;

use indexmap::IndexMap;
use serde::{Deserialize, Serialize};
use specta::Type;
use winnow::prelude::*;

pub(crate) mod parser;

#[cfg(test)]
mod test;

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
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
pub struct HandFrequency {
    pub hand: String,
    pub frequency: f64,
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
    /// Build a range from [`HandFrequency`] items, dropping any hand with a non-positive frequency
    /// (a 0-weight hand is not in the range). On a duplicate hand the last item wins (via
    /// [`IndexMap::insert`]), matching [`Range::parse`].
    ///
    /// `raw` is synthesized as `format!("{frequency}")` so a hand built this way still reproduces
    /// the solver wire format (a weight-1 hand renders as the bare token `1`) — [`HandFrequency`]
    /// carries no source text of its own. Trusts already-canonical solver labels; use
    /// [`Range::from_hand_frequencies`] for arbitrary IPC input that needs validation.
    pub(crate) fn from_hand_weights<I>(hands: I) -> Self
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

    /// Build a validated range from untrusted [`HandFrequency`] items — the write boundary for
    /// the `format_range` IPC command.
    ///
    /// Each `hand` is validated against the 4-char suit-specific grammar
    /// ([`parser::hand_to_combo`]) and each frequency against `[0, 1]`, rejecting either with a
    /// [`RangeParseError`] rather than panicking or silently retaining a malformed key (which
    /// would later trip [`parser::combo_to_hands`] inside [`Range`]'s `Display` rendering). A valid
    /// `0.0` frequency is dropped (a 0% hand is not in the range). Insertion order is preserved; on
    /// a duplicate hand the last item wins.
    pub(crate) fn from_hand_frequencies<I>(hands: I) -> Result<Self, RangeParseError>
    where
        I: IntoIterator<Item = HandFrequency>,
    {
        let mut entries = IndexMap::new();

        for HandFrequency { hand, frequency } in hands {
            let combo = parser::hand_to_combo(&hand)?;
            if let Some(entry) = validated_entry(&combo, frequency)? {
                entries.insert(hand, entry);
            }
        }

        Ok(Self { entries })
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
    /// Exercised by tests; the drill scoring path resolves hand weights off the IPC
    /// `SpotAction.range` (a `Vec<HandFrequency>`) rather than this domain lookup.
    #[cfg_attr(not(test), allow(dead_code))]
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
    /// — the same ordering [`parser::combo_to_hands`]/[`Range::parse`] produce (e.g. `AdAh`, not
    /// the semantically-equivalent `AhAd`). This does no normalization: a non-canonical key
    /// silently misses the lookup and reads back as absent (`0`), just like a genuinely absent
    /// hand. The solver's `show_hand_order` labels are *not* canonical (a pair's cards are listed
    /// highest-suit-first), so the `SolverRange::as_solver_cmd` call site normalizes each token via
    /// [`canonical_hand`] before feeding it here.
    pub(crate) fn append_solver_weight(&self, target: &mut String, hand: &str) {
        if !target.is_empty() {
            target.push(' ');
        }

        debug_assert!(
            parser::hand_to_combo(hand)
                .map(|combo| parser::combo_to_hands(&combo).iter().any(|h| h == hand))
                .unwrap_or(false),
            "append_solver_weight requires `hand` ({hand}) in canonical suit ordering (the \
             ordering combo_to_hands/parse produce); a non-canonical key silently reads back \
             as absent (0) instead of erroring"
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

/// Validate a frequency for range membership and, if it belongs, build its [`RangeEntry`].
///
/// Rejects a frequency outside `[0, 1]` with a [`RangeParseError::FrequencyOutOfRange`] tagged by
/// `combo` (the already-validated canonical combo of the entry). Signals a 0% entry — which is not
/// in the range — as `Ok(None)` so the caller drops it. Otherwise returns the entry with clean
/// `raw` text (`format!("{frequency}")`, matching the frequency grammar so it round-trips through
/// [`Range::parse`]). Used by the [`Range::from_hand_frequencies`] write boundary.
fn validated_entry(combo: &str, frequency: f64) -> Result<Option<RangeEntry>, RangeParseError> {
    if !(0.0..=1.0).contains(&frequency) {
        return Err(RangeParseError::FrequencyOutOfRange {
            combo: combo.to_string(),
            frequency,
        });
    }

    if frequency == 0.0 {
        return Ok(None);
    }

    Ok(Some(RangeEntry {
        weight: frequency,
        raw: format!("{frequency}"),
    }))
}

/// Normalize a solver-supplied hand token into this crate's canonical suit ordering — the ordering
/// [`parser::combo_to_hands`]/[`Range::parse`] produce (e.g. `AdAh`, not the semantically-equivalent
/// `AhAd`).
///
/// The solver's `show_hand_order` lists a pair's two cards highest-suit-first (`2d2c`), the reverse
/// of the crate's lowest-suit-first canonical key (`2c2d`), so a direct hand-key lookup in
/// [`Range::append_solver_weight`] would miss unless the token is normalized here first. Returns the
/// input unchanged when it is not a well-formed hand token (there is no canonical form to map it to).
pub(crate) fn canonical_hand(hand: &str) -> String {
    match parser::hand_to_combo(hand) {
        Ok(combo) => parser::combo_to_hands(&combo)
            .into_iter()
            .find(|candidate| same_cards(candidate, hand))
            .unwrap_or_else(|| hand.to_string()),
        Err(_) => hand.to_string(),
    }
}

/// Whether two 4-character hand tokens name the same two cards regardless of card order (e.g.
/// `2d2c` and `2c2d`). Both inputs must be validated 4-char ASCII tokens.
fn same_cards(a: &str, b: &str) -> bool {
    let (a_first, a_second) = a.split_at(2);
    let (b_first, b_second) = b.split_at(2);
    (a_first == b_first && a_second == b_second) || (a_first == b_second && a_second == b_first)
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

impl fmt::Display for Range {
    /// Render the range to a range string, collapsing combos on write and falling back to
    /// per-hand tokens where a combo cannot be collapsed losslessly.
    ///
    /// Live hands are grouped by combo (`hand_to_combo`) in first-seen order. A combo is
    /// emitted as a single token *iff* all of its concrete hands are present
    /// (`combo_to_hands` count: 6 pair / 4 suited / 12 offsuit) and they share one
    /// `weight`+`raw` — rendered bare when `raw == "1"`, else `COMBO:raw`, reproducing the
    /// combo-only blobs byte-for-byte. Otherwise (divergent weights, or only some hands
    /// present) each present hand is emitted as its own token (`AsKh` bare when `raw == "1"`,
    /// else `AsKh:raw`), so the range string stays fully lossless. Tokens are joined with the
    /// canonical comma separator matching the frontend's `join(",")`.
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let mut by_combo: IndexMap<String, Vec<(&str, &RangeEntry)>> = IndexMap::new();
        for (hand, entry) in &self.entries {
            // Every hand in `entries` is a validated 4-char token (inserted via `parse`,
            // `from_hand_weights`, or `from_hand_frequencies`), so `hand_to_combo`
            // never fails here; fall back to the hand as its own group if it somehow does.
            let combo = parser::hand_to_combo(hand).unwrap_or_else(|_| hand.clone());
            by_combo
                .entry(combo)
                .or_default()
                .push((hand.as_str(), entry));
        }

        let mut out = String::new();

        for (combo, hands) in &by_combo {
            let (_, first_entry) = hands[0];
            let full = hands.len() == parser::combo_to_hands(combo).len();
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
