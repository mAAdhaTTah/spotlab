import {
  COMBOS,
  parseRange,
  toComboWeights,
  type HandFrequency,
} from "@spotlab/range";
import type { RangeMatrixProps } from "./range-matrix";

/**
 * `RangeMatrix`'s props for drawing one range: every cell is fully available
 * and filled to its combo's mean weight in `color` (default
 * `var(--spotlab-hm-fill)`), with the rest left blank. The two actions are
 * `in` and `out`, labeled `labels.in` (default "In range") and `labels.out`
 * (default "Out of range") for a legend of your own. Takes a range string or
 * its expanded hand-keyed form; a string is parsed via `@spotlab/range`, so
 * `initRange()` must have resolved. Parsing and collapsing are wasm calls, so
 * memoize the result rather than calling this on every render.
 */
export function rangeToMatrix(
  range: HandFrequency[] | string,
  {
    color = "var(--spotlab-hm-fill)",
    labels = {},
  }: { color?: string; labels?: { in?: string; out?: string } } = {},
): Omit<RangeMatrixProps, "className"> {
  const weights = toComboWeights(
    typeof range === "string" ? parseRange(range) : range,
  );
  return {
    cells: COMBOS.map((combo) => {
      const percent = (weights.get(combo) ?? 0) * 100;
      return { avail: 1, weights: [percent, 100 - percent] };
    }),
    actions: [
      { id: "in", label: labels.in ?? "In range", color },
      {
        id: "out",
        label: labels.out ?? "Out of range",
        color: "transparent",
      },
    ],
    // Only the in-range share is drawn; the out-of-range share stays blank.
    order: [0],
  };
}
