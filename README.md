# spotlab

Poker tools in Rust and JavaScript.

A _spot_ is a decision situation — a position, a stack depth, an action
sequence, a board. These libraries are the pieces for working with them
programmatically: parsing the notation players already write, and rendering it
in interfaces they already recognize.

## Layout

- `crates/` — Rust crates, published to crates.io under the `spotlab-` prefix.
- `packages/` — npm packages, published under the `@spotlab` scope.

Rust is the source of truth for anything with a grammar or a rule in it. The
JavaScript packages wrap the same crates compiled to WebAssembly rather than
reimplementing them, so there is one definition of correct behavior and no
second implementation to drift.

### Crates

| Crate           | Description                                                            |
| --------------- | ---------------------------------------------------------------------- |
| `spotlab-range` | Range-string parsing, canonical serialization, and weighted-range math |

Crates are target-agnostic: they build for native targets and
`wasm32-unknown-unknown`, and take no dependency on `wasm-bindgen`, a runtime,
or a UI framework.

## Toolchain

`rust-toolchain.toml` pins the Rust version and installs the
`wasm32-unknown-unknown` target, so `cargo` and `rustup` need no extra setup:

```
cargo test --workspace
cargo check --workspace --target wasm32-unknown-unknown --no-default-features
```

## Development

Prerequisites:

- Rust, via [rustup](https://rustup.rs). `rust-toolchain.toml` pins the version and the wasm target.
- [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/), to build the WebAssembly behind `@spotlab/range`.
- Node.js and pnpm at the versions pinned in `devEngines` in `package.json`. Any pnpm v11 works to start with: it downloads and switches to the pinned version itself.

```
pnpm install
pnpm build                                       # wasm + all npm packages
pnpm test                                        # package unit tests
pnpm --filter @spotlab/hand-matrix storybook     # component development
pnpm --filter @spotlab/hand-matrix exec playwright install chromium
pnpm test-storybook                              # story tests (needs Chromium; production React, as Chromatic runs them)
pnpm check                                       # prettier

cargo test --workspace
cargo xtask codegen                              # regenerate packages/range/src/generated/constants.ts
```

## Status

Early. `spotlab-range` is in use and tested, but nothing is published to
crates.io or npm yet, and the API is not stable. Expect breaking changes until
the first release.

## Contributing

Run the checks above before opening a pull request. Commit messages are free-form.

### Releasing

Releases are managed with [Sampo](https://github.com/bruits/sampo). The published
packages are `spotlab-range` (crates.io), `@spotlab/range` and
`@spotlab/hand-matrix` (npm), versioned independently.

Every change that affects a published package needs a changeset:

```
pnpm install   # once; the pinned Sampo CLI is a root devDependency
pnpm sampo add
```

This writes a markdown file to `.sampo/changesets/` naming each affected package
(`cargo/spotlab-range`, `npm/@spotlab/range`, `npm/@spotlab/hand-matrix`), the
bump level (patch, minor, major) and a user-facing description. Commit it with
the change. Purely internal changes need no changeset.

`@spotlab/range` bundles `spotlab-range` compiled to WebAssembly, but the
manifests do not link them, so Sampo cannot see the relationship. When a
changeset for `@spotlab/range` ships a new `spotlab-range` version, say so in
its description, for example: "Bundles spotlab-range 0.2.0."

When changesets reach `main`, a workflow opens (and keeps updating) a release
pull request that bumps versions, updates lockfiles and writes each package's
`CHANGELOG.md`. Merging it publishes the new versions to crates.io and npm
through trusted publishing (OIDC, with npm provenance), tags each package as
`<name>@<version>` and creates a GitHub release. Maintainers: see
[RELEASING.md](RELEASING.md).

## License

MIT — see `LICENSE`.
