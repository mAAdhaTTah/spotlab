use pretty_assertions::assert_eq;
use rstest::rstest;

use super::{canonical_hand, HandFrequency, Range, RangeParseError};

fn hf(hand: &str, frequency: f64) -> HandFrequency {
    HandFrequency {
        hand: hand.to_string(),
        frequency,
    }
}

// #558: a suitless combo (`AK`) in an otherwise full range expands to both its suited and
// offsuit hands rather than being dropped.
#[rstest]
fn suitless_combo_in_full_range_is_not_dropped() {
    let range = "AA,KK,QQ,JJ,TT,99,88:0.5,AK,AQ,AJs,ATs,A9s,A5s,A4s,KQs,KQo:0.5,KJs,KTs,QJs,QTs:0.5,76s:0.25,65s:0.25,54s:0.25";
    let parsed = Range::parse(range).unwrap();
    assert_eq!(
        parsed.hand_frequency("AhKh"),
        1.0,
        "AK suited should be in range"
    );
    assert_eq!(
        parsed.hand_frequency("AhKd"),
        1.0,
        "AK offsuit should be in range"
    );
    assert_eq!(
        parsed.hand_frequency("AhQh"),
        1.0,
        "AQ suited should be in range"
    );
    assert_eq!(
        parsed.hand_frequency("AhQd"),
        1.0,
        "AQ offsuit should be in range"
    );
}

#[rstest]
// A combo token expands to its concrete hands; each expanded hand carries the combo weight.
#[case::suited("AKs:0.5", "AhKh", 0.5)]
#[case::offsuit("AKo", "AhKd", 1.0)]
#[case::pair("QQ:0.25", "QdQh", 0.25)]
// A suit-specific hand token maps to exactly that one hand.
#[case::hand_token("AsKh:0.75", "AsKh", 0.75)]
// The other hands of the combo are NOT pulled in by a bare hand token.
#[case::hand_token_sibling_absent("AsKh:0.75", "AhKh", 0.0)]
// A hand of a combo not in the range is absent.
#[case::absent("AKs", "AhKd", 0.0)]
#[case::absent_from_empty("", "AhKh", 0.0)]
// A suitless combo token expands to both its suited and offsuit hands.
#[case::suitless_suited("AK", "AhKh", 1.0)]
#[case::suitless_offsuit("AK", "AhKd", 1.0)]
// An explicit `:0` entry is dropped at parse time, so it reads back as absent.
#[case::zero_frequency_dropped("AKs:0", "AhKh", 0.0)]
fn parse_resolves_hand_frequency(#[case] range: &str, #[case] hand: &str, #[case] expected: f64) {
    assert_eq!(Range::parse(range).unwrap().hand_frequency(hand), expected);
}

#[rstest]
#[case::trailing_comma("AA,")]
#[case::leading_comma(",AA")]
#[case::surrounding_whitespace("  AA  ")]
fn parse_tolerates_surrounding_separators(#[case] range: &str) {
    // `AA` expands to its 6 canonical pair hands; `AdAh` is one of them.
    assert_eq!(Range::parse(range).unwrap().hand_frequency("AdAh"), 1.0);
}

#[rstest]
// A combo with no recognizable structure leaves unconsumed input.
#[case::not_a_combo("not-a-combo")]
// A `:` with no frequency digits: `frequency_text` requires `digit1`, so the `:` is
// left unconsumed and the whole parse fails rather than defaulting the combo to 1.0.
#[case::trailing_colon("AKs:")]
// Non-numeric frequency text after `:` likewise fails and is left unconsumed.
#[case::non_numeric_frequency("AKs:abc")]
fn parse_errors_on_malformed_input(#[case] range: &str) {
    assert!(Range::parse(range).is_err());
}

// (a) Shared-weight round-trip: a combo whose hands are all present at one weight re-emits
// the combo token string identically.
#[rstest]
#[case::weighted_and_bare("AKs:0.5,QQ", "AKs:0.5,QQ")]
#[case::bare_combo("QQ", "QQ")]
#[case::suitless_expands_to_two_combos("AK", "AKs,AKo")]
// A full 12-hand offsuit combo round-trips as a single collapsed token, mirroring the
// suited (4-hand) and pair (6-hand) cases above.
#[case::offsuit_full("AKo:0.5", "AKo:0.5")]
// Intentional normalization: an explicit `:1` is canonicalized away to a bare combo.
#[case::explicit_weight_one_normalizes_to_bare("QQ:1", "QQ")]
#[case::multiple_combos("AKs:0.75,QQ:1,JJ:0.5", "AKs:0.75,QQ,JJ:0.5")]
// A 0% entry is not in the range: an explicit `:0` is dropped, not rendered.
#[case::zero_frequency_dropped("AKs:0", "")]
#[case::zero_frequency_among_others("AA:0,KK:1", "KK")]
#[case::empty("", "")]
#[case::whitespace_only("   ", "")]
fn shared_weight_round_trips_to_combo_tokens(#[case] input: &str, #[case] expected: &str) {
    assert_eq!(Range::parse(input).unwrap().to_string(), expected);
}

// (b) Divergent round-trip: two hands of one combo at different weights render as per-hand
// tokens, and re-parsing that string yields the identical `Range`.
#[rstest]
fn divergent_weights_emit_per_hand_tokens_and_round_trip() {
    let range = Range::from_hand_weights(vec![hf("AhKh", 0.5), hf("AsKs", 0.25)]);
    let rendered = range.to_string();
    assert_eq!(rendered, "AhKh:0.5,AsKs:0.25");
    assert_eq!(Range::parse(&rendered).unwrap(), range);
}

// (c) Partial-combo presence: only some hands of a combo are present, so the combo cannot be
// collapsed and each present hand is emitted as its own token.
#[rstest]
fn partial_combo_emits_per_hand_tokens() {
    let range = Range::from_hand_weights(vec![hf("QhQd", 1.0), hf("QhQs", 1.0)]);
    let rendered = range.to_string();
    assert_eq!(rendered, "QhQd,QhQs");
    assert_eq!(Range::parse(&rendered).unwrap(), range);
}

// A range string mixing a fully-collapsible combo (`QQ`) with a combo whose hands carry
// divergent per-hand weights (`AhKh:0.5,AsKs:0.25`) round-trips: the collapsed combo stays a
// single token, and the divergent combo's hands stay per-hand tokens, both in one string.
#[rstest]
fn mixed_collapsed_combo_and_per_hand_fallback_round_trips() {
    let range = Range::parse("QQ,AhKh:0.5,AsKs:0.25").unwrap();
    let rendered = range.to_string();
    assert_eq!(rendered, "QQ,AhKh:0.5,AsKs:0.25");
    assert_eq!(Range::parse(&rendered).unwrap(), range);
}

// A range string mixing a collapsible combo token (`QQ`) with an unrelated suit-specific hand
// token (`AsKh:0.75`, the sole present hand of the otherwise-absent `AKo` combo) parses and
// re-serializes identically: `QQ` stays collapsed, `AsKh` stays a per-hand token since the rest
// of its combo is absent.
#[rstest]
fn combo_token_mixed_with_suit_specific_hand_token_round_trips() {
    let range = Range::parse("QQ,AsKh:0.75").unwrap();
    let rendered = range.to_string();
    assert_eq!(rendered, "QQ,AsKh:0.75");
    assert_eq!(Range::parse(&rendered).unwrap(), range);
    assert_eq!(range.hand_frequency("QhQs"), 1.0);
    assert_eq!(range.hand_frequency("AsKh"), 0.75);
    assert_eq!(range.hand_frequency("AhKh"), 0.0);
}

#[rstest]
#[case::weighted_combos("AKs:0.75,QQ:1,JJ:0.5")]
#[case::space_separated("AKs:0.75 QQ:1 JJ:0.5")]
#[case::bare_combos("AA,KK,QQ")]
#[case::zero_frequency_dropped("AKs:0")]
#[case::empty("")]
#[case::whitespace_only("   ")]
fn parse_and_render_round_trip_idempotently(#[case] input: &str) {
    let once = Range::parse(input).unwrap().to_string();
    let twice = Range::parse(&once).unwrap().to_string();
    assert_eq!(once, twice);
}

// `Range`'s `Display` impl renders the canonical range string directly (weighted combo kept
// weighted, bare combo collapsed) — the single rendering path now that no inherent stringify
// method exists.
#[rstest]
fn display_renders_canonical_range_string() {
    let range = Range::parse("AKs:0.5,QQ").unwrap();
    assert_eq!(range.to_string(), "AKs:0.5,QQ");
}

#[rstest]
#[case::empty("")]
#[case::whitespace_only("   ")]
fn parse_empty_input_round_trips_to_empty(#[case] input: &str) {
    let parsed = Range::parse(input).expect("empty input parses to an empty range");
    assert_eq!(parsed.to_hand_frequencies().len(), 0);
    assert_eq!(parsed.to_string(), "");
}

#[rstest]
fn empty_constructor_serializes_to_empty_string() {
    assert_eq!(Range::default().to_string(), "");
    assert!(Range::default().is_empty());
}

// (d) `append_solver_weight` reproduces the raw wire text per hand: the raw frequency when
// present, `1` for a weight-1 hand, `0` when the hand is absent.
#[rstest]
#[case::present_with_suffix("AKs:0.75", "AhKh", "0.75")]
#[case::present_without_suffix("AKs", "AhKh", "1")]
#[case::absent("AKs", "AhKd", "0")]
#[case::preserves_raw_text("QQ:0.5", "QhQs", "0.5")]
fn append_solver_weight_reproduces_wire_format(
    #[case] range: &str,
    #[case] hand: &str,
    #[case] expected: &str,
) {
    let mut target = String::new();
    Range::parse(range)
        .unwrap()
        .append_solver_weight(&mut target, hand);
    assert_eq!(target, expected);
}

#[rstest]
fn append_solver_weight_space_separates() {
    let range = Range::parse("AA:0.75,KK").unwrap();
    let mut target = String::new();
    range.append_solver_weight(&mut target, "AcAd");
    range.append_solver_weight(&mut target, "KcKd");
    range.append_solver_weight(&mut target, "QcQd");
    assert_eq!(target, "0.75 1 0");
}

// The solver's `show_hand_order` lists a pair's two cards highest-suit-first (the reverse of the
// crate's canonical lowest-suit-first key); `canonical_hand` normalizes them so the direct
// hand-key lookup in `append_solver_weight` finds the weight instead of silently emitting `0`.
#[rstest]
#[case::pair_reversed("2d2c", "2c2d")]
#[case::pair_reversed_high("AsAh", "AhAs")]
#[case::pair_reversed_mid("AhAd", "AdAh")]
// Non-pair tokens are already in canonical order (higher rank first), so they pass through.
#[case::suited_unchanged("3c2c", "3c2c")]
#[case::offsuit_unchanged("AsKh", "AsKh")]
// A malformed token has no canonical form and passes through unchanged.
#[case::malformed_passthrough("not-a-hand", "not-a-hand")]
fn canonical_hand_normalizes_solver_tokens(#[case] input: &str, #[case] expected: &str) {
    assert_eq!(canonical_hand(input), expected);
}

// A range parsed from combos, then fed the solver's (non-canonical) pair token via
// `canonical_hand` + `append_solver_weight`, still resolves the weight — the load-bearing
// invariant that keeps the `set_range` wire output byte-faithful.
#[rstest]
fn append_solver_weight_finds_weight_for_normalized_solver_pair_token() {
    let range = Range::parse("AA:0.5").unwrap();
    let mut target = String::new();
    range.append_solver_weight(&mut target, &canonical_hand("AsAh"));
    assert_eq!(target, "0.5");
}

#[rstest]
fn from_hand_weights_drops_non_positive() {
    let range = Range::from_hand_weights(vec![
        hf("AhKh", 0.4),
        hf("AsKs", 0.0),
        hf("QhQd", -0.1),
        hf("JhJd", 0.6),
    ]);
    assert_eq!(range.hand_frequency("AhKh"), 0.4);
    assert_eq!(range.hand_frequency("AsKs"), 0.0);
    assert_eq!(range.hand_frequency("QhQd"), 0.0);
    assert_eq!(range.hand_frequency("JhJd"), 0.6);
    assert!(!range.is_empty());
    assert!(Range::from_hand_weights(Vec::<HandFrequency>::new()).is_empty());
}

#[rstest]
fn to_hand_frequencies_preserves_insertion_order() {
    let range = Range::from_hand_weights(vec![hf("AhKh", 0.5), hf("QhQd", 1.0)]);
    let pairs: Vec<(String, f64)> = range
        .to_hand_frequencies()
        .into_iter()
        .map(|hf| (hf.hand, hf.frequency))
        .collect();
    assert_eq!(
        pairs,
        vec![("AhKh".to_string(), 0.5), ("QhQd".to_string(), 1.0)]
    );
}

#[rstest]
fn from_hand_frequencies_validates_drops_zero_and_rejects() {
    let range = Range::from_hand_frequencies(vec![hf("AhKh", 0.5), hf("AsKs", 0.0)]).unwrap();
    assert_eq!(range.hand_frequency("AhKh"), 0.5);
    // A 0% hand is dropped, not stored.
    assert_eq!(range.hand_frequency("AsKs"), 0.0);
    assert_eq!(range.to_hand_frequencies().len(), 1);

    let invalid = Range::from_hand_frequencies(vec![hf("ZZZZ", 1.0)]);
    assert!(matches!(invalid, Err(RangeParseError::Invalid(_))));

    let out_of_range = Range::from_hand_frequencies(vec![hf("AhKh", 1.5)]);
    assert!(matches!(
        out_of_range,
        Err(RangeParseError::FrequencyOutOfRange { .. })
    ));
}

#[rstest]
fn from_hand_frequencies_accepts_full_combo_expansion() {
    // Supplying the canonical full-hand expansion of `AKs:0.5,QQ` (4 suited + 6 pair hands)
    // through the hand-level write boundary reconstructs the equivalent range, which collapses
    // back to the combo tokens.
    let hands = Range::parse("AKs:0.5,QQ").unwrap().to_hand_frequencies();
    let range = Range::from_hand_frequencies(hands).unwrap();
    assert_eq!(range.to_hand_frequencies().len(), 10);
    assert_eq!(range.hand_frequency("AhKh"), 0.5);
    assert_eq!(range.hand_frequency("QhQs"), 1.0);
    assert_eq!(range.to_string(), "AKs:0.5,QQ");
}

#[rstest]
fn from_hand_frequencies_drops_zero_expansion_and_rejects_invalid() {
    // The full expansion of a combo supplied at 0.0 drops entirely, leaving only KK.
    let mut hands = Range::parse("AKs").unwrap().to_hand_frequencies();
    for hand in &mut hands {
        hand.frequency = 0.0;
    }
    hands.extend(Range::parse("KK").unwrap().to_hand_frequencies());
    let dropped = Range::from_hand_frequencies(hands).unwrap();
    assert_eq!(dropped.to_string(), "KK");

    let invalid = Range::from_hand_frequencies(vec![hf("ZZZZ", 1.0)]);
    assert!(matches!(invalid, Err(RangeParseError::Invalid(_))));

    let out_of_range = Range::from_hand_frequencies(vec![hf("AhKh", 1.5)]);
    assert!(matches!(
        out_of_range,
        Err(RangeParseError::FrequencyOutOfRange { .. })
    ));
}
