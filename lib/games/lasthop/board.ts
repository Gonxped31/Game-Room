import type { Mode } from "./constants";

/**
 * Last Hop's board: `cells` is a row-major string, `w` by `h`, of "A", "B"
 * and "." (empty). A moves right or down, B moves left or up (a Track has
 * one row, so only right and left). A move slides one square into an empty
 * one, or jumps exactly one opposing piece into the empty square behind it.
 * Whoever has no move on their turn loses.
 */

export type Colour = "A" | "B";

export interface Board {
  w: number;
  h: number;
  cells: string;
}

export interface Move {
  from: number;
  to: number;
  jump: boolean;
}

const DIRS: Record<Colour, [number, number][]> = {
  A: [
    [1, 0],
    [0, 1],
  ],
  B: [
    [-1, 0],
    [0, -1],
  ],
};

export function opponent(colour: Colour): Colour {
  return colour === "A" ? "B" : "A";
}

function cellAt(board: Board, x: number, y: number): string {
  return x < 0 || y < 0 || x >= board.w || y >= board.h ? "#" : board.cells[y * board.w + x];
}

/** Every legal move for `colour`, in board order. */
export function legalMoves(board: Board, colour: Colour): Move[] {
  const moves: Move[] = [];
  const other = opponent(colour);
  for (let i = 0; i < board.cells.length; i++) {
    if (board.cells[i] !== colour) continue;
    const x = i % board.w;
    const y = Math.floor(i / board.w);
    for (const [dx, dy] of DIRS[colour]) {
      const next = cellAt(board, x + dx, y + dy);
      if (next === ".") moves.push({ from: i, to: (y + dy) * board.w + x + dx, jump: false });
      else if (next === other && cellAt(board, x + 2 * dx, y + 2 * dy) === ".") {
        moves.push({ from: i, to: (y + 2 * dy) * board.w + x + 2 * dx, jump: true });
      }
    }
  }
  return moves;
}

/** The legal move from `from` to `to` for `colour`, if there is one. */
export function findMove(board: Board, colour: Colour, from: number, to: number): Move | undefined {
  return legalMoves(board, colour).find((m) => m.from === from && m.to === to);
}

export function applyMove(board: Board, move: Move): Board {
  const cells = board.cells.split("");
  cells[move.to] = cells[move.from];
  cells[move.from] = ".";
  return { ...board, cells: cells.join("") };
}

/** The board turned half a turn with the colours swapped: what B sees as A. */
export function mirrored(board: Board): Board {
  const swap: Record<string, string> = { A: "B", B: "A", ".": "." };
  return { ...board, cells: [...board.cells].reverse().map((c) => swap[c]).join("") };
}

/**
 * Perfect play from a position, for boards small enough to search whole
 * (a Track): whether `toMove` wins, and the game's length when the winner
 * finishes fastest and the loser holds out longest.
 */
export function solve(board: Board, toMove: Colour, memo = new Map<string, [boolean, number]>()): [boolean, number] {
  const key = board.cells + toMove;
  const known = memo.get(key);
  if (known) return known;
  const moves = legalMoves(board, toMove);
  let result: [boolean, number];
  if (moves.length === 0) result = [false, 0];
  else {
    const after = moves.map((m) => solve(applyMove(board, m), opponent(toMove), memo));
    const winning = after.filter(([wins]) => !wins);
    result = winning.length
      ? [true, 1 + Math.min(...winning.map(([, n]) => n))]
      : [false, 1 + Math.max(...after.map(([, n]) => n))];
  }
  memo.set(key, result);
  return result;
}

/** Shortest perfect-play game a generated Track may have, so a round is never over in a few moves. */
export const MIN_TRACK_LENGTH = 12;
/** Fewest moves a random game on a generated Grid must average. */
export const MIN_GRID_PLAYOUT = 20;

/**
 * A fresh board for a round. Boards are never their own mirror image: on one
 * that is, the second player can copy every move turned half a turn and win
 * (each board is played twice instead, with the players swapping sides).
 * `avoid` is a board's cells not to deal again.
 */
export function generateBoard(mode: Mode, random: () => number, avoid?: string): Board {
  for (let tries = 0; tries < 500; tries++) {
    const board = mode === "track" ? randomTrack(random) : randomGrid(random);
    // `avoid`: the board just played, so a new pair never repeats it (Tracks are a small space).
    if (board.cells !== avoid && playable(board, mode, random)) return board;
  }
  return FALLBACK[mode];
}

/** Known good boards, in case 500 random tries all fail (never seen in the tests). */
export const FALLBACK: Record<Mode, Board> = {
  track: { w: 10, h: 1, cells: "AA.A..BB.B" },
  grid: { w: 4, h: 4, cells: "AAA.A.....BB..BB" },
};

export function playable(board: Board, mode: Mode, random: () => number): boolean {
  if (board.cells === mirrored(board).cells) return false;
  if (legalMoves(board, "A").length === 0 || legalMoves(board, "B").length === 0) return false;
  if (mode === "track") {
    const memo = new Map<string, [boolean, number]>();
    return solve(board, "A", memo)[1] >= MIN_TRACK_LENGTH && solve(board, "B", memo)[1] >= MIN_TRACK_LENGTH;
  }
  let total = 0;
  const runs = 20;
  for (let i = 0; i < runs; i++) total += randomPlayout(board, random);
  return total / runs >= MIN_GRID_PLAYOUT;
}

/** How many moves a game lasts when both sides play at random. */
export function randomPlayout(board: Board, random: () => number): number {
  let current = board;
  let colour: Colour = "A";
  for (let n = 0; ; n++) {
    const moves = legalMoves(current, colour);
    if (moves.length === 0) return n;
    current = applyMove(current, moves[Math.floor(random() * moves.length)]);
    colour = opponent(colour);
  }
}

function randomInt(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

/** Picks `count` distinct items. */
function sample<T>(items: T[], count: number, random: () => number): T[] {
  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

/** 8-11 squares, 3-4 pieces a side with every A left of every B, and at least 2 empty squares. */
function randomTrack(random: () => number): Board {
  const w = randomInt(random, 8, 11);
  const pieces = w >= 10 ? randomInt(random, 3, 4) : 3;
  const squares = Array.from({ length: w }, (_, i) => i);
  const taken = sample(squares, pieces * 2, random).sort((a, b) => a - b);
  const cells = squares.map(() => ".");
  taken.forEach((square, i) => (cells[square] = i < pieces ? "A" : "B"));
  return { w, h: 1, cells: cells.join("") };
}

/** 4x4 or 5x5, A in the top-left corner and B in the bottom-right. */
function randomGrid(random: () => number): Board {
  const size = random() < 0.5 ? 4 : 5;
  const corner = size === 4 ? 2 : 3;
  const pieces = size === 4 ? randomInt(random, 3, 4) : randomInt(random, 4, 6);
  const squares = Array.from({ length: size * size }, (_, i) => i);
  const diagonal = (i: number) => (i % size) + Math.floor(i / size);
  const aSquares = sample(squares.filter((i) => diagonal(i) <= corner), pieces, random);
  const bSquares = sample(squares.filter((i) => diagonal(i) >= 2 * (size - 1) - corner), pieces, random);
  const cells = squares.map(() => ".");
  for (const i of aSquares) cells[i] = "A";
  for (const i of bSquares) cells[i] = "B";
  return { w: size, h: size, cells: cells.join("") };
}
