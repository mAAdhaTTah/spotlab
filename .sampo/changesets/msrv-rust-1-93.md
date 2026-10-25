---
cargo/spotlab-range: patch
---

Declare a minimum supported Rust version (MSRV) of 1.93 via `rust-version`, covering every feature. Cargo now reports a clear error on older toolchains instead of failing partway through the build.
