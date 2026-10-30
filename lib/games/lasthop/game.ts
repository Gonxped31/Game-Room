import type { Role, WithIdentity } from "@/lib/session/types";
import { assertDue } from "@/lib/session/shared/deadline";
import { applyMove, type Board, type Colour, findMove, legalMoves, opponent } from "./board";
import { BETWEEN_MS, CLOCKS, DEFAULT_PAWNS, MAX_ROUNDS, MIN_ROUNDS, type Mode, MODES, type Pawn, PAWNS, START_DELAY_MS } from "./constants";

/**
 * Last Hop's state machine. A match is rounds in pairs: each board is played
 * twice, the players swapping colours, so neither gets the better side. A
 * always moves first. Each player has a chess clock (`clocks`, ms left at
 * the start of the current turn); a move adds the mode's increment back.
 * Running out (`flag`, applied by whichever device sees it pass) or having
 * no move on your turn loses the round.
 */

export type Phase = "lobby" | "playing" | "roundOver" | "matchOver";
export type EndReason = "stuck" | "time";
/** A matchmaking player's vote after a match: the same mode again, or the other one. */
export type Vote = "again" | "switch";

export interface RoundResult {
  winner: Role;
  reason: EndReason;
  /** Who played A that round. */
  aSeat: Role;
  moves: number;
}

export interface LastHopState extends WithIdentity {
  phase: Phase;
  mode: Mode;
  /** 1-based; 0 in the lobby. */
  round: number;
  /** Who plays A in round 1 (drawn at the start of a match). */
  firstA: Role;
  /** The board in play, and how its pair of rounds started. Absent in the lobby. */
  board?: Board;
  start?: string;
  turn: Colour;
  clocks: Record<Role, number>;
  /** When the current turn's clock started running (server ms). */
  turnStartedAt?: number;
  /** When the next round starts (server ms), between rounds. */
  nextAt?: number;
  last?: { from: number; to: number };
  /** Moves made this round. */
  moves: number;
  score: Record<Role, number>;
  history: RoundResult[];
  /** After a match in a matchmaking room (no host): each player's vote for what's next. */
  votes?: Partial<Record<Role, Vote>>;
  /** The pawns players picked; a seat without one plays its `DEFAULT_PAWNS` (`pawnOf`). */
  pawns?: Partial<Record<Role, Pawn>>;
}

export function otherSeat(seat: Role): Role {
  return seat === "p1" ? "p2" : "p1";
}

/** A fresh lobby in `mode`, keeping the pawns players already picked (Reset game). */
export function newGame(mode: Mode = "track", pawns?: Partial<Record<Role, Pawn>>): LastHopState {
  return {
    ...(pawns && Object.keys(pawns).length ? { pawns } : {}),
    names: {},
    phase: "lobby",
    mode,
    round: 0,
    firstA: "p1",
    turn: "A",
    clocks: { p1: CLOCKS[mode].startMs, p2: CLOCKS[mode].startMs },
    moves: 0,
    score: { p1: 0, p2: 0 },
    history: [],
  };
}

/** Fills what the database drops (empty arrays) and is safe on any stored state. */
export function normalize(state: LastHopState): LastHopState {
  return {
    ...state,
    names: state.names ?? {},
    history: state.history ?? [],
    score: { p1: state.score?.p1 ?? 0, p2: state.score?.p2 ?? 0 },
    clocks: { p1: state.clocks?.p1 ?? 0, p2: state.clocks?.p2 ?? 0 },
  };
}

/** The pawn a seat plays: its pick, or its default. */
export function pawnOf(state: LastHopState, seat: Role): Pawn {
  return state.pawns?.[seat] ?? DEFAULT_PAWNS[seat];
}

/**
 * A player picks their pawn, in the lobby or between matches (never
 * mid-match, where it would change under the other player's eyes). It must
 * differ from the other player's.
 */
export function setPawn(state: LastHopState, seat: Role, pawn: Pawn): LastHopState {
  const s = normalize(state);
  if (s.phase !== "lobby" && s.phase !== "matchOver") throw new Error("Pawns are picked between matches.");
  if (!PAWNS.includes(pawn)) throw new Error("Unknown pawn.");
  if (pawnOf(s, otherSeat(seat)) === pawn) throw new Error("The other player has that pawn.");
  return { ...s, pawns: { ...s.pawns, [seat]: pawn } };
}

/** Who plays A in a round: `firstA` in odd rounds, the other seat in even ones. */
export function aSeatOf(state: LastHopState, round = state.round): Role {
  return round % 2 === 1 ? state.firstA : otherSeat(state.firstA);
}

export function seatOf(state: LastHopState, colour: Colour): Role {
  const a = aSeatOf(state);
  return colour === "A" ? a : otherSeat(a);
}

export function colourOf(state: LastHopState, seat: Role): Colour {
  return aSeatOf(state) === seat ? "A" : "B";
}

/** The seat whose clock is running. */
export function moverOf(state: LastHopState): Role {
  return seatOf(state, state.turn);
}

/** When the mover's clock runs out (server ms), while a round is being played. */
export function flagAt(state: LastHopState): number | undefined {
  if (state.phase !== "playing" || state.turnStartedAt == null) return undefined;
  return state.turnStartedAt + state.clocks[moverOf(state)];
}

/** A seat's clock at `now`: only the mover's is running. */
export function clockLeft(state: LastHopState, seat: Role, now: number): number {
  const stored = state.clocks[seat];
  if (state.phase !== "playing" || moverOf(state) !== seat || state.turnStartedAt == null) return stored;
  return Math.max(0, stored - Math.max(0, now - state.turnStartedAt));
}

/** The next step that waits for a deadline: a clock running out, or the next round. */
export function dueAt(state: LastHopState): number | undefined {
  if (state.phase === "playing") return flagAt(state);
  if (state.phase === "roundOver") return state.nextAt;
  return undefined;
}

export function otherMode(mode: Mode): Mode {
  return mode === "track" ? "grid" : "track";
}

/**
 * The next match's mode: picked when the room is created (the hub's Start),
 * then switched by the host in the lobby or between matches, never mid-match
 * (Reset game goes back to the lobby). A matchmaking room's lobby keeps its
 * queue's mode (the rules refuse a switch there).
 */
export function setMode(state: LastHopState, mode: Mode): LastHopState {
  const s = normalize(state);
  if (s.phase !== "lobby" && s.phase !== "matchOver") throw new Error("The mode changes between matches.");
  if (!MODES.includes(mode)) throw new Error("Unknown mode.");
  return { ...s, mode, clocks: { p1: CLOCKS[mode].startMs, p2: CLOCKS[mode].startMs } };
}

/** Builds a state without the optional fields listed (never write an explicit `undefined`). */
function without(game: LastHopState, ...keys: (keyof LastHopState)[]): LastHopState {
  const copy = { ...game };
  for (const key of keys) delete copy[key];
  return copy;
}

function roundStart(s: LastHopState, round: number, board: Board, start: string, now: number): LastHopState {
  return {
    ...without(s, "nextAt", "last", "votes"),
    phase: "playing",
    round,
    board: { ...board, cells: start },
    start,
    turn: "A",
    clocks: { p1: CLOCKS[s.mode].startMs, p2: CLOCKS[s.mode].startMs },
    turnStartedAt: now + START_DELAY_MS,
    moves: 0,
  };
}

/** Starts a match (from the lobby, or again after one ends) on `board`, generated for the mode. */
export function startMatch(state: LastHopState, board: Board, firstA: Role, now: number): LastHopState {
  const s = normalize(state);
  if (s.phase !== "lobby" && s.phase !== "matchOver") throw new Error("A match is already on.");
  checkBoard(board);
  const fresh = { ...s, firstA, score: { p1: 0, p2: 0 }, history: [] };
  return roundStart(fresh, 1, board, board.cells, now);
}

/**
 * A matchmaking player's vote after a match. Once both have voted the same
 * way, the next match starts: again in this mode, or in the other one, on a
 * board from `deal`. Until then (or while they disagree) the votes just show,
 * and either player may change theirs.
 */
export function vote(state: LastHopState, seat: Role, choice: Vote, deal: (mode: Mode) => Board, firstA: Role, now: number): LastHopState {
  const s = normalize(state);
  if (s.phase !== "matchOver") throw new Error("Votes are cast between matches.");
  if (choice !== "again" && choice !== "switch") throw new Error("Unknown vote.");
  const votes = { ...s.votes, [seat]: choice };
  if (votes.p1 == null || votes.p1 !== votes.p2) return { ...s, votes };
  const next = choice === "switch" ? setMode(s, otherMode(s.mode)) : s;
  return startMatch(next, deal(next.mode), firstA, now);
}

export function move(state: LastHopState, seat: Role, from: number, to: number, now: number): LastHopState {
  const s = normalize(state);
  if (s.phase !== "playing" || !s.board || s.turnStartedAt == null) throw new Error("No round is being played.");
  if (moverOf(s) !== seat) throw new Error("Not your turn.");
  const deadline = flagAt(s)!;
  if (now >= deadline) throw new Error("Out of time.");
  const found = findMove(s.board, s.turn, from, to);
  if (!found) throw new Error("Not a legal move.");

  const board = applyMove(s.board, found);
  const elapsed = Math.max(0, now - s.turnStartedAt);
  const clocks = { ...s.clocks, [seat]: s.clocks[seat] - elapsed + CLOCKS[s.mode].incrementMs };
  const next = opponent(s.turn);
  const played: LastHopState = {
    ...s,
    board,
    clocks,
    turn: next,
    turnStartedAt: now,
    last: { from, to },
    moves: s.moves + 1,
  };
  return legalMoves(board, next).length === 0 ? endRound(played, seat, "stuck", now) : played;
}

/** The mover's clock has run out: they lose the round. Every device may try it; only a due one applies. */
export function flag(state: LastHopState, now: number): LastHopState {
  const s = normalize(state);
  assertDue(s, "playing", flagAt(s), now);
  const loser = moverOf(s);
  return endRound({ ...s, clocks: { ...s.clocks, [loser]: 0 } }, otherSeat(loser), "time", now);
}

function endRound(s: LastHopState, winner: Role, reason: EndReason, now: number): LastHopState {
  const score = { ...s.score, [winner]: s.score[winner] + 1 };
  const history = [...s.history, { winner, reason, aSeat: aSeatOf(s), moves: s.moves }];
  const ended = { ...without(s, "turnStartedAt"), score, history };
  return matchDecided(ended) ? { ...ended, phase: "matchOver" } : { ...ended, phase: "roundOver", nextAt: now + BETWEEN_MS };
}

/**
 * Over once the trailing player can't catch up by the end of round 4, or the
 * current pair, whichever is later; level then, it goes on pair by pair, and
 * after `MAX_ROUNDS` it's a draw.
 */
export function matchDecided(s: LastHopState): boolean {
  const r = s.round;
  if (r >= MAX_ROUNDS) return true;
  const target = Math.max(MIN_ROUNDS, r % 2 === 0 ? r : r + 1);
  return Math.abs(s.score.p1 - s.score.p2) > target - r;
}

/** The match's winner, or null for a draw (or while it's on). */
export function matchWinner(state: LastHopState): Role | null {
  if (state.phase !== "matchOver" || state.score.p1 === state.score.p2) return null;
  return state.score.p1 > state.score.p2 ? "p1" : "p2";
}

/**
 * The next round, once `nextAt` passes. An even round replays its pair's
 * board with the colours swapped; an odd one starts a new pair on `fresh`.
 */
export function nextRound(state: LastHopState, fresh: Board, now: number): LastHopState {
  const s = normalize(state);
  assertDue(s, "roundOver", s.nextAt, now);
  if (!s.board || s.start == null) throw new Error("No board.");
  const round = s.round + 1;
  if (round % 2 === 0) return roundStart(s, round, s.board, s.start, now);
  checkBoard(fresh);
  return roundStart(s, round, fresh, fresh.cells, now);
}

/** Whether `nextRound` will use its fresh board (a new pair starts), so a device can skip generating one. */
export function needsFreshBoard(state: LastHopState): boolean {
  return state.phase !== "roundOver" || (state.round + 1) % 2 === 1;
}

function checkBoard(board: Board): void {
  if (!/^[AB.]+$/.test(board.cells) || board.cells.length !== board.w * board.h) throw new Error("Bad board.");
}
