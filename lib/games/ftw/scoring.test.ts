import { describe, expect, it } from "vitest";
import { matchCount } from "./scoring";

const IDS = ["a", "b", "c", "d", "e"];

function permutations<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr];
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const perm of permutations(rest)) {
      result.push([arr[i], ...perm]);
    }
  }
  return result;
}

describe("matchCount", () => {
  it("scores 5 for identical orders", () => {
    expect(matchCount(IDS, [...IDS])).toBe(5);
  });

  it("scores 1 for a fully reversed order (only the middle card matches)", () => {
    expect(matchCount(IDS, [...IDS].reverse())).toBe(1);
  });

  it("scores 3 for one swapped pair", () => {
    const guess = ["b", "a", "c", "d", "e"]; // a and b swapped
    expect(matchCount(IDS, guess)).toBe(3);
  });

  it("scores 0 for a rotation by one position", () => {
    const guess = ["e", "a", "b", "c", "d"];
    expect(matchCount(IDS, guess)).toBe(0);
  });

  it("can never score exactly 4 out of 5, across every permutation", () => {
    for (const perm of permutations(IDS)) {
      expect(matchCount(IDS, perm)).not.toBe(4);
    }
  });
});
