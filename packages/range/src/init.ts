import init from "./wasm/range.js";
import { WASM_BASE64 } from "./wasm/inline.js";
import { RangeInitError, RangeNotInitializedError } from "./errors.js";

function decode(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

let ready: Promise<void> | null = null;
let initialized = false;

/**
 * Instantiate the range wasm module. Idempotent: subsequent calls return the
 * same promise. Retryable after a failure: a rejected `initRange()` clears
 * its memoized promise, so a later call attempts instantiation again rather
 * than re-throwing a cached rejection.
 *
 * Every other function export in this package throws
 * {@link RangeNotInitializedError} until this has resolved. `RANKS`, `SUITS`,
 * and `COMBOS` are static data generated from the Rust crate and need no
 * initialization.
 */
export function initRange(): Promise<void> {
  ready ??= init({ module_or_path: decode(WASM_BASE64) })
    .then(() => {
      initialized = true;
    })
    .catch((cause: unknown) => {
      ready = null;
      throw new RangeInitError("failed to instantiate the range wasm module", {
        cause,
      });
    });
  return ready;
}

/** @internal guard called at the top of every export other than `initRange`. */
export function assertInitialized(fnName: string): void {
  if (!initialized) {
    throw new RangeNotInitializedError(fnName);
  }
}
