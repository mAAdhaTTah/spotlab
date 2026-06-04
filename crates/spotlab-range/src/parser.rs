use winnow::ascii::digit1;
use winnow::combinator::{alt, opt, preceded, separated, seq};
use winnow::error::StrContext;
use winnow::prelude::*;
use winnow::token::take_while;

use super::RangeEntry;

pub(super) fn rank(input: &mut &str) -> winnow::Result<char> {
    winnow::token::one_of([
        'A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2',
    ])
    .context(StrContext::Label("Rank"))
    .parse_next(input)
}

pub(super) fn suitedness(input: &mut &str) -> winnow::Result<&'static str> {
    alt((
        "s".map(|_| "s"),
        "o".map(|_| "o"),
        winnow::combinator::empty.map(|_| ""),
    ))
    .parse_next(input)
}

pub(super) fn combo(input: &mut &str) -> winnow::Result<String> {
    seq!(rank, rank, suitedness)
        .map(|(first, second, suited)| format!("{first}{second}{suited}"))
        .context(StrContext::Label("Combo"))
        .parse_next(input)
}

pub(super) fn frequency_text(input: &mut &str) -> winnow::Result<String> {
    (digit1, opt(preceded(".", digit1)))
        .take()
        .map(|text: &str| text.to_string())
        .context(StrContext::Label("Frequency"))
        .parse_next(input)
}

pub(super) fn range_entry(input: &mut &str) -> winnow::Result<(String, RangeEntry)> {
    seq!(combo, opt(preceded(":", frequency_text)))
        .map(|(combo, frequency)| {
            let raw = frequency.unwrap_or_else(|| "1".to_string());
            // `frequency_text` only ever yields `digit1 (. digit1)?`, so `raw` is always a
            // parseable `f64`; a failure here means that grammar regressed.
            let weight = raw
                .parse()
                .expect("frequency_text guarantees a parseable f64");
            (combo, RangeEntry { weight, raw })
        })
        .parse_next(input)
}

pub(super) fn separator(input: &mut &str) -> winnow::Result<()> {
    take_while(1.., |c: char| c == ',' || c.is_whitespace())
        .void()
        .parse_next(input)
}

pub(super) fn range(input: &mut &str) -> winnow::Result<Vec<(String, RangeEntry)>> {
    seq!(
        _: opt(separator),
        separated(0.., range_entry, separator),
        _: opt(separator),
    )
    .map(|(entries,)| entries)
    .context(StrContext::Label("Range"))
    .parse_next(input)
}

/// Resolve a 4-character hand token (e.g. `AsKd`) into its combo (e.g. `AKo`).
pub(super) fn hand_to_combo(hand: &str) -> String {
    let (rank_one, suit_one, rank_two, suit_two) =
        (&hand[0..1], &hand[1..2], &hand[2..3], &hand[3..4]);

    let suited = if rank_one == rank_two {
        ""
    } else if suit_one == suit_two {
        "s"
    } else {
        "o"
    };

    format!("{rank_one}{rank_two}{suited}")
}
