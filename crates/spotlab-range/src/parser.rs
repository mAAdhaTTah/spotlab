use winnow::ascii::digit1;
use winnow::combinator::{alt, opt, preceded, separated, seq};
use winnow::error::StrContext;
use winnow::prelude::*;
use winnow::token::take_while;

use super::{Hand, RangeEntry, RANKS, SUITS};

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

/// Parse a suit-specific 4-character hand token (`rank suit rank suit`, e.g. `AsKh`) into its
/// canonical [`Hand`].
///
/// Disjoint from [`combo`]: a hand always has a suit char in position 2 (`s`/`c`/`d`/`h`),
/// where a combo has a second *rank*, so the two alternatives never both match a token. The
/// grammar guarantees a well-formed token, so [`Hand::canonicalize`] only canonicalizes here.
pub(super) fn hand(input: &mut &str) -> winnow::Result<Hand> {
    seq!(rank, suit, rank, suit)
        .map(|(r1, s1, r2, s2)| Hand::canonicalize(&format!("{r1}{s1}{r2}{s2}")))
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
/// into every concrete [`Hand`] it covers.
///
/// Combines [`expand_combo`] (which splits a suitless non-pair `AK` into `AKs`/`AKo`) with
/// [`Hand::from_combo`] (which enumerates each canonical combo's concrete hands), so a suitless
/// `AK` yields all 16 hands while `AKs`, `AKo`, and `QQ` yield their 4 / 12 / 6.
pub(super) fn combo_token_to_hands(combo: &str) -> Vec<Hand> {
    expand_combo(combo)
        .iter()
        .flat_map(|canonical| Hand::from_combo(canonical))
        .collect()
}

/// A combo token's optional shorthand suffix.
#[derive(Clone)]
enum Shorthand {
    /// `22+` / `A2s+`: up to `AA`, or up to the kicker just below the high card.
    Plus,
    /// `TT-77` / `A5s-A2s`: an inclusive run to this other end, in either order.
    To(String),
}

/// A combo token split into its high rank, low rank (equal for a pair), and suitedness
/// (`"s"`, `"o"`, or `""` for suitless), with ranks as indices into [`RANKS`].
fn combo_parts(combo: &str) -> (usize, usize, &str) {
    let rank_index = |c: char| RANKS.iter().position(|&r| r == c).expect("combo grammar");
    let mut chars = combo.chars();
    let high = rank_index(chars.next().expect("combo grammar"));
    let low = rank_index(chars.next().expect("combo grammar"));
    (high, low, &combo[2..])
}

/// Expand a combo token and its shorthand suffix into the combo tokens it covers (still
/// possibly suitless), or `None` when the shorthand spans more than one family: a `-` must
/// join two pairs, or two combos sharing a high card and suitedness.
fn expand_shorthand(combo: &str, shorthand: Option<Shorthand>) -> Option<Vec<String>> {
    let (high, low, suited) = combo_parts(combo);
    let (from, to) = match shorthand {
        None => return Some(vec![combo.to_string()]),
        Some(Shorthand::Plus) if high == low => (low, RANKS.len() - 1),
        Some(Shorthand::Plus) if high > low => (low, high - 1),
        Some(Shorthand::Plus) => return None,
        Some(Shorthand::To(other)) => {
            let (other_high, other_low, other_suited) = combo_parts(&other);
            let both_pairs = high == low && other_high == other_low;
            let same_kicker_family = high != low
                && other_high != other_low
                && high == other_high
                && suited == other_suited
                && high > low.max(other_low);
            if !both_pairs && !same_kicker_family {
                return None;
            }
            (low.min(other_low), low.max(other_low))
        }
    };

    Some(
        (from..=to)
            .rev()
            .map(|rank| {
                if high == low {
                    format!("{0}{0}", RANKS[rank])
                } else {
                    format!("{}{}{suited}", RANKS[high], RANKS[rank])
                }
            })
            .collect(),
    )
}

/// A [`combo`] token with an optional shorthand suffix (`22+`, `A2s+`, `TT-77`, `A5s-A2s`),
/// expanded into every concrete [`Hand`] it covers.
fn combo_spec(input: &mut &str) -> winnow::Result<Vec<Hand>> {
    (
        combo,
        opt(alt((
            "+".value(Shorthand::Plus),
            preceded("-", combo).map(Shorthand::To),
        ))),
    )
        .verify_map(|(combo, shorthand)| expand_shorthand(&combo, shorthand))
        .map(|combos| {
            combos
                .iter()
                .flat_map(|combo| combo_token_to_hands(combo))
                .collect()
        })
        .context(StrContext::Label("Combo"))
        .parse_next(input)
}

/// Parse one hand-keyed range entry: a suit-specific [`hand`] token or a [`combo_spec`] token,
/// with an optional `:frequency` suffix. A hand token yields a single hand key; a combo token
/// expands to all of its concrete hands (`combo_token_to_hands`), each carrying the entry's
/// shared weight/raw.
pub(super) fn hand_range_entry(input: &mut &str) -> winnow::Result<Vec<(Hand, RangeEntry)>> {
    seq!(
        alt((hand.map(|h| vec![h]), combo_spec,)),
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

pub(super) fn hand_range(input: &mut &str) -> winnow::Result<Vec<(Hand, RangeEntry)>> {
    seq!(
        _: opt(separator),
        separated(0.., hand_range_entry, separator),
        _: opt(separator),
    )
    .map(|(entries,): (Vec<Vec<(Hand, RangeEntry)>>,)| entries.into_iter().flatten().collect())
    .context(StrContext::Label("Range"))
    .parse_next(input)
}

pub(super) fn separator(input: &mut &str) -> winnow::Result<()> {
    take_while(1.., |c: char| c == ',' || c.is_whitespace())
        .void()
        .parse_next(input)
}
