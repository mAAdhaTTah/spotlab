import {
  COMBOS,
  comboOf,
  handsOfCombo,
  type Hand,
  type HandFrequency,
} from "@spotlab/range";
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

/** A copy of `cells` with `combo`'s cell replaced by `cell`. */
export const withCell = (
  cells: EditorCell[],
  combo: string,
  cell: EditorCell,
): EditorCell[] => {
  const next = cells.slice();
  next[COMBO_INDEX.get(combo)!] = cell;
  return next;
};

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

const cellChanged = (seed: EditorCell, cell: EditorCell): boolean =>
  seed.avail !== cell.avail ||
  seed.weights.length !== cell.weights.length ||
  seed.weights.some((weight, k) => weight !== cell.weights[k]);

/**
 * Turn an edited grid back into one hand-keyed range per action, keeping each
 * action's original hands wherever the editor didn't touch them. `original`
 * holds each action's range in editor action order, `seed` the cells the
 * editor opened with, and `cells` the cells after editing. `avail` is the
 * parent range per hand, as passed (collapsed) to `seedCells`: `null` means
 * unconstrained, and leaving it out takes each hand's weight from its cell's
 * `avail`, which is exact whenever the parent gives every hand of a combo the
 * same weight.
 *
 * A combo whose cell still equals its seed cell (same `avail`, same weights)
 * keeps every action's original hands verbatim, so input the whole-percent grid
 * can't represent — a single suit (`AhKh:0.7`) or a fractional weight
 * (`QQ:0.333`) — survives a save. An action whose original is `null` (e.g. an
 * implicit fold) takes what's left of each hand there: its parent weight minus
 * the preserved originals, never below 0, split across `null` actions by their
 * cell weights. A changed combo is rebuilt from its cell for every action, each
 * hand getting the action's share of its own parent weight.
 *
 * Each rebuilt combo takes its first original hand's place, and combos the
 * original didn't have follow in matrix order, so an unedited range formats
 * back to the string it came from.
 */
export function cellsToRanges(
  original: (HandFrequency[] | null)[],
  seed: EditorCell[],
  cells: EditorCell[],
  avail?: HandFrequency[] | null,
): HandFrequency[][] {
  const parent =
    avail && new Map(avail.map(({ hand, frequency }) => [hand, frequency]));
  const availOf = (hand: Hand, cell: EditorCell) => {
    if (avail === undefined) return cell.avail;
    return parent ? (parent.get(hand) ?? 0) : 1;
  };
  const originals = original.map(
    (hands) =>
      hands && new Map(hands.map(({ hand, frequency }) => [hand, frequency])),
  );
  const preserved = (hand: Hand) =>
    originals.reduce((sum, hands) => sum + (hands?.get(hand) ?? 0), 0);
  const nullActions = original.flatMap((hands, k) => (hands ? [] : [k]));

  const handsWith = (
    combo: string,
    frequencyOf: (hand: Hand) => number,
  ): HandFrequency[] =>
    handsOfCombo(combo).flatMap((hand) => {
      const frequency = Number(frequencyOf(hand).toFixed(FREQUENCY_DIGITS));
      return frequency > 0 ? [{ hand, frequency }] : [];
    });

  const rebuild = (combo: string, k: number): HandFrequency[] => {
    const cell = cells[COMBO_INDEX.get(combo)!];
    const total = cell.weights.reduce((sum, value) => sum + value, 0);
    if (cell.avail <= 0 || !total) return [];
    return handsWith(
      combo,
      (hand) => (cell.weights[k] / total) * availOf(hand, cell),
    );
  };

  const remainder = (combo: string, k: number): HandFrequency[] => {
    const cell = cells[COMBO_INDEX.get(combo)!];
    const nullTotal = nullActions.reduce((sum, j) => sum + cell.weights[j], 0);
    const share = nullTotal
      ? cell.weights[k] / nullTotal
      : 1 / nullActions.length;
    return handsWith(
      combo,
      (hand) => Math.max(0, availOf(hand, cell) - preserved(hand)) * share,
    );
  };

  const changed = new Set(
    COMBOS.filter((_, i) => cellChanged(seed[i], cells[i])),
  );
  return original.map((hands, k) => {
    if (hands === null) {
      return COMBOS.flatMap((combo) =>
        changed.has(combo) ? rebuild(combo, k) : remainder(combo, k),
      );
    }

    const out: HandFrequency[] = [];
    const placed = new Set<string>();
    for (const hand of hands) {
      const combo = comboOf(hand.hand);
      if (!changed.has(combo)) {
        out.push(hand);
      } else if (!placed.has(combo)) {
        placed.add(combo);
        out.push(...rebuild(combo, k));
      }
    }
    for (const combo of changed) {
      if (!placed.has(combo)) out.push(...rebuild(combo, k));
    }
    return out;
  });
}
