import { HandFrequency, PublicToActNode, RANKS } from "@/tauri/bindings";
import { handsToComboMap, type PaintedCombo } from "./hand-range";
import { round, sumActive } from "./range-weights";

// Stored frequencies are absolute — a share of the whole deck — while `Cell.w` is conditional:
// each action's share of the combo's availability, summing to 100 across the node's actions.
// This module is the only place the two conventions meet.

type BaseAction = { id: string; label: string };
export type EditorAction =
  | (BaseAction & { type: "fold" })
  | (BaseAction & { type: "call" })
  | (BaseAction & { type: "check" })
  | (BaseAction & { type: "raise"; size: number });

export type Cell = { avail: number; w: number[] };

export const isPassive = (action: EditorAction) =>
  action.type === "fold" || action.type === "check";

export const passiveIndex = (actions: EditorAction[]) => {
  const index = actions.findIndex(isPassive);
  return index < 0 ? 0 : index;
};

const comboLabel = (i: number, j: number): string =>
  i === j
    ? RANKS[i] + RANKS[i]
    : j > i
      ? RANKS[i] + RANKS[j] + "s"
      : RANKS[j] + RANKS[i] + "o";

const availFromRange = (
  range: HandFrequency[] | null | undefined,
): Map<string, number> | null => {
  if (!range) return null;
  return handsToComboMap(range);
};

export const seedStrategy = (
  node: PublicToActNode,
  actions: EditorAction[],
): Cell[][] => {
  const passive = passiveIndex(actions);
  const playerRange = node.state.players.find(
    (player) => player.name === node.player,
  )?.range;
  const avail = availFromRange(playerRange);
  const actionRanges = actions.map((action) => {
    const nodeAction = node.actions.find(
      (candidate) => candidate.id === action.id,
    );
    return availFromRange(nodeAction?.range);
  });

  return RANKS.map((_, i) =>
    RANKS.map((__, j) => {
      const combo = comboLabel(i, j);
      const cap = avail ? (avail.get(combo) ?? 0) : 1;
      const w = actions.map(() => 0);
      if (cap <= 0) {
        w[passive] = 100;
        return { avail: 0, w };
      }
      actions.forEach((_action, ai) => {
        const frequency = actionRanges[ai]?.get(combo) ?? 0;
        w[ai] = round((frequency / cap) * 100);
      });
      let active = sumActive(w, passive);
      if (active > 100) {
        const scale = 100 / active;
        for (let k = 0; k < w.length; k++)
          if (k !== passive) w[k] = round(w[k] * scale);
        active = sumActive(w, passive);
      }
      w[passive] = Math.max(0, 100 - active);
      return { avail: cap, w };
    }),
  );
};

// Enough digits that the rounding error stays orders of magnitude below the backend's 1e-6
// validation tolerance even once summed across a node's actions, while still collapsing the
// float noise of the division and multiplication below. Two decimals would not: multiplying by
// a small availability shrinks the value, so a fixed 2-decimal round loses proportionally more
// the more capped the combo is (at avail 0.35 a 30/70 mix quantizes to 0.10/0.24, moving the
// mix to 29.4/70.6). Per-action error is at most 0.5·10⁻ᵈ, so across a node's four actions at
// most 2·10⁻ᵈ: d=6 would give 2e-6, over the tolerance, while d=8 gives 2e-8.
const FREQUENCY_DIGITS = 8;

export const actionRange = (
  strategy: Cell[][],
  index: number,
): PaintedCombo[] => {
  const out: PaintedCombo[] = [];
  for (let i = 0; i < 13; i++) {
    for (let j = 0; j < 13; j++) {
      const cell = strategy[i][j];
      if (cell.avail <= 0) continue;
      const total = cell.w.reduce((sum, value) => sum + value, 0);
      if (!total) continue;
      const frequency = Number(
        ((cell.w[index] / total) * cell.avail).toFixed(FREQUENCY_DIGITS),
      );
      if (!frequency) continue;
      out.push({ combo: comboLabel(i, j), frequency });
    }
  }
  return out;
};

export const ingestRanges = (
  strategy: Cell[][],
  actions: EditorAction[],
  ranges: (HandFrequency[] | null)[],
): Cell[][] => {
  const passive = passiveIndex(actions);
  const comboMaps = ranges.map((range) =>
    range ? handsToComboMap(range) : null,
  );
  return strategy.map((row, i) =>
    row.map((cell, j) => {
      const w = actions.map(() => 0);
      if (cell.avail <= 0) {
        w[passive] = 100;
        return { avail: cell.avail, w };
      }
      const combo = comboLabel(i, j);
      actions.forEach((_action, ai) => {
        const frequency = comboMaps[ai]?.get(combo) ?? 0;
        w[ai] = round((frequency / cell.avail) * 100);
      });
      let active = sumActive(w, passive);
      if (active > 100) {
        const scale = 100 / active;
        for (let k = 0; k < w.length; k++)
          if (k !== passive) w[k] = round(w[k] * scale);
        active = sumActive(w, passive);
      }
      w[passive] = Math.max(0, 100 - active);
      return { avail: cell.avail, w };
    }),
  );
};
