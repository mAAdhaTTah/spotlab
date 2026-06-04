use pretty_assertions::assert_eq;
use rstest::rstest;

use crate::tree::range::Range;

#[rstest]
#[case::pair("QQ", "QhQd", 1.0)]
#[case::suited("AKs", "AhKh", 1.0)]
#[case::offsuit("AKo", "AhKd", 1.0)]
#[case::with_frequency("AKs:0.75", "AhKh", 0.75)]
#[case::absent_combo("AKs", "AhKd", 0.0)]
#[case::absent_from_empty("", "AhKh", 0.0)]
#[case::space_separated("AKs:0.75 QQ:1 JJ:0.5", "AhKh", 0.75)]
#[case::comma_separated("AKs:0.75,QQ:1,JJ:0.5", "QhQd", 1.0)]
#[case::comma_separated_freq("AKs:0.75,QQ:1,JJ:0.5", "JhJd", 0.5)]
#[case::zero_frequency("AKs:0", "AhKh", 0.0)]
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
    let range = Range::parse("AKs:0.75,QQ").unwrap();
    let mut frequencies: Vec<(&str, f64)> = range.frequencies().collect();
    frequencies.sort_by(|a, b| a.0.cmp(b.0));
    assert_eq!(frequencies, vec![("AKs", 0.75), ("QQ", 1.0)]);
}

#[rstest]
#[case::trailing_comma("AA,")]
#[case::leading_comma(",AA")]
#[case::surrounding_whitespace("  AA  ")]
fn it_should_tolerate_surrounding_separators(#[case] range: &str) {
    assert_eq!(Range::parse(range).unwrap().hand_frequency("AhAd"), 1.0);
}

#[rstest]
#[case::empty("")]
#[case::whitespace_only("   ")]
fn it_should_parse_empty_input_to_an_empty_range(#[case] range: &str) {
    let parsed = Range::parse(range).expect("empty input parses to an empty range");
    assert_eq!(parsed.frequencies().count(), 0);
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
