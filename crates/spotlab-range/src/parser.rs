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

pub(super) fn suit(input: &mut &str) -> winnow::Result<char> {
    winnow::token::one_of(SUITS)
        .context(StrContext::Label("Suit"))
        .parse_next(input)
}

/// Parse a suit-specific 4-character hand token (`rank suit rank suit`, e.g. `AsKh`).
///
/// Disjoint from [`combo`]: a hand always has a suit char in position 2 (`s`/`c`/`d`/`h`),
/// where a combo has a second *rank*, so the two alternatives never both match a token.
pub(super) fn hand(input: &mut &str) -> winnow::Result<String> {
    seq!(rank, suit, rank, suit)
        .map(|(r1, s1, r2, s2)| format!("{r1}{s1}{r2}{s2}"))
        .context(StrContext::Label("Hand"))
        .parse_next(input)
}

pub(super) fn frequency_text(input: &mut &str) -> winnow::Result<String> {
    (digit1, opt(preceded(".", digit1)))
        .take()
        .map(|text: &str| text.to_string())
        .context(StrContext::Label("Frequency"))
        .parse_next(input)
}

fn expand_combo(combo: &str) -> Vec<String> {
    let bytes = combo.as_bytes();
    let is_no_suit_non_pair = bytes.len() == 2 && bytes[0] != bytes[1];

    if is_no_suit_non_pair {
        vec![format!("{combo}s"), format!("{combo}o")]
    } else {
        vec![combo.to_string()]
    }
}

/// Expand a combo token (as written in a range string, so possibly the suitless `AK` form)
/// into every concrete 4-character hand it covers.
///
/// Combines [`expand_combo`] (which splits a suitless non-pair `AK` into `AKs`/`AKo`) with
/// [`combo_to_hands`] (which enumerates each canonical combo's concrete hands), so a suitless
/// `AK` yields all 16 hands while `AKs`, `AKo`, and `QQ` yield their 4 / 12 / 6.
pub(super) fn combo_token_to_hands(combo: &str) -> Vec<String> {
    expand_combo(combo)
        .iter()
        .flat_map(|canonical| combo_to_hands(canonical))
        .collect()
}

/// Parse one hand-keyed range entry: a suit-specific [`hand`] token or a [`combo`] token,
/// with an optional `:frequency` suffix. A hand token yields a single hand key; a combo token
/// expands to all of its concrete hands (`combo_token_to_hands`), each carrying the entry's
/// shared weight/raw.
pub(super) fn hand_range_entry(input: &mut &str) -> winnow::Result<Vec<(String, RangeEntry)>> {
    seq!(
        alt((
            hand.map(|h| vec![h]),
            combo.map(|c| combo_token_to_hands(&c))
        )),
        opt(preceded(":", frequency_text)),
    )
    .map(|(hands, frequency)| {
        let raw = frequency.unwrap_or_else(|| "1".to_string());
        // `frequency_text` only ever yields `digit1 (. digit1)?`, so `raw` is always a
        // parseable `f64`; a failure here means that grammar regressed.
        let weight = raw
            .parse()
            .expect("frequency_text guarantees a parseable f64");

        hands
            .into_iter()
            .map(|key| {
                (
                    key,
                    RangeEntry {
                        weight,
                        raw: raw.clone(),
                    },
                )
            })
            .collect()
    })
    .parse_next(input)
}

pub(super) fn hand_range(input: &mut &str) -> winnow::Result<Vec<(String, RangeEntry)>> {
    seq!(
        _: opt(separator),
        separated(0.., hand_range_entry, separator),
        _: opt(separator),
    )
    .map(|(entries,): (Vec<Vec<(String, RangeEntry)>>,)| entries.into_iter().flatten().collect())
    .context(StrContext::Label("Range"))
    .parse_next(input)
}

pub(super) fn separator(input: &mut &str) -> winnow::Result<()> {
    take_while(1.., |c: char| c == ',' || c.is_whitespace())
        .void()
        .parse_next(input)
}

pub(crate) const SUITS: [char; 4] = ['c', 'd', 'h', 's'];
pub(crate) const RANKS: [char; 13] = [
    'A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2',
];

/// Expand a canonical combo key into every concrete 4-character hand it represents.
///
/// The inverse of [`hand_to_combo`] over a whole combo: a pair yields its 6 distinct-suit
/// hands, a suited combo its 4 same-suit hands, an offsuit combo its 12 mixed-suit hands.
/// Ranks are emitted in combo order so each hand round-trips back through [`hand_to_combo`].
/// This is the lossless preflop combo→hand projection (suit-symmetric, all cards live, no
/// board) the hand-keyed consumed path is built on.
pub(super) fn combo_to_hands(combo: &str) -> Vec<String> {
    let bytes = combo.as_bytes();
    let rank_one = bytes[0] as char;
    let rank_two = if bytes.len() >= 2 {
        bytes[1] as char
    } else {
        rank_one
    };

    match combo.get(2..3) {
        None => {
            let mut hands = Vec::with_capacity(6);
            for (idx, suit_one) in SUITS.iter().enumerate() {
                for suit_two in SUITS.iter().skip(idx + 1) {
                    hands.push(format!("{rank_one}{suit_one}{rank_two}{suit_two}"));
                }
            }
            hands
        }
        Some("s") => SUITS
            .iter()
            .map(|suit| format!("{rank_one}{suit}{rank_two}{suit}"))
            .collect(),
        Some("o") => {
            let mut hands = Vec::with_capacity(12);
            for suit_one in SUITS {
                for suit_two in SUITS {
                    if suit_one != suit_two {
                        hands.push(format!("{rank_one}{suit_one}{rank_two}{suit_two}"));
                    }
                }
            }
            hands
        }
        Some(other) => unreachable!("invalid suitedness {other} in combo {combo}"),
    }
}

/// Resolve a 4-character hand token (e.g. `AsKd`) into its combo (e.g. `AKo`).
///
/// `hand` is untrusted IPC input on some callers' paths (e.g. `format_range`'s
/// `Vec<HandFrequency>`), so this validates length and each character against the rank/suit
/// grammar rather than slicing byte ranges unconditionally, matching the
/// `validate_grade_inputs` guard convention (`src-tauri/src/drill/scoring.rs`) instead of
/// panicking on malformed input.
pub(super) fn hand_to_combo(hand: &str) -> Result<String, super::RangeParseError> {
    let chars: Vec<char> = hand.chars().collect();
    let [rank_one, suit_one, rank_two, suit_two] = chars[..] else {
        return Err(super::RangeParseError::Invalid(format!(
            "Invalid hand string: {hand}"
        )));
    };

    if !RANKS.contains(&rank_one)
        || !RANKS.contains(&rank_two)
        || !SUITS.contains(&suit_one)
        || !SUITS.contains(&suit_two)
    {
        return Err(super::RangeParseError::Invalid(format!(
            "Invalid hand string: {hand}"
        )));
    }

    let suited = if rank_one == rank_two {
        ""
    } else if suit_one == suit_two {
        "s"
    } else {
        "o"
    };

    Ok(format!("{rank_one}{rank_two}{suited}"))
}
