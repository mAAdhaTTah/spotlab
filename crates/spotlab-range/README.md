# spotlab-range

A poker range-string parser and serializer: the combo/hand grammar (`AKs`,
`AKo:0.5`, `AsKd`, suitless `AK`), canonical hand tokens, and weighted-range
arithmetic (reach/oversubscription checks, combo collapse).

Parsing and canonical rendering round-trip, so a range read from a file, a
database column, or a text field comes back out in a stable, comparable form.

Target-agnostic: builds for native targets and `wasm32-unknown-unknown` with
no `wasm-bindgen` dependency (see the sibling `spotlab-range-wasm` crate for
the wasm-bindgen shim consumed by the `@spotlab/range` npm package).

## Features

- `serde` (default) — `Serialize`/`Deserialize` on the wire types
  (`HandFrequency`, `Hand`, `RangeParseError`). This is the crate's validation
  boundary for foreign data: frequencies are checked against `[0, 1]` on the
  way in, so a deserialized range is valid by construction.
- `specta` — `specta::Type` impls for TypeScript binding generation. Off by
  default, because it pins a pre-release `specta` version; only consumers
  generating TypeScript bindings should pay that cost.

## License

MIT — see `LICENSE` at the repository root.
