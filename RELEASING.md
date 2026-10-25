# Releasing

For maintainers. Contributors only need `sampo add`; see "Releasing" in the [README](README.md).

`.github/workflows/release.yml` runs on pushes to `main`. With changesets pending it opens or updates a release pull request (version bumps, lockfiles, `CHANGELOG.md`s). Merging that PR builds the packages, publishes `spotlab-range` to crates.io and `@spotlab/range` and `@spotlab/hand-matrix` to npm using OIDC trusted publishing (no stored tokens, npm provenance), tags each `<name>@<version>` and creates GitHub releases. Versions already on a registry are skipped.

The Sampo CLI, pinned as the root `package.json`'s `sampo` devDependency (and installed from it by `.github/workflows/renovate-changesets.yml`), matches the `sampo-core` bundled by the action pinned in `release.yml`. Sampo releases both together, and Renovate groups them into one "Sampo" PR so they stay in step. If you bump either by hand, bump the other to the release published alongside it.

## Setup

- Settings, Actions, General: enable "Allow GitHub Actions to create and approve pull requests".
- crates.io, `spotlab-range`, Settings, Trusted Publishing: GitHub repository `mAAdhaTTah/spotlab`, workflow `release.yml`, no environment.
- npm, for each of `@spotlab/range` and `@spotlab/hand-matrix`, Settings, Trusted Publisher, GitHub Actions: user `mAAdhaTTah`, repository `spotlab`, workflow `release.yml`, no environment. Allow direct publishing (`npm publish`); new configurations are stage-only by default and Sampo publishes directly. An unvalidated configuration expires after 48 hours, until its first successful publish.

## Renovate changesets

Renovate PRs that change a dependency shipped to users get a patch changeset committed by `.github/workflows/renovate-changesets.yml`, so the update appears in the changelog. Its script, `.github/scripts/renovate-changesets.py`, compares the manifests against the merge base with `main` and counts version changes in `spotlab-range`'s `[dependencies]` (`cargo/spotlab-range`, and `npm/@spotlab/range` too except for specta, which the wasm build does not enable), `spotlab-range-wasm`'s `[dependencies]` (`npm/@spotlab/range`) and `@spotlab/hand-matrix`'s `peerDependencies`. Dev dependencies, toolchains, actions and lockfile-only updates get none. It runs `sampo add` once per package, unless the branch already adds a changeset. To change the bump or the wording, edit that file on the PR. The workflow only runs on Renovate's own pushes, so it leaves your commit alone, and Renovate stops updating a PR once someone else commits to it.

Renovate ignores commits by `github-actions[bot]` (`gitIgnoredAuthors`), so it keeps rebasing these PRs. CI does not rerun on the changeset commit (it is pushed with `GITHUB_TOKEN`), so a PR with one shows no checks for its head commit. None are required on `main`, and the commit only adds Markdown, but check Renovate's commit before merging.

## Release PR checks

Pull requests created with `GITHUB_TOKEN` do not trigger other workflows, so CI does not run on the release PR. Do not make status checks required on the release branch (`release/main`).
