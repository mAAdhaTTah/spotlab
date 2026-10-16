# spotlab-range-wasm

A thin `wasm-bindgen` façade over [`spotlab-range`](../spotlab-range), built
to `wasm32-unknown-unknown` as a `cdylib`. It exists as its own crate so the
core parser stays target-agnostic and so native consumers (the Tauri
backend) never link `wasm-bindgen`.

Every export returns a plain JS value via `serde-wasm-bindgen` rather than a
wrapped Rust type, so the consuming npm package (`@spotlab/range`) can
hand-author its own public `.d.ts` instead of fighting generated bindings.
This crate is not meant to be depended on directly from Rust — it has no
public API beyond its `#[wasm_bindgen]` exports, and no tests of its own; the
behavior it wraps is tested in `spotlab-range`, and the wasm boundary itself
is tested from `@spotlab/range`'s own test suite, which exercises the built
`.wasm` module.

## License

MIT — see `LICENSE`.
