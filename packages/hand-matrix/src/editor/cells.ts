import { COMBOS } from "@spotlab/range";
import { sumActive } from "./weights";

export const COMBO_INDEX = new Map(
  COMBOS.map((combo, index) => [combo, index]),
);

/**
 * One matrix cell's painted state: `avail` is the combo's cap (its weight in the
 * parent range the editor is splitting), `weights` are each action's conditional
 * share of that cap, summing to 100 across the node's actions.
 */
export type EditorCell = { avail: number; weights: number[] };

const rescaleOverflow = (weights: number[], passive: number): number[] => {
  const next = weights.slice();
  let active = sumActive(next, passive);
  if (active > 100) {
    const scale = 100 / active;
    for (let k = 0; k < next.length; k++)
      if (k !== passive) next[k] = Math.round(next[k] * scale);
    active = sumActive(next, passive);
  }
  next[passive] = Math.max(0, 100 - active);
  return next;
};

/**
 * Seed the 169-cell grid from a parent range's per-combo availability and each
 * action's own per-combo range, both expressed as absolute weights (a share of
 * the whole deck, as `toComboWeights` from `@spotlab/range` produces). `avail`
 * of `null` means the combo is unconstrained (available at 1). `passive` must be
 * a valid index into `actionWeights` naming the remainder action.
 */
export function seedCells(
  avail: Map<string, number> | null,
  actionWeights: (Map<string, number> | null)[],
  passive: number,
): EditorCell[] {
  return COMBOS.map((combo) => {
    const cap = avail ? (avail.get(combo) ?? 0) : 1;
    const weights = actionWeights.map(() => 0);
    if (cap <= 0) {
      weights[passive] = 100;
      return { avail: 0, weights };
    }
    actionWeights.forEach((range, ai) => {
      const frequency = range?.get(combo) ?? 0;
      weights[ai] = Math.round((frequency / cap) * 100);
    });
    return { avail: cap, weights: rescaleOverflow(weights, passive) };
  });
}

// Enough digits that the rounding error stays orders of magnitude below the backend's 1e-6
// validation tolerance even once summed across a node's actions, while still collapsing the
// float noise of the division and multiplication below. Two decimals would not: multiplying by
// a small availability shrinks the value, so a fixed 2-decimal round loses proportionally more
// the more capped the combo is (at avail 0.35 a 30/70 mix quantizes to 0.10/0.24, moving the
// mix to 29.4/70.6). Per-action error is at most 0.5·10⁻ᵈ, so across a node's four actions at
// most 2·10⁻ᵈ: d=6 would give 2e-6, over the tolerance, while d=8 gives 2e-8.
const FREQUENCY_DIGITS = 8;

/** Collapse one action's conditional weights back to absolute per-combo weights. */
export function cellsToComboWeights(
  cells: EditorCell[],
  actionIndex: number,
): Map<string, number> {
  const out = new Map<string, number>();
  cells.forEach((cell, i) => {
    if (cell.avail <= 0) return;
    const total = cell.weights.reduce((sum, value) => sum + value, 0);
    if (!total) return;
    const frequency = Number(
      ((cell.weights[actionIndex] / total) * cell.avail).toFixed(
        FREQUENCY_DIGITS,
      ),
    );
    if (!frequency) return;
    out.set(COMBOS[i], frequency);
  });
  return out;
}

/**
 * Re-derive conditional cell weights from absolute per-action ranges — the
 * inverse of `cellsToComboWeights`. `passive` must be a valid index into
 * `actionWeights` naming the remainder action.
 */
export function comboWeightsToCells(
  cells: EditorCell[],
  actionWeights: (Map<string, number> | null)[],
  passive: number,
): EditorCell[] {
  return cells.map((cell, i) => {
    const weights = actionWeights.map(() => 0);
    if (cell.avail <= 0) {
      weights[passive] = 100;
      return { avail: cell.avail, weights };
    }
    const combo = COMBOS[i];
    actionWeights.forEach((range, ai) => {
      const frequency = range?.get(combo) ?? 0;
      weights[ai] = Math.round((frequency / cell.avail) * 100);
    });
    return { avail: cell.avail, weights: rescaleOverflow(weights, passive) };
  });
}
