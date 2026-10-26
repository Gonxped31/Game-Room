import { attacks, colOf, rowOf, type Puzzle } from "./board";
import { MIX_PIECES, type Piece, type Variant } from "./constants";
import { solutions, solveByLogic } from "./solver";

export interface GenerateOptions {
  size: number;
  variant: Variant;
  /** The hardest deduction level allowed (see LEVELS in solver.ts); 4 by default. */
  maxLevel?: number;
  /** The easiest a puzzle may be: its hardest deduction must reach this level. 1 by default. */
  minLevel?: number;
}

export interface Generated {
  puzzle: Puzzle;
  /** The one solution, sorted. */
  solution: number[];
  /** The hardest deduction level it needs, and its effort score (solver.ts). */
  hardest: number;
  effort: number;
}

const ATTEMPTS = 300;
const REPAIRS = 80;
const TWEAKS = 40;

/**
 * A puzzle with exactly one solution, solvable without guessing. The same
 * seed and options always give the same puzzle, on every device and the
 * server alike.
 *
 * 1. Place one piece per row and column that don't attack each other.
 * 2. Grow a region from each piece until every cell has one.
 * 3. While a second solution exists, move one of its cells into a neighbouring
 *    region: that breaks it, and the first solution keeps holding.
 * 4. Keep it once the step-by-step solver finishes it within the level range.
 */
export function generate(seed: string, options: GenerateOptions): Generated {
  const { size, variant } = options;
  const maxLevel = options.maxLevel ?? 4;
  const minLevel = options.minLevel ?? 1;
  const random = seededRandom(hashSeed(`${seed}|${variant}|${size}`));

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const pieces = piecesFor(variant, size, random);
    const solution = placePieces(size, pieces, random);
    if (!solution) continue;
    const regions = growRegions(size, solution, random);
    const puzzle: Puzzle = { size, variant, regions, pieces };
    const sorted = [...solution].sort((a, b) => a - b);

    if (!makeUnique(puzzle, sorted, random)) continue;
    for (let tweak = 0; tweak <= TWEAKS; tweak++) {
      const logic = solveByLogic(puzzle);
      if (logic.solved && logic.hardest <= maxLevel) {
        if (logic.hardest < minLevel) break;
        return { puzzle: relabel(puzzle), solution: sorted, hardest: logic.hardest, effort: logic.effort };
      }
      // Reshape one border cell and try again, as long as the solution stays the only one.
      const saved = puzzle.regions.slice();
      if (!moveCell(puzzle, sorted, shuffled(nonSolutionCells(size, sorted), random), random) || !isUnique(puzzle, sorted)) {
        puzzle.regions = saved;
      }
    }
  }
  throw new Error(`No ${variant} puzzle of size ${size} found for seed ${seed}`);
}

/** Each region's piece: the variant's own, or a mix with at least three kinds. */
function piecesFor(variant: Variant, size: number, random: () => number): Piece[] {
  if (variant !== "mix") return Array.from({ length: size }, () => variant);
  for (;;) {
    const pieces = Array.from({ length: size }, () => MIX_PIECES[Math.floor(random() * MIX_PIECES.length)]);
    if (new Set(pieces).size >= Math.min(3, MIX_PIECES.length)) return pieces;
  }
}

/**
 * One cell per row, in distinct columns, none attacking another: row r holds
 * region r's piece (`pieces[r]`) until `relabel` shuffles the region numbers.
 */
function placePieces(size: number, pieces: Piece[], random: () => number): number[] | null {
  const cells: number[] = [];
  const usedCols = new Set<number>();
  const fits = (cell: number, row: number) =>
    cells.every(
      (other, r) => !attacks(pieces[row], size, cell, other) && !attacks(pieces[r], size, other, cell),
    );
  const place = (row: number): boolean => {
    if (row === size) return true;
    for (const col of shuffled(range(size), random)) {
      if (usedCols.has(col)) continue;
      const cell = row * size + col;
      if (!fits(cell, row)) continue;
      cells.push(cell);
      usedCols.add(col);
      if (place(row + 1)) return true;
      cells.pop();
      usedCols.delete(col);
    }
    return false;
  };
  return place(0) ? cells : null;
}

/**
 * Grows region r from `seeds[r]` until the grid is covered: each step, a
 * region that can still grow takes one random free neighbouring cell. Smaller
 * regions are picked more often (weight 1/size²), so sizes stay mixed without
 * one region swallowing the board.
 */
function growRegions(size: number, seeds: number[], random: () => number): number[] {
  const regions = new Array<number>(size * size).fill(-1);
  const sizes = seeds.map(() => 1);
  seeds.forEach((cell, r) => (regions[cell] = r));
  let left = size * size - seeds.length;
  while (left > 0) {
    const frontier: number[][] = seeds.map(() => []);
    for (let cell = 0; cell < regions.length; cell++) {
      if (regions[cell] !== -1) continue;
      for (const r of new Set(neighbours(size, cell).map((n) => regions[n]))) if (r !== -1) frontier[r].push(cell);
    }
    const weights = frontier.map((cells, r) => (cells.length ? 1 / (sizes[r] * sizes[r]) : 0));
    let pick = random() * weights.reduce((a, b) => a + b, 0);
    let region = weights.findIndex((w) => (pick -= w) < 0);
    if (region === -1) region = weights.findLastIndex((w) => w > 0);
    const cells = frontier[region];
    regions[cells[Math.floor(random() * cells.length)]] = region;
    sizes[region]++;
    left--;
  }
  return regions;
}

/** Breaks every other solution in turn; false if one can't be broken. */
function makeUnique(puzzle: Puzzle, solution: number[], random: () => number): boolean {
  for (let repair = 0; repair < REPAIRS; repair++) {
    const found = solutions(puzzle, 2);
    const other = found.find((s) => !sameCells(s, solution));
    if (!other) return true;
    // A cell of the other solution that isn't one of ours: moving it into a neighbouring region puts two of
    // that solution's pieces in one region (and none in another), while ours stays valid.
    const mine = new Set(solution);
    const candidates = shuffled(
      other.filter((cell) => !mine.has(cell)),
      random,
    );
    if (!moveCell(puzzle, solution, candidates, random)) return false;
  }
  return false;
}

/** Moves the first movable candidate into a random neighbouring region; false if none can move. */
function moveCell(puzzle: Puzzle, solution: number[], candidates: number[], random: () => number): boolean {
  const { size, regions } = puzzle;
  const seeds = new Set(solution);
  for (const cell of candidates) {
    if (seeds.has(cell)) continue;
    const from = regions[cell];
    const targets = [...new Set(neighbours(size, cell).map((n) => regions[n]))].filter((r) => r !== from);
    if (targets.length === 0 || !staysConnected(puzzle, cell)) continue;
    regions[cell] = targets[Math.floor(random() * targets.length)];
    return true;
  }
  return false;
}

/** Whether `cell`'s region stays in one piece without it. */
function staysConnected(puzzle: Puzzle, cell: number): boolean {
  const { size, regions } = puzzle;
  const region = regions[cell];
  const rest: number[] = [];
  for (let c = 0; c < regions.length; c++) if (c !== cell && regions[c] === region) rest.push(c);
  if (rest.length === 0) return false;
  const seen = new Set([rest[0]]);
  const queue = [rest[0]];
  while (queue.length) {
    const at = queue.pop()!;
    for (const n of neighbours(size, at)) {
      if (n !== cell && regions[n] === region && !seen.has(n)) {
        seen.add(n);
        queue.push(n);
      }
    }
  }
  return seen.size === rest.length;
}

function isUnique(puzzle: Puzzle, solution: number[]): boolean {
  const found = solutions(puzzle, 2);
  return found.length === 1 && sameCells(found[0], solution);
}

/**
 * Renumbers the regions in reading order of their first cell, so a region's
 * number says nothing about where its piece goes. Pieces follow their region.
 */
function relabel(puzzle: Puzzle): Puzzle {
  const order = new Map<number, number>();
  for (const r of puzzle.regions) if (!order.has(r)) order.set(r, order.size);
  const regions = puzzle.regions.map((r) => order.get(r)!);
  const pieces = new Array<Piece>(puzzle.size);
  for (const [old, now] of order) pieces[now] = puzzle.pieces[old];
  return { ...puzzle, regions, pieces };
}

function nonSolutionCells(size: number, solution: number[]): number[] {
  const mine = new Set(solution);
  return range(size * size).filter((cell) => !mine.has(cell));
}

function neighbours(size: number, cell: number): number[] {
  const r = rowOf(size, cell);
  const c = colOf(size, cell);
  const out: number[] = [];
  if (r > 0) out.push(cell - size);
  if (r < size - 1) out.push(cell + size);
  if (c > 0) out.push(cell - 1);
  if (c < size - 1) out.push(cell + 1);
  return out;
}

const sameCells = (a: number[], b: number[]) => a.length === b.length && a.every((cell, i) => cell === b[i]);
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

function shuffled<T>(items: T[], random: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** FNV-1a: a string seed as a 32-bit integer. */
export function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32: a small seeded generator built only on integer ops, so it's identical in every engine. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
