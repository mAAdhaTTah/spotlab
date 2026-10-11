//! The [`Hand`] newtype: the single owner of hand-token logic in this crate.
//!
//! A `Hand` wraps a canonical 4-character `rank suit rank suit` token (e.g. `AhAs`) and is the
//! sole construction/validation boundary for that grammar. Construction canonicalizes the suit
//! ordering to lowest-suit-first — the same ordering [`Hand::from_combo`] produces — so
//! semantically-equal tokens (`AsAh` / `AhAs`) collapse to one key, letting `Hand` back the
//! range's [`indexmap::IndexMap`] keys and the `HandFrequency` wire type.

use std::borrow::Borrow;
use std::fmt;

#[cfg(feature = "serde")]
use serde::de::{self, Deserializer};
#[cfg(feature = "serde")]
use serde::{Deserialize, Serialize};

use super::{RangeParseError, RANKS, SUITS};

#[derive(Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord)]
#[cfg_attr(feature = "serde", derive(Serialize))]
pub struct Hand(String);

// Hand-expanded from `specta_typescript::branded!`, which declares the struct and implements
// the trait in one invocation and so cannot sit behind a cfg without making `Hand` itself
// conditional. Keep this in step with that macro's no-generics arm: the brand string and
// `DataType` shape determine the generated TypeScript, which consumers may assert is unchanged.
#[cfg(feature = "specta")]
impl specta::Type for Hand {
    fn definition(types: &mut specta::Types) -> specta::datatype::DataType {
        let ty = <String as specta::Type>::definition(types);
        specta::datatype::DataType::Reference(specta::datatype::Reference::opaque(
            specta_typescript::Branded::new(std::borrow::Cow::Borrowed("Hand"), ty),
        ))
    }
}

impl Hand {
    /// Validate the 4-char `rank suit rank suit` grammar and canonicalize suit ordering — the
    /// construction boundary for a hand token from the range-string grammar or the wire.
    /// Rejects a malformed token with [`RangeParseError::Invalid`].
    pub fn parse(token: &str) -> Result<Self, RangeParseError> {
        let combo = hand_to_combo(token)?;
        Ok(Self(canonicalize(token, &combo)))
    }

    /// Normalize a trusted-but-possibly-non-canonical token (e.g. a solver's `show_hand_order`
    /// label, which lists a pair's two cards highest-suit-first, the reverse of the canonical
    /// key) into canonical suit ordering, returning the token unchanged when it is not a
    /// well-formed hand — there is no canonical form to map a malformed token to, and this path
    /// must not error.
    pub fn canonicalize(token: &str) -> Self {
        match hand_to_combo(token) {
            Ok(combo) => Self(canonicalize(token, &combo)),
            Err(_) => Self(token.to_string()),
        }
    }

    /// The combo this hand belongs to (e.g. `AsKd` → `AKo`, `QhQs` → `QQ`).
    pub fn to_combo(&self) -> String {
        // A `Hand` is a validated token except for `canonicalize`'s malformed-input
        // fallback, which never reaches combo derivation; fall back to the raw token if it does.
        hand_to_combo(&self.0).unwrap_or_else(|_| self.0.clone())
    }

    /// Every concrete hand of a canonical combo (`QQ` → its 6 distinct-suit pairs, `AKs` → 4,
    /// `AKo` → 12), each already canonical. The inverse of [`Hand::to_combo`] over a whole combo.
    pub fn from_combo(combo: &str) -> Vec<Hand> {
        combo_to_hands(combo).into_iter().map(Hand).collect()
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }

    pub fn into_inner(self) -> String {
        self.0
    }
}

#[cfg(feature = "serde")]
impl<'de> Deserialize<'de> for Hand {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let token = String::deserialize(deserializer)?;
        Hand::parse(&token).map_err(de::Error::custom)
    }
}

impl fmt::Display for Hand {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

impl AsRef<str> for Hand {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

impl Borrow<str> for Hand {
    fn borrow(&self) -> &str {
        &self.0
    }
}

impl PartialEq<str> for Hand {
    fn eq(&self, other: &str) -> bool {
        self.0.as_str() == other
    }
}

impl PartialEq<&str> for Hand {
    fn eq(&self, other: &&str) -> bool {
        self.0.as_str() == *other
    }
}

impl PartialEq<String> for Hand {
    fn eq(&self, other: &String) -> bool {
        &self.0 == other
    }
}

/// Pick the canonical ordering of `token` — the entry of `combo`'s concrete hands naming the same
/// two cards. A pair reorders to lowest-suit-first (`AsAh` → `AhAs`); a non-pair keeps its
/// higher-rank-first order. Falls back to the token unchanged when no candidate matches (a
/// degenerate token like `AsAs` naming one card twice, which has no combo hand).
fn canonicalize(token: &str, combo: &str) -> String {
    combo_to_hands(combo)
        .into_iter()
        .find(|candidate| same_cards(candidate, token))
        .unwrap_or_else(|| token.to_string())
}

/// Whether two 4-character hand tokens name the same two cards regardless of card order (e.g.
/// `2d2c` and `2c2d`). Both inputs must be validated 4-char ASCII tokens.
fn same_cards(a: &str, b: &str) -> bool {
    let (a_first, a_second) = a.split_at(2);
    let (b_first, b_second) = b.split_at(2);
    (a_first == b_first && a_second == b_second) || (a_first == b_second && a_second == b_first)
}

/// Resolve a 4-character hand token (e.g. `AsKd`) into its combo (e.g. `AKo`).
///
/// `token` may be untrusted input, so this validates length and each character against the
/// rank/suit grammar rather than slicing byte ranges unconditionally, returning
/// [`RangeParseError::Invalid`] instead of panicking on malformed input.
fn hand_to_combo(token: &str) -> Result<String, RangeParseError> {
    let chars: Vec<char> = token.chars().collect();
    let [rank_one, suit_one, rank_two, suit_two] = chars[..] else {
        return Err(RangeParseError::Invalid(format!(
            "Invalid hand string: {token}"
        )));
    };

    if !RANKS.contains(&rank_one)
        || !RANKS.contains(&rank_two)
        || !SUITS.contains(&suit_one)
        || !SUITS.contains(&suit_two)
    {
        return Err(RangeParseError::Invalid(format!(
            "Invalid hand string: {token}"
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

/// Expand a canonical combo key into every concrete 4-character hand it represents.
///
/// A pair yields its 6 distinct-suit hands, a suited combo its 4 same-suit hands, an offsuit combo
/// its 12 mixed-suit hands. Ranks are emitted in combo order and suits lowest-first, so each hand
/// is canonical and round-trips back through [`hand_to_combo`].
fn combo_to_hands(combo: &str) -> Vec<String> {
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
