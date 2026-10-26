import { describe, expect, it } from "vitest";
import { attacks, check, rowOf, colOf, type Puzzle } from "./board";
import { VARIANTS, MIN_SIZE, MAX_SIZE } from "./constants";
import { generate } from "./generate";
import { solutions, solveByLogic } from "./solver";

// On a 5x5 grid, cell 12 is the centre (row 2, col 2).
const C = 12;
const at = (r: number, c: number) => r * 5 + c;

describe("attacks", () => {
  it("king: the 8 touching cells only", () => {
    expect(attacks("king", 5, C, at(1, 1))).toBe(true);
    expect(attacks("king", 5, C, at(2, 3))).toBe(true);
    expect(attacks("king", 5, C, at(0, 0))).toBe(false);
    expect(attacks("king", 5, C, at(0, 1))).toBe(false);
  });
  it("knight: L moves only", () => {
    expect(attacks("knight", 5, C, at(0, 1))).toBe(true);
    expect(attacks("knight", 5, C, at(3, 4))).toBe(true);
    expect(attacks("knight", 5, C, at(1, 1))).toBe(false);
    expect(attacks("knight", 5, C, at(0, 0))).toBe(false);
  });
  it("bishop: diagonals at any distance, not lines", () => {
    expect(attacks("bishop", 5, C, at(0, 0))).toBe(true);
    expect(attacks("bishop", 5, C, at(4, 0))).toBe(true);
    expect(attacks("bishop", 5, C, at(2, 0))).toBe(false);
  });
  it("rook and queen include rows and columns", () => {
    expect(attacks("rook", 5, C, at(2, 0))).toBe(true);
    expect(attacks("rook", 5, C, at(0, 0))).toBe(false);
    expect(attacks("queen", 5, C, at(0, 2))).toBe(true);
    expect(attacks("queen", 5, C, at(4, 4))).toBe(true);
    expect(attacks("queen", 5, C, at(0, 1))).toBe(false);
  });
  it("a piece never attacks its own cell", () => {
    expect(attacks("queen", 5, C, C)).toBe(false);
  });
});

describe("check", () => {
  // 4x4, regions are the rows: rook rules leave only the row/column/region constraints.
  const rows: Puzzle = {
    size: 4,
    variant: "rook",
    regions: [0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3],
    pieces: ["rook", "rook", "rook", "rook"],
  };
  it("solves a full non-clashing placement", () => {
    expect(check(rows, [0, 5, 10, 15])).toEqual({ bad: [], solved: true });
  });
  it("flags both cells of a clash and isn't solved", () => {
    expect(check(rows, [0, 4, 10, 15])).toEqual({ bad: [0, 4], solved: false });
  });
  it("an incomplete placement isn't solved", () => {
    expect(check(rows, [0, 5]).solved).toBe(false);
  });
  it("a king on the next diagonal clashes", () => {
    const kings: Puzzle = { ...rows, variant: "king", pieces: ["king", "king", "king", "king"] };
    expect(check(kings, [0, 5, 10, 15]).bad).toEqual([0, 5, 10, 15]);
  });
});

describe("generate", () => {
  it("is deterministic: the same seed gives the same puzzle", () => {
    const a = generate("2026-10-25", { size: 7, variant: "knight" });
    const b = generate("2026-10-25", { size: 7, variant: "knight" });
    expect(b).toEqual(a);
    expect(generate("2026-10-26", { size: 7, variant: "knight" }).puzzle.regions).not.toEqual(a.puzzle.regions);
  });

  for (const variant of VARIANTS) {
    for (let size = MIN_SIZE; size <= MAX_SIZE; size++) {
      it(`${variant} ${size}x${size}: one solution, found without guessing`, () => {
        const { puzzle, solution, hardest } = generate(`test-${variant}-${size}`, { size, variant });
        expect(puzzle.regions).toHaveLength(size * size);
        expect(puzzle.pieces).toHaveLength(size);
        expect(new Set(puzzle.regions).size).toBe(size);
        expect(solutions(puzzle, 3)).toEqual([solution]);
        expect(check(puzzle, solution).solved).toBe(true);
        const logic = solveByLogic(puzzle);
        expect(logic.solved).toBe(true);
        expect(logic.placed).toEqual(solution);
        expect(logic.hardest).toBe(hardest);
        expectConnectedRegions(puzzle);
        // Regions are numbered by their first cell in reading order, so the numbers give nothing away.
        const firsts = [...new Set(puzzle.regions)];
        expect(firsts).toEqual([...firsts].sort((a, b) => a - b));
        if (variant === "mix") expect(new Set(puzzle.pieces).size).toBeGreaterThanOrEqual(3);
        else expect(new Set(puzzle.pieces)).toEqual(new Set([variant]));
      });
    }
  }

  it("keeps to the level range it's given", () => {
    const easy = generate("range", { size: 6, variant: "rook", maxLevel: 2 });
    expect(easy.hardest).toBeLessThanOrEqual(2);
    const hard = generate("range", { size: 7, variant: "king", minLevel: 3 });
    expect(hard.hardest).toBeGreaterThanOrEqual(3);
  });
});

function expectConnectedRegions(puzzle: Puzzle) {
  const { size, regions } = puzzle;
  for (let r = 0; r < size; r++) {
    const cells = regions.flatMap((reg, cell) => (reg === r ? [cell] : []));
    const seen = new Set([cells[0]]);
    const queue = [cells[0]];
    while (queue.length) {
      const cell = queue.pop()!;
      for (const n of cells) {
        const near = Math.abs(rowOf(size, n) - rowOf(size, cell)) + Math.abs(colOf(size, n) - colOf(size, cell)) === 1;
        if (near && !seen.has(n)) {
          seen.add(n);
          queue.push(n);
        }
      }
    }
    expect(seen.size, `region ${r} is in one piece`).toBe(cells.length);
  }
}
