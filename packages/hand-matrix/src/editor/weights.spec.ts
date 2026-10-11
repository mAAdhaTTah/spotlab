import { fixRound } from "./weights";
import { describe, expect, it } from "vitest";

describe("fixRound", () => {
  it("returns weights unchanged when they already sum to 100", () => {
    expect(fixRound([50, 25, 25], 0)).toEqual([50, 25, 25]);
  });

  it("adjusts a non-keep slot to correct rounding drift (diff > 0, first-loop path)", () => {
    // Real weights arrive as decimals after rebalance; round(33.4)+round(33.3)+round(33.3)=99, diff=+1, first non-keep slot absorbs +1.
    const result = fixRound([33.4, 33.3, 33.3], 0);
    expect(result.reduce((sum, v) => sum + v, 0)).toBe(100);
    expect(result.every((v) => v >= 0)).toBe(true);
  });

  it("keep absorbs diff when all non-keep slots are 0 (second-loop path, keep-is-last-resort)", () => {
    // Real weights arrive as decimals after rebalance; round(0)+round(0)+round(100.6)=101, diff=-1; non-keep slots are 0 so first loop skips them, second loop finds nothing to drain, keep absorbs the -1.
    const result = fixRound([0, 0, 100.6], 2);
    expect(result).toEqual([0, 0, 100]);
    expect(result.reduce((sum, v) => sum + v, 0)).toBe(100);
    expect(result.every((v) => v >= 0)).toBe(true);
  });

  it("drains one non-keep slot then keep absorbs residual (second-loop path, partial drain)", () => {
    // Real weights arrive as decimals after rebalance; round(1)+round(0)+round(100.6)=102, diff=-2; first loop: 1+(-2)<0 skip, 0+(-2)<0 skip; second loop drains slot 0 by 1 (diff→-1), slot 1 is 0 so skipped; keep absorbs remaining -1.
    const result = fixRound([1, 0, 100.6], 2);
    expect(result).toEqual([0, 0, 100]);
    expect(result.reduce((sum, v) => sum + v, 0)).toBe(100);
    expect(result.every((v) => v >= 0)).toBe(true);
  });

  it("drains multiple non-keep slots then keep absorbs residual (second-loop path, multi-drain)", () => {
    // Real weights arrive as decimals after rebalance; round(0.6)+round(0.6)+round(100.6)=103, diff=-3; first loop: both non-keep slots fail (1+(-3)<0); second loop drains slot 0 by 1 (diff→-2), slot 1 by 1 (diff→-1); keep absorbs remaining -1.
    const result = fixRound([0.6, 0.6, 100.6], 2);
    expect(result).toEqual([0, 0, 100]);
    expect(result.reduce((sum, v) => sum + v, 0)).toBe(100);
    expect(result.every((v) => v >= 0)).toBe(true);
  });
});
