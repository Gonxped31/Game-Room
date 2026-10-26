import { createRace, normalizeCore, type Mode, type RaceCore, type RoundScore, type RunCore, type Runs as RaceRuns } from "@/lib/games/race/race";
import type { Puzzle } from "./board";
import { VARIANTS, type Variant } from "./constants";
import { generate, type Generated } from "./generate";
import { EMPTY, MARK, newPlay, PIECE, piecesOf, setMark, status, type Move, type Play } from "./play";

/**
 * Checkmate Grid with others (`/regions/race#room`): everyone solves the same
 * puzzle at the same moment, round after round, in Challenge or Survival
 * (lib/games/race/race.ts). The state holds only the round's seed: every
 * device builds the puzzle from it (`generate` is the same in every engine).
 * Each player's moves go to `regionsRuns/{seat}`.
 */

/** A piece for every round, or "mixed": rook, king, knight, queen, then mix, in turn. */
export type PieceChoice = Variant | "mixed";
export const PIECE_CHOICES: readonly PieceChoice[] = ["mixed", ...VARIANTS];
export const MIXED: readonly Variant[] = ["rook", "king", "knight", "queen", "mix"];

/** A round's time limit. */
export const ROUND_MS = 180_000;
/** The most moves one player may send in a round (the rules check the same). */
export const MAX_MOVES = 1000;

export interface GridRaceState extends RaceCore {
  pieces: PieceChoice;
  /** The round's puzzle seed; "" in the lobby. */
  seed: string;
}

/** One player's moves this round (every tap, ✕ included), as they send them; `t` is ms after the round's start, by the server's clock. */
export interface Run extends RunCore {
  moves: Move[];
}

export type Runs = RaceRuns<Run>;

export function newRace(mode: Mode): GridRaceState {
  return { names: {}, phase: "lobby", mode, pieces: "mixed", rounds: 3, players: [], alive: [], round: 0, seed: "", startsAt: 0, endsAt: 0, nextAt: 0, results: [] };
}

export const normalize = (state: GridRaceState): GridRaceState => {
  const current = normalizeCore(state);
  return { ...current, pieces: current.pieces ?? "mixed", seed: current.seed ?? "" };
};

export const normalizeRun = (run: Partial<Run> | null | undefined): Run => ({ at: run?.at ?? 0, moves: run?.moves ?? [], gaveUp: run?.gaveUp ?? false });

export function setPieces(state: GridRaceState, pieces: PieceChoice): GridRaceState {
  if (state.phase !== "lobby") throw new Error("Only in the lobby.");
  if (!PIECE_CHOICES.includes(pieces)) throw new Error("No such piece.");
  return { ...normalize(state), pieces };
}

/** A round's puzzle: its piece, a grid growing from 6×6 by one every two rounds (up to 9×9), and harder from the third round. */
export function roundSpec(pieces: PieceChoice, round: number): { variant: Variant; size: number; minLevel: number } {
  const variant = pieces === "mixed" ? MIXED[round % MIXED.length] : pieces;
  return { variant, size: Math.min(6 + Math.floor(round / 2), 9), minLevel: round < 2 || variant === "rook" ? 1 : 2 };
}

const built = new Map<string, Generated>();

/** The round's puzzle and its solution, built once per device (a 9×9 can take half a second). */
export function puzzleOf(state: Pick<GridRaceState, "pieces" | "round" | "seed">): Generated {
  const spec = roundSpec(state.pieces, state.round);
  const key = `${state.seed}|${spec.variant}|${spec.size}|${spec.minLevel}`;
  let found = built.get(key);
  if (!found) {
    try {
      found = generate(state.seed, spec);
    } catch {
      // No puzzle that hard from this seed: any level will do, the same on every device.
      found = generate(state.seed, { variant: spec.variant, size: spec.size });
    }
    if (built.size > 20) built.clear();
    built.set(key, found);
  }
  return found;
}

/** A player's board from their moves: moves that don't count (late, changing nothing, after the solve) are skipped. */
export function playOf(puzzle: Puzzle, run: Run | undefined, at: number): Play {
  let play = newPlay(puzzle);
  if (!run || run.at !== at) return play;
  let last = 0;
  for (const move of run.moves.slice(0, MAX_MOVES)) {
    if (!move || move.t > ROUND_MS) break;
    if (move.t < last || (move.to !== EMPTY && move.to !== MARK && move.to !== PIECE)) continue;
    try {
      play = setMark(play, move.cell, move.to, move.t);
      last = move.t;
    } catch {
      // off the grid, or after the solve
    }
  }
  return play;
}

/** Pieces on the board that clash with none: how far a player is, without saying where. */
export function cleanPieces(play: Play): number {
  return piecesOf(play.marks).length - status(play).bad.length;
}

export function scoreOf(puzzle: Puzzle, run: Run | undefined, at: number): RoundScore {
  const play = playOf(puzzle, run, at);
  const solved = status(play).solved;
  return { ms: solved ? (play.moves.at(-1)?.t ?? 0) : ROUND_MS, extra: 0, found: cleanPieces(play), done: solved };
}

export const race = createRace<GridRaceState, Run>({
  roundMs: ROUND_MS,
  penaltyMs: 0,
  lobby: (mode, from) => ({ ...newRace(mode), ...(from ? { pieces: from.pieces, rounds: from.rounds } : {}) }),
  normalize,
  roundContent: (_state, _round, seed) => ({ seed }),
  score: (state, run) => (state.seed ? scoreOf(puzzleOf(state).puzzle, run, state.startsAt) : { ms: ROUND_MS, extra: 0, found: 0, done: false }),
});
