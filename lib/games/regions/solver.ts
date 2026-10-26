import { clashTable, colOf, rowOf, unitsOf, type Puzzle } from "./board";

/**
 * The puzzle's rows, columns and regions as one list of units (rows first,
 * then columns, then regions), plus the three units each cell belongs to.
 */
function layout(puzzle: Puzzle) {
  const { rows, cols, regions } = unitsOf(puzzle);
  const units = [...rows, ...cols, ...regions];
  const { size } = puzzle;
  const unitsOfCell = Array.from({ length: size * size }, (_, cell) => [
    rowOf(size, cell),
    size + colOf(size, cell),
    2 * size + puzzle.regions[cell],
  ]);
  return { units, unitsOfCell, clash: clashTable(puzzle) };
}

/**
 * Every solution (sorted cell lists), stopping once `limit` are found - the
 * generator only needs to know "none, one, or more". Branches on the row,
 * column or region with the fewest open cells.
 */
export function solutions(puzzle: Puzzle, limit = 2): number[][] {
  const { size } = puzzle;
  const { units, unitsOfCell, clash } = layout(puzzle);
  const found: number[][] = [];
  const filled = new Uint8Array(units.length);
  const placed: number[] = [];

  const search = (open: Uint8Array): boolean => {
    if (placed.length === size) {
      found.push([...placed].sort((a, b) => a - b));
      return found.length >= limit;
    }
    let best = -1;
    let bestCount = Infinity;
    for (let u = 0; u < units.length; u++) {
      if (filled[u]) continue;
      let count = 0;
      for (const cell of units[u]) count += open[cell];
      if (count === 0) return false;
      if (count < bestCount) {
        best = u;
        bestCount = count;
      }
    }
    for (const cell of units[best]) {
      if (!open[cell]) continue;
      const next = open.slice();
      next[cell] = 0;
      for (const other of clash[cell]) next[other] = 0;
      for (const u of unitsOfCell[cell]) filled[u] = 1;
      placed.push(cell);
      const done = search(next);
      placed.pop();
      for (const u of unitsOfCell[cell]) filled[u] = 0;
      if (done) return true;
    }
    return false;
  };

  search(new Uint8Array(size * size).fill(1));
  return found;
}

/**
 * The deductions a person makes, cheapest first. The level of the hardest one
 * a puzzle needs is its difficulty.
 * 1. A row, column or region has a single open cell left.
 * 2. A region sits entirely in one row or column (or a row/column's open cells
 *    lie in one region): that line or region's other cells are out.
 * 3. A piece on this cell would leave some row, column or region with no
 *    open cell: the cell is out.
 * 4. Like 2, for 2 or 3 units sharing 2 or 3 lines or regions.
 */
export const LEVELS = { single: 1, confined: 2, wouldBlock: 3, confinedGroup: 4 } as const;

export interface LogicResult {
  /** Solved by deductions alone, without guessing. */
  solved: boolean;
  /** The pieces placed (all of them when solved). */
  placed: number[];
  /** The hardest deduction level the puzzle needed. */
  hardest: number;
  /** A rough effort score: each deduction weighted by its level. */
  effort: number;
}

/** Solves a puzzle the way a person would, never guessing. */
export function solveByLogic(puzzle: Puzzle): LogicResult {
  const { size } = puzzle;
  const { units, unitsOfCell, clash } = layout(puzzle);
  const open = new Uint8Array(size * size).fill(1);
  const filled = new Uint8Array(units.length);
  const placed: number[] = [];
  let hardest = 0;
  let effort = 0;
  const used = (level: number) => {
    hardest = Math.max(hardest, level);
    effort += level;
  };

  const place = (cell: number) => {
    placed.push(cell);
    open[cell] = 0;
    for (const other of clash[cell]) open[other] = 0;
    for (const u of unitsOfCell[cell]) filled[u] = 1;
  };
  const openIn = (u: number) => units[u].filter((cell) => open[cell]);

  // Unit index ranges per kind: rows, columns, regions.
  const kinds = [0, 1, 2].map((k) => Array.from({ length: size }, (_, i) => k * size + i));

  /** Rule 2 (k = 1) or 4 (k = 2, 3): k units of one kind confined to k units of another. */
  const confine = (k: number): boolean => {
    let changed = false;
    for (let a = 0; a < 3; a++) {
      const sources = kinds[a].filter((u) => !filled[u]);
      for (const combo of combinations(sources, k)) {
        const inside = new Set(combo.flatMap(openIn));
        for (let b = 0; b < 3; b++) {
          if (b === a) continue;
          const touched = new Set<number>();
          for (const cell of inside) touched.add(unitsOfCell[cell][b]);
          if (touched.size !== k) continue;
          for (const u of touched) {
            for (const cell of units[u]) {
              if (open[cell] && !inside.has(cell)) {
                open[cell] = 0;
                changed = true;
              }
            }
          }
        }
      }
    }
    return changed;
  };

  for (;;) {
    if (placed.length === size) break;
    const unfilled = units.map((_, u) => u).filter((u) => !filled[u]);
    if (unfilled.some((u) => openIn(u).length === 0)) break; // contradiction: not a valid puzzle

    const single = unfilled.find((u) => openIn(u).length === 1);
    if (single !== undefined) {
      place(openIn(single)[0]);
      used(LEVELS.single);
      continue;
    }
    if (confine(1)) {
      used(LEVELS.confined);
      continue;
    }
    let blocked = false;
    for (let cell = 0; cell < size * size; cell++) {
      if (!open[cell]) continue;
      const gone = new Set([cell, ...clash[cell]]);
      const own = new Set(unitsOfCell[cell]);
      const empties = unfilled.some((u) => !own.has(u) && units[u].every((c) => !open[c] || gone.has(c)));
      if (empties) {
        open[cell] = 0;
        blocked = true;
      }
    }
    if (blocked) {
      used(LEVELS.wouldBlock);
      continue;
    }
    if (confine(2) || confine(3)) {
      used(LEVELS.confinedGroup);
      continue;
    }
    break;
  }
  return { solved: placed.length === size, placed: [...placed].sort((a, b) => a - b), hardest, effort };
}

function* combinations<T>(items: readonly T[], k: number, start = 0, prefix: T[] = []): Generator<T[]> {
  if (prefix.length === k) {
    yield prefix;
    return;
  }
  for (let i = start; i < items.length; i++) yield* combinations(items, k, i + 1, [...prefix, items[i]]);
}
