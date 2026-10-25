# spotlab-range

A poker range-string parser and serializer: the combo/hand grammar (`AKs`,
`AKo:0.5`, `AsKd`, suitless `AK`, shorthand `22+` / `TT-77`), canonical hand tokens, and weighted-range
arithmetic (reach/oversubscription checks, combo collapse).

Parsing and canonical rendering round-trip, so a range read from a file, a
database column, or a text field comes back out in a stable, comparable form.

Target-agnostic: builds for native targets and `wasm32-unknown-unknown` with
no `wasm-bindgen` dependency (see the sibling `spotlab-range-wasm` crate for
the wasm-bindgen shim consumed by the `@spotlab/range` npm package).

## Grammar

A range is a comma- or whitespace-separated list of tokens, each with an
optional `:weight` in `[0, 1]` (default `1`):

| Token                       | Covers                                     |
| --------------------------- | ------------------------------------------ |
| `AsKd`                      | that one hand                              |
| `QQ`, `AKs`, `AKo`          | every hand of the combo                    |
| `AK`                        | `AKs` and `AKo`                            |
| `22+`                       | `22` up to `AA`                            |
| `A2s+`, `KTo+`, `QJ+`       | the kicker up to just below the high card  |
| `TT-77`, `A5s-A2s`, `J9-J7` | the inclusive run, written in either order |

A `:weight` on a shorthand token applies to every combo it covers. A `-` run
must stay within one family: two pairs, or one high card at one suitedness.

Rendering is canonical. A combo with every hand at one weight renders as its
combo token, and a contiguous run of such combos at one weight renders as
shorthand: `X+` when it reaches the top (`QQ+`, `AJs+`), `HI-LO` otherwise
(`TT-77`). Suited and offsuit runs render separately (`AQs+,AQo+`, never
`AQ+`). Anything else falls back to per-hand tokens.

## Features

- `serde` (default) — `Serialize`/`Deserialize` on the wire types
  (`HandFrequency`, `Hand`, `RangeParseError`). This is the crate's validation
  boundary for foreign data: frequencies are checked against `[0, 1]` on the
  way in, so a deserialized range is valid by construction.
- `specta` — `specta::Type` impls for TypeScript binding generation. Off by
  default, because it pins a pre-release `specta` version; only consumers
  generating TypeScript bindings should pay that cost.

## Minimum supported Rust version

Rust 1.93, with every feature enabled; CI tests the crate on that version. The
MSRV covers the `specta` feature: `specta`'s pre-release builds need 1.93 but
do not declare a `rust-version`, so Cargo cannot warn about it.

## License

MIT — see `LICENSE`.
