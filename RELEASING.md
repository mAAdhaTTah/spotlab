# Releasing

For maintainers. Contributors only need `sampo add`; see "Releasing" in the [README](README.md).

Releases run from `.github/workflows/release.yml` on pushes to `main`:

- When changesets are pending, it opens or updates a release pull request that bumps versions, refreshes lockfiles and writes each package's `CHANGELOG.md`.
- When that PR is merged, it builds the packages, publishes `spotlab-range` to crates.io and `@spotlab/range` and `@spotlab/hand-matrix` to npm (OIDC trusted publishing, npm provenance), tags each `<name>@<version>` and creates GitHub releases.

The Sampo CLI (`cargo install sampo --version 0.22.0 --locked`) matches the `sampo-core` version bundled by the pinned action (`cargo-sampo-github-action-v0.20.0`). Keep them in step when bumping either.

## The publish switch

The repository variable `RELEASE_PUBLISH_ENABLED` controls publishing. Until it is `true`, the workflow can open release PRs but never publishes, and the action runs with `dry-run`. Without this, a push to `main` with no pending changesets would try to publish any version not yet on a registry. Set it only after the setup below.

## One-time setup

1. Settings, Actions, General: enable "Allow GitHub Actions to create and approve pull requests".
2. Publish the first version of all three packages by hand, from an up-to-date `main`, in this order. Trusted publishing cannot be configured for a package or crate that does not exist yet, and the first crates.io release needs an API token.
   ```
   pnpm install --frozen-lockfile && pnpm build
   cargo login                                    # a short-lived token with publish-new
   cargo publish -p spotlab-range
   npm login
   (cd packages/range && pnpm publish --access public)
   (cd packages/hand-matrix && pnpm publish --access public)
   git tag spotlab-range@0.1.0 @spotlab/range@0.1.0 @spotlab/hand-matrix@0.1.0
   git push origin spotlab-range@0.1.0 @spotlab/range@0.1.0 @spotlab/hand-matrix@0.1.0
   ```
   Revoke the crates.io token afterwards. The tags match Sampo's `tag_format`.
3. crates.io: `spotlab-range`, Settings, Trusted Publishing, add a GitHub publisher: repository `mAAdhaTTah/spotlab`, workflow `release.yml`, no environment.
4. npm: for each of `@spotlab/range` and `@spotlab/hand-matrix`, Settings, Trusted Publisher, GitHub Actions: user `mAAdhaTTah`, repository `spotlab`, workflow `release.yml`, no environment. Allow direct publishing (`npm publish`): new configurations are stage-only by default, and Sampo publishes directly.
   An unvalidated npm configuration expires 48 hours after creation and is validated by its first successful publish, so do this step shortly before step 5.
5. Set the repository variable `RELEASE_PUBLISH_ENABLED` to `true`. The next release PR you merge is the first CI publish; it validates the npm configurations.

## Release PR checks

Pull requests created with `GITHUB_TOKEN` do not trigger other workflows, so CI does not run on the release PR. Do not make status checks required on the release branch (`release/main`). The PR contains only version bumps, lockfile updates and changelogs; CI has already run on the changes that caused it.
