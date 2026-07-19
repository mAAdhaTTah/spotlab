import { type CSSProperties, type FC, useMemo } from "react";
import { HandMatrix } from "@/components/hand-matrix";
import type { HandFrequency } from "@/tauri/bindings";
import { aggregateHandRange } from "./service";

const FILL_COLOR = "var(--color-emerald-500)";

// Fill the cell from the bottom in proportion to the combo's aggregate weight, PioSOLVER-style.
const cellFill = (weight: number): CSSProperties => ({
  background: `linear-gradient(to top, ${FILL_COLOR} 0 ${weight * 100}%, transparent ${weight * 100}% 100%)`,
});

// A read-only 13×13 range grid: each cell fills to its combo's aggregate weight. The aggregate is a
// lossy display projection over the hand-level `HandFrequency` data (see `aggregateHandRange`).
export const RangeGrid: FC<{ range: HandFrequency[]; className?: string }> = ({
  range,
  className,
}) => {
  const aggregates = useMemo(() => aggregateHandRange(range), [range]);

  return (
    <div className={className}>
      <HandMatrix
        className="select-none overflow-hidden rounded-lg border border-border"
        comboStyle={(combo) => {
          const aggregate = aggregates.get(combo);
          return aggregate ? cellFill(aggregate.weight) : {};
        }}
      />
    </div>
  );
};
