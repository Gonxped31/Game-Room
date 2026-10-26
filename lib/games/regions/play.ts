import { check, clashTable, type CheckResult, type Puzzle } from "./board";

/** What the player put on a cell: nothing, a ✕ note, or a piece. */
export const EMPTY = 0;
export const MARK = 1;
export const PIECE = 2;
export type Mark = typeof EMPTY | typeof MARK | typeof PIECE;

/**
 * One tap's result, in the order played: the cell, what it became, and when
 * (ms since the puzzle started). The daily routes replay these to check a
 * solve (lib/daily/), so they are the whole record of a game.
 */
export interface Move {
  cell: number;
  to: Mark;
  t: number;
}

/** A game in progress: the puzzle, every cell's mark, and the moves so far (for undo and the daily check). */
export interface Play {
  puzzle: Puzzle;
  marks: Mark[];
  moves: Move[];
}

export function newPlay(puzzle: Puzzle): Play {
  return { puzzle, marks: new Array<Mark>(puzzle.size * puzzle.size).fill(EMPTY), moves: [] };
}

/** A tap cycles a cell: empty → ✕ → piece → empty. */
export const nextMark = (mark: Mark): Mark => ((mark + 1) % 3) as Mark;

/** Sets one cell. Throws once the puzzle is solved (nothing more to play) or for a cell off the grid. */
export function setMark(play: Play, cell: number, to: Mark, t: number): Play {
  if (!Number.isInteger(cell) || cell < 0 || cell >= play.marks.length) throw new Error(`No cell ${cell}`);
  if (status(play).solved) throw new Error("Already solved");
  if (play.marks[cell] === to) return play;
  const marks = play.marks.slice();
  marks[cell] = to;
  return { ...play, marks, moves: [...play.moves, { cell, to, t }] };
}

/** Takes back the last move (the cell goes back to what it was before it). Throws with nothing to undo or once solved. */
export function undo(play: Play): Play {
  if (play.moves.length === 0) throw new Error("Nothing to undo");
  if (status(play).solved) throw new Error("Already solved");
  return replay(play.puzzle, play.moves.slice(0, -1));
}

/** Clears the board, keeping the moves log (a clear is a move per cell). Throws once solved. */
export function clearAll(play: Play, t: number): Play {
  let next = play;
  play.marks.forEach((mark, cell) => {
    if (mark !== EMPTY) next = setMark(next, cell, EMPTY, t);
  });
  return next;
}

/** Rebuilds a game from its moves. Throws on a move a player couldn't have made. */
export function replay(puzzle: Puzzle, moves: readonly Move[]): Play {
  let play = newPlay(puzzle);
  let last = 0;
  for (const move of moves) {
    if (![EMPTY, MARK, PIECE].includes(move.to)) throw new Error("Bad mark");
    if (!Number.isFinite(move.t) || move.t < last) throw new Error("Moves out of order");
    last = move.t;
    if (play.marks[move.cell] === move.to) throw new Error("A move that changes nothing");
    play = setMark(play, move.cell, move.to, move.t);
  }
  return play;
}

export const piecesOf = (marks: readonly Mark[]) => marks.flatMap((mark, cell) => (mark === PIECE ? [cell] : []));

export function status(play: Play): CheckResult {
  return check(play.puzzle, piecesOf(play.marks));
}

/**
 * The cells the placed pieces rule out (their rows, columns, regions and the
 * cells they attack): drawn as ✕ when the player turns auto-✕ on, without
 * being marks of their own.
 */
export function ruledOut(play: Play): Set<number> {
  const table = clashTable(play.puzzle);
  const out = new Set<number>();
  for (const cell of piecesOf(play.marks)) for (const other of table[cell]) out.add(other);
  return out;
}
