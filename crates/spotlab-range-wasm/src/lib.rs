//! Thin `wasm-bindgen` façade over [`spotlab_range`]. Every export returns plain JS values via
//! `serde-wasm-bindgen` rather than wrapping the crate's own types, so the npm package can hand-
//! author its public `.d.ts` (including the type-only brand on `Hand`) instead of fighting generated
//! bindings.
//!
//! This crate exists only so the native `spotlab-range` dependents (the Tauri backend) never
//! link `wasm-bindgen` — it is not consumed from Rust at all, only built to `wasm32-unknown-unknown`
//! and loaded as a `.wasm` binary by `@spotlab/range`.

use spotlab_range::{Hand, HandFrequency, Range, RangeParseError};
use wasm_bindgen::prelude::*;

fn to_js_error(error: RangeParseError) -> JsValue {
    serde_wasm_bindgen::to_value(&error).unwrap_or_else(|_| JsValue::from_str(&error.to_string()))
}

fn deserialize_hands(hands: JsValue) -> Result<Vec<HandFrequency>, JsValue> {
    serde_wasm_bindgen::from_value(hands)
        .map_err(|error| to_js_error(RangeParseError::Invalid(error_message(error))))
}

/// The message of a `serde-wasm-bindgen` error. Its `Display` stringifies the wrapped JS `Error`
/// (`"Error: missing field ..."`), so read the `Error`'s own `message` instead.
fn error_message(error: serde_wasm_bindgen::Error) -> String {
    let fallback = error.to_string();
    JsValue::from(error)
        .dyn_into::<js_sys::Error>()
        .map(|error| String::from(error.message()))
        .unwrap_or(fallback)
}

fn serialize(value: &impl serde::Serialize) -> JsValue {
    serde_wasm_bindgen::to_value(value).expect("value is always serializable to JS")
}

/// Parse a range string into its expanded hand-keyed form.
#[wasm_bindgen(js_name = parse_range)]
pub fn parse_range(input: &str) -> Result<JsValue, JsValue> {
    let range = Range::parse(input).map_err(to_js_error)?;
    Ok(serialize(&range.to_hand_frequencies()))
}

/// Render a hand-keyed range back to its compacted string form.
#[wasm_bindgen(js_name = format_range)]
pub fn format_range(hands: JsValue) -> Result<String, JsValue> {
    let hands = deserialize_hands(hands)?;
    Ok(Range::from_hand_frequencies(hands).to_string())
}

/// The canonical combo a hand token belongs to (e.g. `AsKd` -> `AKo`).
#[wasm_bindgen(js_name = combo_of)]
pub fn combo_of(hand: &str) -> Result<String, JsValue> {
    Hand::parse(hand)
        .map(|hand| hand.to_combo())
        .map_err(to_js_error)
}

/// Every concrete hand of a canonical combo, already canonical.
#[wasm_bindgen(js_name = hands_of_combo)]
pub fn hands_of_combo(combo: &str) -> Vec<String> {
    Hand::from_combo(combo)
        .into_iter()
        .map(Hand::into_inner)
        .collect()
}

/// Collapse a hand-keyed range to the mean weight per combo (see
/// [`spotlab_range::Range::to_combo_weights`]).
#[wasm_bindgen(js_name = to_combo_weights)]
pub fn to_combo_weights(hands: JsValue) -> Result<JsValue, JsValue> {
    let hands = deserialize_hands(hands)?;
    let range = Range::from_hand_frequencies(hands);
    Ok(serialize(&range.to_combo_weights()))
}

/// Every hand in the deck at weight 1 — the unconstrained range.
#[wasm_bindgen(js_name = full_range)]
pub fn full_range() -> JsValue {
    serialize(&Range::full().to_hand_frequencies())
}
