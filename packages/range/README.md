# @spotlab/range

A poker range-string parser and serializer, compiled from Rust
([`spotlab-range`](../../crates/spotlab-range)) to wasm. No React, no DOM —
suitable for a Node script, a server, a CLI, or a browser/Electron renderer.

```ts
import { initRange, parseRange, formatRange } from "@spotlab/range";

await initRange(); // once, at startup; idempotent, returns the same promise
const hands = parseRange("AKs:0.5,QQ"); // synchronous from here on
formatRange(hands); // "AKs:0.5,QQ"
```

## Why an explicit `initRange()`

Instantiating a wasm module is asynchronous, and top-level `await` is not
available in every consumer's bundle output — a CommonJS build has no way to
express it. Call `initRange()` once at startup and await it; every other export
is synchronous afterward, and throws `RangeNotInitializedError` if called
before it resolves. `initRange()` itself is idempotent on success and
retryable after a failure — a rejected call does not poison later calls.

## No bundler step for consumers

The `.wasm` binary is base64-inlined into the published JavaScript at build
time (`scripts/inline-wasm.mjs`), so this package ships as a single
self-contained ESM file with no binary asset, no `.wasm` import, and no
loader configuration for the consumer — even though the package's own build
bundles with Vite. The trade is roughly 33% extra payload size for
eliminating bundler/asset-loading configuration across every consuming
environment. The build asserts a size budget on the shipped bundle
(`scripts/check-size.mjs`); see the package's `build:size` script.

Concretely: the release `.wasm` is 132 KiB and the inlined module 176 KiB,
and the overhead survives compression largely intact — roughly 28% gzipped.
That is a deliberate trade for consumers loading from disk, where the
absolute difference is immaterial. If you are serving this over a network
and the overhead is material for you, please open an issue — shipping the
raw `.wasm` alongside the inlined build, as a separate entry point, is
straightforward and worth doing for a real use case.

## Errors

- `SpotlabInputError` — the input you gave was rejected: a range string
  failed the grammar, a hand token didn't resolve to a combo, or a frequency
  fell outside `[0, 1]`. `.kind` is `"invalid"` or `"frequencyOutOfRange"`.
  Shared across `@spotlab` packages — a sibling package should reuse this
  class rather than minting its own.
- `RangeInitError` — `initRange()` could not instantiate the wasm module.
  Carries the underlying failure as `.cause`.
- `RangeNotInitializedError` — a function export other than `initRange` was
  called before it resolved. `RANKS`, `SUITS`, and `COMBOS` are static data
  generated from the Rust crate's own constants and are readable immediately,
  with no `initRange()` call required.

## License

MIT — see `LICENSE` at the repository root.
