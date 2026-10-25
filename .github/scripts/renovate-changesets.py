"""Adds a patch changeset for each published package whose shipped dependencies a branch changes.

Compares the dependency tables in MANIFESTS between the branch's merge base and HEAD and runs
`sampo add` once per affected package. Does nothing if the branch already adds a changeset, so a
rerun doesn't duplicate one. Run by .github/workflows/renovate-changesets.yml.

Usage: python3 .github/scripts/renovate-changesets.py <base-ref>
"""

import json
import subprocess
import sys
import tomllib

# manifest -> (dependency table, [(package, kind, deps that don't ship in that package)])
MANIFESTS = {
    "crates/spotlab-range/Cargo.toml": (
        "dependencies",
        [
            ("cargo/spotlab-range", "Rust crate", set()),
            # The wasm build doesn't enable the specta feature.
            ("npm/@spotlab/range", "bundled Rust crate", {"specta", "specta-typescript"}),
        ],
    ),
    "crates/spotlab-range-wasm/Cargo.toml": (
        "dependencies",
        [("npm/@spotlab/range", "bundled Rust crate", set())],
    ),
    "packages/hand-matrix/package.json": (
        "peerDependencies",
        [("npm/@spotlab/hand-matrix", "peer dependency", set())],
    ),
}


def list_join(items):
    return " and ".join(items) if len(items) <= 2 else f"{', '.join(items[:-1])} and {items[-1]}"


def git(*args):
    return subprocess.run(["git", *args], capture_output=True, text=True, check=True).stdout


def dependency_versions(rev, path, table):
    show = subprocess.run(["git", "show", f"{rev}:{path}"], capture_output=True, text=True)
    if show.returncode != 0:
        return {}
    manifest = json.loads(show.stdout) if path.endswith(".json") else tomllib.loads(show.stdout)
    versions = {}
    for dep, spec in manifest.get(table, {}).items():
        # Cargo specs are either a version string or a table; path-only deps have no version.
        version = spec if isinstance(spec, str) else spec.get("version")
        if version is not None:
            versions[dep] = version
    return versions


def main():
    if len(sys.argv) != 2:
        sys.exit("usage: renovate-changesets.py <base-ref>")
    base = git("merge-base", sys.argv[1], "HEAD").strip()

    if git("diff", "--name-only", "--diff-filter=A", base, "HEAD", "--", ".sampo/changesets"):
        print("The branch already adds a changeset")
        return

    # package -> dep -> change; only version changes count, not added or removed deps.
    changes = {}
    for path, (table, packages) in MANIFESTS.items():
        before = dependency_versions(base, path, table)
        after = dependency_versions("HEAD", path, table)
        for dep in sorted(before.keys() & after.keys()):
            if before[dep] == after[dep]:
                continue
            for package, kind, excluded in packages:
                if dep not in excluded:
                    changes.setdefault(package, {})[dep] = (
                        f"{kind} `{dep}` from `{before[dep]}` to `{after[dep]}`"
                    )

    for package, deps in changes.items():
        message = f"Update {list_join(list(deps.values()))}."
        subprocess.run(["sampo", "add", "-p", package, "-b", "patch", "-m", message], check=True)


if __name__ == "__main__":
    main()
