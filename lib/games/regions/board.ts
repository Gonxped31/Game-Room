import type { Piece, Variant } from "./constants";

/**
 * A puzzle: an N×N grid split into N regions. The player places N pieces, one
 * per row, per column and per region, and no piece may attack another by its
 * own moves. Cells are numbered row by row: cell = row * size + col.
 */
export interface Puzzle {
  size: number;
  variant: Variant;
  /** Each cell's region (0..size-1), row by row. */
  regions: number[];
  /** The piece each region holds, by region index. */
  pieces: Piece[];
}

export const rowOf = (size: number, cell: number) => Math.floor(cell / size);
export const colOf = (size: number, cell: number) => cell % size;

/** Whether `piece` standing on `from` attacks `to` (rows and columns included, though the one-per-line rule already covers them). */
export function attacks(piece: Piece, size: number, from: number, to: number): boolean {
  if (from === to) return false;
  const dr = Math.abs(rowOf(size, from) - rowOf(size, to));
  const dc = Math.abs(colOf(size, from) - colOf(size, to));
  switch (piece) {
    case "rook":
      return dr === 0 || dc === 0;
    case "king":
      return Math.max(dr, dc) === 1;
    case "knight":
      return (dr === 1 && dc === 2) || (dr === 2 && dc === 1);
    case "bishop":
      return dr === dc;
    case "queen":
      return dr === 0 || dc === 0 || dr === dc;
  }
}

/** The piece a piece placed on `cell` would be: its region's. */
export const pieceAt = (puzzle: Puzzle, cell: number): Piece => puzzle.pieces[puzzle.regions[cell]];

/**
 * Whether pieces on `a` and `b` can't both stand: same row, column or region,
 * or either attacks the other.
 */
export function clashes(puzzle: Puzzle, a: number, b: number): boolean {
  if (a === b) return false;
  const { size, regions } = puzzle;
  if (rowOf(size, a) === rowOf(size, b) || colOf(size, a) === colOf(size, b)) return true;
  if (regions[a] === regions[b]) return true;
  return attacks(pieceAt(puzzle, a), size, a, b) || attacks(pieceAt(puzzle, b), size, b, a);
}

/** For every cell, the cells a piece there rules out. */
export function clashTable(puzzle: Puzzle): number[][] {
  const n = puzzle.size * puzzle.size;
  const table: number[][] = Array.from({ length: n }, () => []);
  for (let a = 0; a < n; a++) {
    for (let b = a + 1; b < n; b++) {
      if (clashes(puzzle, a, b)) {
        table[a].push(b);
        table[b].push(a);
      }
    }
  }
  return table;
}

export interface CheckResult {
  /** Placed cells that clash with another placed cell. */
  bad: number[];
  /** All N pieces placed and none clash. */
  solved: boolean;
}

/** Checks a set of placed pieces against the puzzle's rules. */
export function check(puzzle: Puzzle, placed: readonly number[]): CheckResult {
  const bad = new Set<number>();
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      if (clashes(puzzle, placed[i], placed[j])) {
        bad.add(placed[i]);
        bad.add(placed[j]);
      }
    }
  }
  const unique = new Set(placed).size === placed.length;
  return { bad: [...bad].sort((a, b) => a - b), solved: unique && bad.size === 0 && placed.length === puzzle.size };
}

/** Rows, columns and regions, each as its list of cells. */
export function unitsOf(puzzle: Puzzle): { rows: number[][]; cols: number[][]; regions: number[][] } {
  const { size } = puzzle;
  const rows: number[][] = Array.from({ length: size }, () => []);
  const cols: number[][] = Array.from({ length: size }, () => []);
  const regions: number[][] = Array.from({ length: size }, () => []);
  for (let cell = 0; cell < size * size; cell++) {
    rows[rowOf(size, cell)].push(cell);
    cols[colOf(size, cell)].push(cell);
    regions[puzzle.regions[cell]].push(cell);
  }
  return { rows, cols, regions };
}
