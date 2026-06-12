export const round = (value: number) => Math.round(value);

const clampWeight = (value: number) => Math.max(0, Math.min(100, round(value)));

export const fixRound = (weights: number[], keep: number): number[] => {
  const fixed = weights.map(round);
  let diff = 100 - fixed.reduce((sum, value) => sum + value, 0);
  if (diff !== 0) {
    for (let k = 0; k < fixed.length; k++) {
      if (k !== keep && fixed[k] + diff >= 0) {
        fixed[k] += diff;
        diff = 0;
        break;
      }
    }
    if (diff !== 0) {
      for (let k = 0; k < fixed.length; k++) {
        if (k !== keep && fixed[k] > 0) {
          const take = Math.min(fixed[k], -diff);
          fixed[k] -= take;
          diff += take;
          if (diff === 0) break;
        }
      }
      fixed[keep] = Math.max(0, fixed[keep] + diff);
    }
  }
  return fixed;
};

export const rebalance = (
  weights: number[],
  index: number,
  value: number,
  passive: number,
): number[] => {
  const target = clampWeight(value);
  const next = weights.slice();
  next[index] = target;
  const rest = 100 - target;
  const others: number[] = [];
  for (let k = 0; k < weights.length; k++) if (k !== index) others.push(k);
  const sumOthers = others.reduce((sum, k) => sum + weights[k], 0);
  if (sumOthers <= 0) {
    others.forEach((k) => (next[k] = 0));
    const fill = index === passive ? others[0] : passive;
    if (fill != null) next[fill] = rest;
  } else {
    others.forEach((k) => (next[k] = round((weights[k] / sumOthers) * rest)));
  }
  return fixRound(next, index);
};

export const sumActive = (weights: number[], passive: number) =>
  weights.reduce((sum, value, k) => (k === passive ? sum : sum + value), 0);
