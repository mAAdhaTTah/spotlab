use pretty_assertions::assert_eq;
use rstest::rstest;

use super::parser::RANKS;
use super::{Hand, HandFrequency, Range, RangeParseError};

fn hf(hand: &str, frequency: f64) -> HandFrequency {
    HandFrequency {
        hand: Hand::from_solver_token(hand),
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
    let range = Range::from_hand_frequencies(vec![hf("AhKh", 0.5), hf("AsKs", 0.25)]);
    let rendered = range.to_string();
    assert_eq!(rendered, "AhKh:0.5,AsKs:0.25");
    assert_eq!(Range::parse(&rendered).unwrap(), range);
}

// (c) Partial-combo presence: only some hands of a combo are present, so the combo cannot be
// collapsed and each present hand is emitted as its own token.
#[rstest]
fn partial_combo_emits_per_hand_tokens() {
    // `hf` canonicalizes each token (`QhQd` → the lowest-suit-first `QdQh`).
    let range = Range::from_hand_frequencies(vec![hf("QhQd", 1.0), hf("QhQs", 1.0)]);
    let rendered = range.to_string();
    assert_eq!(rendered, "QdQh,QhQs");
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
        .append_solver_weight(&mut target, &Hand::from_solver_token(hand));
    assert_eq!(target, expected);
}

#[rstest]
fn append_solver_weight_space_separates() {
    let range = Range::parse("AA:0.75,KK").unwrap();
    let mut target = String::new();
    range.append_solver_weight(&mut target, &Hand::from_solver_token("AcAd"));
    range.append_solver_weight(&mut target, &Hand::from_solver_token("KcKd"));
    range.append_solver_weight(&mut target, &Hand::from_solver_token("QcQd"));
    assert_eq!(target, "0.75 1 0");
}

// The solver's `show_hand_order` lists a pair's two cards highest-suit-first (the reverse of the
// crate's canonical lowest-suit-first key); `Hand::from_solver_token` normalizes them so the
// direct hand-key lookup in `append_solver_weight` finds the weight instead of silently emitting
// `0`.
#[rstest]
#[case::pair_reversed("2d2c", "2c2d")]
#[case::pair_reversed_high("AsAh", "AhAs")]
#[case::pair_reversed_mid("AhAd", "AdAh")]
// Non-pair tokens are already in canonical order (higher rank first), so they pass through.
#[case::suited_unchanged("3c2c", "3c2c")]
#[case::offsuit_unchanged("AsKh", "AsKh")]
// A malformed token has no canonical form and passes through unchanged.
#[case::malformed_passthrough("not-a-hand", "not-a-hand")]
fn from_solver_token_normalizes_solver_tokens(#[case] input: &str, #[case] expected: &str) {
    assert_eq!(Hand::from_solver_token(input), expected);
}

// `Hand::parse` canonicalizes a pair's suit order (`AsAh` → `AhAs`) and rejects a malformed token
// rather than passing it through, unlike `from_solver_token`.
#[rstest]
#[case::pair_reversed("AsAh", "AhAs")]
#[case::offsuit_unchanged("AsKh", "AsKh")]
fn hand_parse_canonicalizes(#[case] input: &str, #[case] expected: &str) {
    assert_eq!(Hand::parse(input).expect("valid hand"), expected);
}

#[rstest]
#[case::not_a_hand("ZZZZ")]
#[case::too_short("AK")]
#[case::over_long("AsKhQd")]
fn hand_parse_rejects_malformed(#[case] input: &str) {
    assert!(matches!(
        Hand::parse(input),
        Err(RangeParseError::Invalid(_))
    ));
}

// A range parsed from combos, then fed the solver's (non-canonical) pair token via
// `Hand::from_solver_token` + `append_solver_weight`, still resolves the weight — the load-bearing
// invariant that keeps the `set_range` wire output byte-faithful.
#[rstest]
fn append_solver_weight_finds_weight_for_normalized_solver_pair_token() {
    let range = Range::parse("AA:0.5").unwrap();
    let mut target = String::new();
    range.append_solver_weight(&mut target, &Hand::from_solver_token("AsAh"));
    assert_eq!(target, "0.5");
}

#[rstest]
fn from_hand_frequencies_drops_non_positive() {
    let range = Range::from_hand_frequencies(vec![
        hf("AhKh", 0.4),
        hf("AsKs", 0.0),
        hf("QdQh", -0.1),
        hf("JdJh", 0.6),
    ]);
    assert_eq!(range.hand_frequency("AhKh"), 0.4);
    assert_eq!(range.hand_frequency("AsKs"), 0.0);
    assert_eq!(range.hand_frequency("QdQh"), 0.0);
    assert_eq!(range.hand_frequency("JdJh"), 0.6);
    assert!(!range.is_empty());
    assert!(Range::from_hand_frequencies(Vec::<HandFrequency>::new()).is_empty());
}

#[rstest]
fn to_hand_frequencies_preserves_insertion_order() {
    let range = Range::from_hand_frequencies(vec![hf("AhKh", 0.5), hf("QdQh", 1.0)]);
    let pairs: Vec<(String, f64)> = range
        .to_hand_frequencies()
        .into_iter()
        .map(|hf| (hf.hand.into_inner(), hf.frequency))
        .collect();
    assert_eq!(
        pairs,
        vec![("AhKh".to_string(), 0.5), ("QdQh".to_string(), 1.0)]
    );
}

#[rstest]
fn from_hand_frequencies_drops_zero_frequency_hands() {
    let range = Range::from_hand_frequencies(vec![hf("AhKh", 0.5), hf("AsKs", 0.0)]);
    assert_eq!(range.hand_frequency("AhKh"), 0.5);
    // A 0% hand is dropped, not stored.
    assert_eq!(range.hand_frequency("AsKs"), 0.0);
    assert_eq!(range.to_hand_frequencies().len(), 1);
}

// Frequency validation lives on `HandFrequency`, the valid-by-construction currency `Range` is
// built from — not on the (now infallible) `Range::from_hand_frequencies`.
#[rstest]
fn hand_frequency_try_from_rejects_out_of_range_frequency() {
    let err = HandFrequency::try_from((Hand::from_solver_token("AhKh"), 1.5))
        .expect_err("out-of-range frequency must be rejected");
    assert!(matches!(err, RangeParseError::FrequencyOutOfRange { .. }));
}

#[rstest]
fn from_hand_frequencies_accepts_full_combo_expansion() {
    // Supplying the canonical full-hand expansion of `AKs:0.5,QQ` (4 suited + 6 pair hands)
    // through the hand-level write boundary reconstructs the equivalent range, which collapses
    // back to the combo tokens.
    let hands = Range::parse("AKs:0.5,QQ").unwrap().to_hand_frequencies();
    let range = Range::from_hand_frequencies(hands);
    assert_eq!(range.to_hand_frequencies().len(), 10);
    assert_eq!(range.hand_frequency("AhKh"), 0.5);
    assert_eq!(range.hand_frequency("QhQs"), 1.0);
    assert_eq!(range.to_string(), "AKs:0.5,QQ");
}

#[rstest]
fn from_hand_frequencies_drops_zero_expansion() {
    // The full expansion of a combo supplied at 0.0 drops entirely, leaving only KK.
    let mut hands = Range::parse("AKs").unwrap().to_hand_frequencies();
    for hand in &mut hands {
        hand.frequency = 0.0;
    }
    hands.extend(Range::parse("KK").unwrap().to_hand_frequencies());
    let dropped = Range::from_hand_frequencies(hands);
    assert_eq!(dropped.to_string(), "KK");
}

#[rstest]
fn full_deck_has_every_hand_at_weight_one() {
    let deck = Range::full_deck();
    let hands = deck.to_hand_frequencies();

    assert_eq!(hands.len(), 1326);
    assert!(hands.iter().all(|hf| hf.frequency == 1.0));
    assert_eq!(deck.hand_frequency("AhKh"), 1.0);
    assert_eq!(deck.hand_frequency("AhKd"), 1.0);
    assert_eq!(deck.hand_frequency("2c2d"), 1.0);
}

#[rstest]
fn full_deck_round_trips_through_display_and_parse() {
    let deck = Range::full_deck();
    let reparsed = Range::parse(&deck.to_string()).expect("full deck re-parses");

    assert_eq!(reparsed, deck);
}

#[rstest]
fn full_deck_renders_every_combo_as_a_bare_token() {
    let rendered = Range::full_deck().to_string();
    let tokens: Vec<&str> = rendered.split(',').collect();

    assert_eq!(tokens.len(), 169, "169 canonical combos");
    assert!(
        tokens.iter().all(|token| !token.contains(':')),
        "a weight-1 entry renders bare"
    );
    assert!(tokens.contains(&"AA"));
    assert!(tokens.contains(&"AKs"));
    assert!(tokens.contains(&"AKo"));
    assert_eq!(RANKS.len(), 13);
}

#[rstest]
fn first_divergence_is_none_when_parts_sum_to_the_receiver() {
    let reach = Range::parse("AKs:0.5").expect("parse");
    let a = Range::parse("AKs:0.3").expect("parse");
    let b = Range::parse("AKs:0.2").expect("parse");

    assert!(reach.first_divergence([&a, &b], 1e-6).is_none());
}

#[rstest]
fn first_divergence_reports_an_over_assigned_hand() {
    let reach = Range::parse("AKs:0.5").expect("parse");
    let part = Range::parse("AKs:0.9").expect("parse");

    let divergence = reach.first_divergence([&part], 1e-6).expect("divergence");
    assert_eq!(divergence.hand, "AcKc");
    assert_eq!(divergence.available, 0.5);
    assert_eq!(divergence.assigned, 0.9);
}

#[rstest]
fn first_divergence_reports_an_under_assigned_hand() {
    let reach = Range::parse("AKs:0.5").expect("parse");
    let part = Range::parse("AKs:0.2").expect("parse");

    let divergence = reach.first_divergence([&part], 1e-6).expect("divergence");
    assert_eq!(divergence.available, 0.5);
    assert_eq!(divergence.assigned, 0.2);
}

#[rstest]
fn first_divergence_reports_a_hand_absent_from_the_receiver() {
    let reach = Range::parse("AKs:0.5").expect("parse");
    let part = Range::parse("AKs:0.5,QQ:0.3").expect("parse");

    let divergence = reach.first_divergence([&part], 1e-6).expect("divergence");
    assert_eq!(divergence.available, 0.0);
    assert_eq!(divergence.assigned, 0.3);
    assert_eq!(divergence.hand.to_combo(), "QQ");
}

#[rstest]
fn first_divergence_respects_tolerance() {
    let reach = Range::parse("AKs:0.3").expect("parse");
    let a = Range::parse("AKs:0.1").expect("parse");
    let b = Range::parse("AKs:0.2").expect("parse");

    assert!(
        reach.first_divergence([&a, &b], 1e-6).is_none(),
        "0.1 + 0.2 must not trip a 1e-6 tolerance"
    );
    assert!(
        reach.first_divergence([&a, &b], 0.0).is_some(),
        "and it does at zero tolerance, proving the sum is genuinely inexact"
    );
}

#[rstest]
fn first_divergence_returns_the_first_hand_in_receiver_order() {
    let reach = Range::parse("AKs:0.5,QQ:0.5").expect("parse");
    let part = Range::parse("AKs:0.9,QQ:0.9").expect("parse");

    let divergence = reach.first_divergence([&part], 1e-6).expect("divergence");
    assert_eq!(divergence.hand.to_combo(), "AKs");
}

#[rstest]
fn first_divergence_with_no_parts_reports_the_whole_receiver() {
    let reach = Range::parse("AKs:0.5").expect("parse");
    let parts: [&Range; 0] = [];

    let divergence = reach.first_divergence(parts, 1e-6).expect("divergence");
    assert_eq!(divergence.available, 0.5);
    assert_eq!(divergence.assigned, 0.0);
}

#[rstest]
fn first_oversubscription_reports_a_hand_absent_from_the_receiver() {
    let reach = Range::parse("AKs:0.5").expect("parse");
    let part = Range::parse("AKs:0.5,QQ:0.3").expect("parse");

    let divergence = reach
        .first_oversubscription([&part], 1e-6)
        .expect("oversubscription");
    assert_eq!(divergence.available, 0.0);
    assert_eq!(divergence.assigned, 0.3);
    assert_eq!(divergence.hand.to_combo(), "QQ");
}

#[rstest]
fn first_oversubscription_respects_tolerance() {
    let reach = Range::parse("AKs:0.3").expect("parse");
    let a = Range::parse("AKs:0.1").expect("parse");
    let b = Range::parse("AKs:0.2").expect("parse");

    assert!(
        reach.first_oversubscription([&a, &b], 1e-6).is_none(),
        "0.1 + 0.2 must not trip a 1e-6 tolerance"
    );
    assert!(
        reach.first_oversubscription([&a, &b], 0.0).is_some(),
        "and it does at zero tolerance, proving the sum is genuinely inexact"
    );
}

#[rstest]
fn first_oversubscription_returns_the_first_hand_in_receiver_order() {
    let reach = Range::parse("AKs:0.5,QQ:0.5").expect("parse");
    let part = Range::parse("AKs:0.9,QQ:0.9").expect("parse");

    let divergence = reach
        .first_oversubscription([&part], 1e-6)
        .expect("oversubscription");
    assert_eq!(divergence.hand.to_combo(), "AKs");
}

#[rstest]
fn first_oversubscription_with_no_parts_is_none() {
    let reach = Range::parse("AKs:0.5").expect("parse");
    let parts: [&Range; 0] = [];

    assert!(reach.first_oversubscription(parts, 1e-6).is_none());
}

#[rstest]
fn first_oversubscription_ignores_under_assignment() {
    let reach = Range::parse("AKs:0.5").expect("parse");
    let part = Range::parse("AKs:0.2").expect("parse");

    assert!(reach.first_oversubscription([&part], 1e-6).is_none());
}

// An earlier under-assigned hand must not mask a later over-assigned one.
#[rstest]
fn first_oversubscription_skips_past_an_under_assigned_hand() {
    let reach = Range::parse("AKs:0.5,QQ:0.5").expect("parse");
    let part = Range::parse("AKs:0.2,QQ:0.9").expect("parse");

    assert_eq!(
        reach
            .first_divergence([&part], 1e-6)
            .expect("divergence")
            .hand
            .to_combo(),
        "AKs",
        "first_divergence stops at the legal under-assignment"
    );

    let divergence = reach
        .first_oversubscription([&part], 1e-6)
        .expect("oversubscription");
    assert_eq!(divergence.hand.to_combo(), "QQ");
    assert_eq!(divergence.assigned, 0.9);
    assert_eq!(divergence.available, 0.5);
}
