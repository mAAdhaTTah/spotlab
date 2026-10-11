import { type CSSProperties, type FC, useMemo } from "react";
import { parseRange, toComboWeights, type HandFrequency } from "@spotlab/range";
import { cellFillGradient, HandMatrix } from "./hand-matrix";

const cellFill = (fill: string, weight: number): CSSProperties => ({
  background: cellFillGradient([
    `${fill} 0 ${weight * 100}%`,
    `transparent ${weight * 100}% 100%`,
  ]),
});

/**
 * A read-only 13x13 range grid: each cell fills to its combo's mean weight.
 * Accepts the expanded hand-keyed form or a range string directly — a range
 * string is parsed via `@spotlab/range`, so the caller never needs to touch
 * the parser itself to render one.
 */
export const RangeGrid: FC<{
  range: HandFrequency[] | string;
  fill?: string;
  className?: string;
}> = ({ range, fill = "var(--spotlab-hm-fill)", className }) => {
  const weights = useMemo(() => {
    const hands = typeof range === "string" ? parseRange(range) : range;
    return toComboWeights(hands);
  }, [range]);

  return (
    <HandMatrix
      className={className}
      comboStyle={(combo) => {
        const weight = weights.get(combo);
        return weight ? cellFill(fill, weight) : {};
      }}
    />
  );
};
