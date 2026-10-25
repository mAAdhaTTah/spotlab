# Releasing

For maintainers. Contributors only need `sampo add`; see "Releasing" in the [README](README.md).

`.github/workflows/release.yml` runs on pushes to `main`. With changesets pending it opens or updates a release pull request (version bumps, lockfiles, `CHANGELOG.md`s). Merging that PR builds the packages, publishes `spotlab-range` to crates.io and `@spotlab/range` and `@spotlab/hand-matrix` to npm using OIDC trusted publishing (no stored tokens, npm provenance), tags each `<name>@<version>` and creates GitHub releases. Versions already on a registry are skipped.

The Sampo CLI (`cargo install sampo --version 0.23.0 --locked`) matches the `sampo-core` bundled by the pinned action (`cargo-sampo-github-action-v0.21.0`). Keep them in step when bumping either.

## Setup

- Settings, Actions, General: enable "Allow GitHub Actions to create and approve pull requests".
- crates.io, `spotlab-range`, Settings, Trusted Publishing: GitHub repository `mAAdhaTTah/spotlab`, workflow `release.yml`, no environment.
- npm, for each of `@spotlab/range` and `@spotlab/hand-matrix`, Settings, Trusted Publisher, GitHub Actions: user `mAAdhaTTah`, repository `spotlab`, workflow `release.yml`, no environment. Allow direct publishing (`npm publish`); new configurations are stage-only by default and Sampo publishes directly. An unvalidated configuration expires after 48 hours, until its first successful publish.

## Release PR checks

Pull requests created with `GITHUB_TOKEN` do not trigger other workflows, so CI does not run on the release PR. Do not make status checks required on the release branch (`release/main`).
