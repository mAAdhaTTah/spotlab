type RawSpotlabInputError =
  | { type: "invalid"; data: string }
  | { type: "frequencyOutOfRange"; data: { combo: string; frequency: number } };

/**
 * The input you gave an `@spotlab/range` export was rejected: a range string
 * failed the grammar, a hand token didn't resolve to a combo, or a frequency
 * fell outside `[0, 1]`. Mirrors the Rust crate's `RangeParseError`,
 * deserialized from the `#[serde(tag = "type", content = "data")]` shape the
 * wasm shim throws across the boundary.
 *
 * This is the shared input-rejection error for `@spotlab` packages — a
 * sibling package (e.g. `@spotlab/hand-matrix`) should reuse this class
 * rather than minting its own.
 *
 * Deliberately not named `RangeError` — that is a JavaScript built-in.
 */
export class SpotlabInputError extends Error {
  readonly name = "SpotlabInputError";
  readonly kind: "invalid" | "frequencyOutOfRange";
  readonly combo?: string;
  readonly frequency?: number;

  private constructor(raw: RawSpotlabInputError) {
    super(
      raw.type === "invalid"
        ? raw.data
        : `Frequency ${raw.data.frequency} for combo ${raw.data.combo} is outside [0, 1]`,
    );
    this.kind = raw.type;
    if (raw.type === "frequencyOutOfRange") {
      this.combo = raw.data.combo;
      this.frequency = raw.data.frequency;
    }
  }

  /**
   * Build a `SpotlabInputError` from whatever the wasm boundary threw. A
   * well-formed `RawSpotlabInputError` (itself the Rust crate's
   * `RangeParseError`, serialized across the boundary) round-trips as-is;
   * anything else (e.g. a raw deserialization failure at the `format_range` /
   * `to_combo_weights` JS-value boundary, which cannot carry the structured
   * Rust error) is wrapped as `kind: "invalid"` with the failure's own
   * message.
   */
  static fromWasm(raw: unknown): SpotlabInputError {
    if (isRawSpotlabInputError(raw)) {
      return new SpotlabInputError(raw);
    }
    const message = raw instanceof Error ? raw.message : String(raw);
    return new SpotlabInputError({ type: "invalid", data: message });
  }
}

function isRawSpotlabInputError(raw: unknown): raw is RawSpotlabInputError {
  return (
    typeof raw === "object" &&
    raw !== null &&
    "type" in raw &&
    (raw.type === "invalid" || raw.type === "frequencyOutOfRange")
  );
}

/**
 * `initRange()` could not instantiate the wasm module — corrupt bytes, no
 * `WebAssembly` global, out of memory. Carries the underlying failure as
 * `cause`. `initRange()` is retryable after this: see its own doc comment.
 */
export class RangeInitError extends Error {
  readonly name = "RangeInitError";
}

/** Thrown when any export other than `initRange` is called before it has resolved. */
export class RangeNotInitializedError extends Error {
  readonly name = "RangeNotInitializedError";

  constructor(fnName: string) {
    super(
      `@spotlab/range: call initRange() and await it before using ${fnName}().`,
    );
  }
}
