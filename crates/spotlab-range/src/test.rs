use pretty_assertions::assert_eq;
use rstest::rstest;

use crate::tree::range::Range;

// #558
#[rstest]
fn suitless_combo_in_full_range_should_not_be_dropped() {
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
#[case::pair("QQ", "QhQd", 1.0)]
#[case::suited("AKs", "AhKh", 1.0)]
#[case::offsuit("AKo", "AhKd", 1.0)]
#[case::suitless_suited("AK", "AhKh", 1.0)]
#[case::suitless_offsuit("AK", "AhKd", 1.0)]
#[case::with_frequency("AKs:0.75", "AhKh", 0.75)]
#[case::absent_combo("AKs", "AhKd", 0.0)]
#[case::absent_from_empty("", "AhKh", 0.0)]
#[case::space_separated("AKs:0.75 QQ:1 JJ:0.5", "AhKh", 0.75)]
#[case::comma_separated("AKs:0.75,QQ:1,JJ:0.5", "QhQd", 1.0)]
#[case::comma_separated_freq("AKs:0.75,QQ:1,JJ:0.5", "JhJd", 0.5)]
// An explicit `:0` combo is dropped at parse time, so it reads back as absent (0.0).
#[case::zero_frequency_dropped("AKs:0", "AhKh", 0.0)]
fn it_should_look_up_hand_frequency(
    #[case] range: &str,
    #[case] hand: &str,
    #[case] expected: f64,
) {
    assert_eq!(Range::parse(range).unwrap().hand_frequency(hand), expected);
}

#[rstest]
#[case::present_with_suffix("AKs:0.75", "AhKh", "0.75")]
#[case::present_without_suffix("AKs", "AhKh", "1")]
#[case::absent("AKs", "AhKd", "0")]
#[case::preserves_raw_text("QQ:0.5", "QhQd", "0.5")]
fn it_should_preserve_solver_weight_wire_format(
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
fn it_should_space_separate_solver_weights() {
    let range = Range::parse("AA:0.75,KK").unwrap();
    let mut target = String::new();
    range.append_solver_weight(&mut target, "AhAd");
    range.append_solver_weight(&mut target, "KhKd");
    range.append_solver_weight(&mut target, "QhQd");
    assert_eq!(target, "0.75 1 0");
}

#[rstest]
fn it_should_expose_combo_frequencies() {
    let range = Range::parse("QQ,AKs:0.75").unwrap();
    let frequencies: Vec<(&str, f64)> = range.frequencies().collect();
    // IndexMap preserves insertion order, so no sort is needed: the pairs come back in
    // parse order (`QQ` before `AKs`), not sorted alphabetically.
    assert_eq!(frequencies, vec![("QQ", 1.0), ("AKs", 0.75)]);
}

#[rstest]
#[case::trailing_comma("AA,")]
#[case::leading_comma(",AA")]
#[case::surrounding_whitespace("  AA  ")]
fn it_should_tolerate_surrounding_separators(#[case] range: &str) {
    assert_eq!(Range::parse(range).unwrap().hand_frequency("AhAd"), 1.0);
}

#[rstest]
fn it_should_preserve_parse_order_in_frequencies() {
    let range = Range::parse("JJ:0.5,AKs:0.75,QQ:1").unwrap();
    let order: Vec<&str> = range.frequencies().map(|(combo, _)| combo).collect();
    assert_eq!(order, vec!["JJ", "AKs", "QQ"]);
}

#[rstest]
#[case::weighted_combos("AKs:0.75,QQ:1,JJ:0.5", "AKs:0.75,QQ,JJ:0.5")]
// Intentional normalization: an explicit `:1` is canonicalized away to a bare combo.
#[case::explicit_weight_one_normalizes_to_bare("QQ:1", "QQ")]
#[case::bare_combos("AA,KK,QQ", "AA,KK,QQ")]
#[case::single_weighted("AKs:0.75", "AKs:0.75")]
#[case::single_bare("AA", "AA")]
// A 0% combo is not in the range: an explicit `:0` is dropped, not rendered.
#[case::zero_frequency_dropped("AKs:0", "")]
#[case::zero_frequency_dropped_among_others("AA:0,KK:1", "KK")]
#[case::empty("", "")]
#[case::whitespace_only("   ", "")]
fn it_should_render_canonical_range_string(#[case] input: &str, #[case] expected: &str) {
    assert_eq!(Range::parse(input).unwrap().to_range_string(), expected);
}

#[rstest]
fn it_should_render_via_display_identically_to_to_range_string() {
    let range = Range::parse("AKs:0.75,QQ:1,JJ:0.5").unwrap();
    assert_eq!(range.to_string(), range.to_range_string());
}

#[rstest]
#[case::weighted_combos("AKs:0.75,QQ:1,JJ:0.5")]
#[case::space_separated("AKs:0.75 QQ:1 JJ:0.5")]
#[case::bare_combos("AA,KK,QQ")]
// A dropped 0% combo still round-trips idempotently (it renders away on the first pass).
#[case::zero_frequency_dropped("AKs:0")]
#[case::zero_frequency_mixed("AA:0,KK:1")]
#[case::empty("")]
#[case::whitespace_only("   ")]
fn it_should_round_trip_parse_and_render_idempotently(#[case] input: &str) {
    let once = Range::parse(input).unwrap().to_range_string();
    let twice = Range::parse(&once).unwrap().to_range_string();
    assert_eq!(once, twice);
}

#[rstest]
#[case::empty("")]
#[case::whitespace_only("   ")]
fn it_should_parse_empty_input_to_an_empty_range(#[case] range: &str) {
    let parsed = Range::parse(range).expect("empty input parses to an empty range");
    assert_eq!(parsed.frequencies().count(), 0);
}

#[rstest]
fn from_pairs_should_materialize_and_preserve_order() {
    let range = Range::from_pairs([("JJ", 0.5), ("AKs", 0.75), ("QQ", 1.0)]).unwrap();
    // Insertion order is preserved, and weight 1.0 normalizes to a bare combo.
    assert_eq!(range.to_range_string(), "JJ:0.5,AKs:0.75,QQ");
    let order: Vec<&str> = range.frequencies().map(|(combo, _)| combo).collect();
    assert_eq!(order, vec!["JJ", "AKs", "QQ"]);
}

#[rstest]
#[case::full(1.0, "AKs")]
#[case::half(0.5, "AKs:0.5")]
#[case::three_quarters(0.75, "AKs:0.75")]
fn from_pairs_should_format_frequency_text_cleanly(#[case] freq: f64, #[case] expected: &str) {
    let range = Range::from_pairs([("AKs", freq)]).unwrap();
    assert_eq!(range.to_range_string(), expected);
}

#[rstest]
fn from_pairs_should_round_trip_repeating_decimal_through_parse() {
    let freq = 1.0 / 3.0;
    let range = Range::from_pairs([("AKs", freq)]).unwrap();
    // The formatted token must remain a parseable frequency, not an unparseable string.
    let rendered = range.to_range_string();
    let reparsed = Range::parse(&rendered).expect("formatted frequency must reparse");
    assert_eq!(reparsed.hand_frequency("AhKh"), freq);
}

#[rstest]
fn from_pairs_should_drop_zero_frequency_combo() {
    // A 0% combo is not in the range: a valid `0.0` is dropped, not stored. `-0.0` is
    // likewise dropped (`-0.0 == 0.0` under IEEE 754), so it can never reach
    // `format_frequency` and produce a `"-0"` token.
    let range = Range::from_pairs([("AKs", 0.0), ("QQ", -0.0)]).unwrap();
    assert_eq!(range.to_range_string(), "");
    assert_eq!(range.frequencies().count(), 0);
}

#[rstest]
fn from_pairs_should_drop_zero_frequency_among_kept_combos() {
    // The 0% combo is dropped while the rest of the range is preserved in order.
    let range = Range::from_pairs([("AA", 0.0), ("KK", 1.0)]).unwrap();
    assert_eq!(range.to_range_string(), "KK");
    let order: Vec<&str> = range.frequencies().map(|(combo, _)| combo).collect();
    assert_eq!(order, vec!["KK"]);
}

#[rstest]
fn parse_should_drop_zero_frequency_among_kept_combos() {
    // An at-rest-style range string with a 0% combo renders only the kept combos.
    let range = Range::parse("AA:0,KK:1").unwrap();
    assert_eq!(range.to_range_string(), "KK");
}

#[rstest]
fn from_pairs_should_materialize_empty_iterator_to_empty_range() {
    let range = Range::from_pairs(Vec::<(&str, f64)>::new()).unwrap();
    assert_eq!(range.frequencies().count(), 0);
    assert_eq!(range.to_range_string(), "");
}

#[rstest]
fn from_pairs_should_apply_last_write_wins_on_duplicate_combo() {
    // Documented last-write-wins behavior via IndexMap::insert, matching Range::parse.
    let range = Range::from_pairs([("AKs", 0.5), ("AKs", 0.75)]).unwrap();
    assert_eq!(range.to_range_string(), "AKs:0.75");
    assert_eq!(range.hand_frequency("AhKh"), 0.75);
}

#[rstest]
fn from_pairs_should_reject_invalid_combo() {
    let err = Range::from_pairs([("ZZ", 1.0)]).expect_err("invalid combo must be rejected");
    assert!(matches!(err, super::RangeParseError::Invalid(_)));
}

#[rstest]
#[case::above_one(1.5)]
#[case::negative(-0.5)]
fn from_pairs_should_reject_out_of_range_frequency(#[case] freq: f64) {
    let err =
        Range::from_pairs([("AKs", freq)]).expect_err("out-of-range frequency must be rejected");
    assert!(matches!(
        err,
        super::RangeParseError::FrequencyOutOfRange { .. }
    ));
}

#[rstest]
// A combo with no recognizable structure leaves unconsumed input.
#[case::not_a_combo("not-a-combo")]
// A `:` with no frequency digits: `frequency_text` requires `digit1`, so the `:` is
// left unconsumed and the whole parse fails rather than defaulting the combo to 1.0.
#[case::trailing_colon("AKs:")]
// Non-numeric frequency text after `:` likewise fails `frequency_text` and is left
// unconsumed, failing the parse. (The old regex silently treated both of these as
// frequency 1.0 — full weight — so the winnow parser is strictly safer here.)
#[case::non_numeric_frequency("AKs:abc")]
fn it_should_error_on_malformed_input(#[case] range: &str) {
    // Malformed tokens are now a genuine parse error rather than a silent empty range.
    assert!(Range::parse(range).is_err());
}
