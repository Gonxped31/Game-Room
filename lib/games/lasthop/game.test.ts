import { describe, expect, it } from "vitest";
import type { Role } from "@/lib/session/types";
import type { Board } from "./board";
import { BETWEEN_MS, CLOCKS, MAX_ROUNDS, START_DELAY_MS } from "./constants";
import {
  aSeatOf,
  clockLeft,
  colourOf,
  dueAt,
  flag,
  flagAt,
  type LastHopState,
  matchWinner,
  move,
  moverOf,
  needsFreshBoard,
  newGame,
  nextRound,
  normalize,
  setMode,
  startMatch,
} from "./game";

const T = 1_000_000;
const board = (cells: string, w = cells.length, h = 1): Board => ({ w, h, cells });
/** A plays 1->2 and B, stuck against the left edge, has no move: A wins at once. */
const QUICK = board("BA.");
const WIDE = board("AA.A..BB.B");

function started(cells = WIDE, firstA: Role = "p1"): LastHopState {
  return startMatch(newGame(), cells, firstA, T);
}

/** Ends the current round with `winner` taking it (A by its quick win, B by A's flag). */
function finishRound(state: LastHopState, winner: Role): LastHopState {
  const at = state.turnStartedAt!;
  if (aSeatOf(state) === winner) return move(state, winner, 1, 2, at);
  return flag(state, flagAt(state)!);
}

function next(state: LastHopState): LastHopState {
  return nextRound(state, QUICK, state.nextAt!);
}

/** Plays rounds on QUICK boards with these winners, in order. */
function playMatch(winners: Role[]): LastHopState {
  let state = started(QUICK);
  winners.forEach((winner, i) => {
    if (i > 0) state = next(state);
    state = finishRound(state, winner);
  });
  return state;
}

describe("newGame and setMode", () => {
  it("starts in the lobby with full clocks and no score", () => {
    const game = newGame();
    expect(game).toMatchObject({ names: {}, phase: "lobby", mode: "track", round: 0, score: { p1: 0, p2: 0 }, history: [] });
    expect(game.clocks.p1).toBe(CLOCKS.track.startMs);
  });

  it("starts in the mode it's given (the hub's Start)", () => {
    expect(newGame("grid")).toMatchObject({ mode: "grid", clocks: { p1: CLOCKS.grid.startMs, p2: CLOCKS.grid.startMs } });
  });

  it("changes the mode and its clocks between matches only", () => {
    const done = playMatch(["p1", "p1", "p1"]);
    const grid = setMode(done, "grid");
    expect(grid.mode).toBe("grid");
    expect(grid.clocks.p2).toBe(CLOCKS.grid.startMs);
    expect(() => setMode(newGame(), "grid")).toThrow("between matches");
    expect(() => setMode(started(), "grid")).toThrow();
    expect(() => setMode(done, "hex" as never)).toThrow();
  });

  it("normalizes what the database drops", () => {
    const stored = { ...newGame() } as Partial<LastHopState>;
    delete stored.history;
    delete stored.names;
    expect(normalize(stored as LastHopState)).toMatchObject({ history: [], names: {} });
  });
});

describe("startMatch", () => {
  it("deals the board with A to move once the start delay passes", () => {
    const game = started(WIDE, "p2");
    expect(game).toMatchObject({ phase: "playing", round: 1, turn: "A", moves: 0, start: WIDE.cells, firstA: "p2" });
    expect(game.board).toEqual(WIDE);
    expect(game.turnStartedAt).toBe(T + START_DELAY_MS);
    expect(colourOf(game, "p2")).toBe("A");
    expect(moverOf(game)).toBe("p2");
  });

  it("refuses a bad board, or a second start mid-match", () => {
    expect(() => startMatch(newGame(), board("AXB"), "p1", T)).toThrow();
    expect(() => startMatch(newGame(), { w: 4, h: 1, cells: "A.B" }, "p1", T)).toThrow();
    expect(() => startMatch(started(), WIDE, "p1", T)).toThrow();
  });
});

describe("move", () => {
  it("moves the mover's piece and hands the turn over", () => {
    const game = started();
    const at = game.turnStartedAt! + 5_000;
    const after = move(game, "p1", 3, 4, at);
    expect(after.board!.cells).toBe("AA..A.BB.B");
    expect(after).toMatchObject({ turn: "B", moves: 1, last: { from: 3, to: 4 }, turnStartedAt: at });
  });

  it("charges the time used and adds the increment", () => {
    const game = started();
    const after = move(game, "p1", 3, 4, game.turnStartedAt! + 5_000);
    expect(after.clocks.p1).toBe(CLOCKS.track.startMs - 5_000 + CLOCKS.track.incrementMs);
    expect(after.clocks.p2).toBe(CLOCKS.track.startMs);
  });

  it("charges nothing for a move made before the clock starts", () => {
    const game = started();
    const after = move(game, "p1", 3, 4, T);
    expect(after.clocks.p1).toBe(CLOCKS.track.startMs + CLOCKS.track.incrementMs);
  });

  it("refuses the wrong player, an illegal move, a move out of time, or no round", () => {
    const game = started();
    const at = game.turnStartedAt!;
    expect(() => move(game, "p2", 6, 5, at)).toThrow("Not your turn");
    expect(() => move(game, "p1", 0, 1, at)).toThrow("Not a legal move");
    expect(() => move(game, "p1", 3, 4, flagAt(game)!)).toThrow("Out of time");
    expect(() => move(newGame(), "p1", 3, 4, at)).toThrow();
  });

  it("wins the round when the other side is left with no move", () => {
    const game = move(started(QUICK), "p1", 1, 2, T);
    expect(game).toMatchObject({ phase: "roundOver", score: { p1: 1, p2: 0 }, nextAt: T + BETWEEN_MS });
    expect(game.history).toEqual([{ winner: "p1", reason: "stuck", aSeat: "p1", moves: 1 }]);
    expect(game.turnStartedAt).toBeUndefined();
  });
});

describe("clocks and flag", () => {
  it("runs only the mover's clock", () => {
    const game = started();
    const at = game.turnStartedAt! + 10_000;
    expect(clockLeft(game, "p1", at)).toBe(CLOCKS.track.startMs - 10_000);
    expect(clockLeft(game, "p2", at)).toBe(CLOCKS.track.startMs);
    expect(clockLeft(game, "p1", T)).toBe(CLOCKS.track.startMs);
    expect(clockLeft(game, "p1", at + 999_999)).toBe(0);
  });

  it("is due when the mover's clock runs out, and between rounds", () => {
    const game = started();
    expect(dueAt(game)).toBe(game.turnStartedAt! + CLOCKS.track.startMs);
    expect(dueAt(newGame())).toBeUndefined();
    const over = finishRound(started(QUICK), "p1");
    expect(dueAt(over)).toBe(over.nextAt);
  });

  it("loses the round on time, only once due", () => {
    const game = started();
    expect(() => flag(game, flagAt(game)! - 1)).toThrow();
    const flagged = flag(game, flagAt(game)!);
    expect(flagged).toMatchObject({ phase: "roundOver", score: { p1: 0, p2: 1 } });
    expect(flagged.clocks.p1).toBe(0);
    expect(flagged.history[0]).toMatchObject({ winner: "p2", reason: "time" });
    expect(() => flag(flagged, T * 2)).toThrow();
  });
});

describe("nextRound", () => {
  it("replays the pair's board with the colours swapped", () => {
    const first = move(started(WIDE), "p1", 3, 4, T);
    const over = flag(first, flagAt(first)!);
    expect(needsFreshBoard(over)).toBe(false);
    expect(() => nextRound(over, QUICK, over.nextAt! - 1)).toThrow();
    const second = nextRound(over, QUICK, over.nextAt!);
    expect(second).toMatchObject({ phase: "playing", round: 2, turn: "A", moves: 0, start: WIDE.cells });
    expect(second.board!.cells).toBe(WIDE.cells);
    expect(second.last).toBeUndefined();
    expect(second.nextAt).toBeUndefined();
    expect(aSeatOf(second)).toBe("p2");
    expect(second.clocks).toEqual({ p1: CLOCKS.track.startMs, p2: CLOCKS.track.startMs });
  });

  it("starts a new pair on the fresh board", () => {
    // Both rounds end on time (the A player flags), so the long board needs no moves.
    const afterTwo = finishRound(next(finishRound(started(WIDE), "p2")), "p1");
    expect(afterTwo.phase).toBe("roundOver");
    expect(needsFreshBoard(afterTwo)).toBe(true);
    const third = nextRound(afterTwo, QUICK, afterTwo.nextAt!);
    expect(third).toMatchObject({ round: 3, start: QUICK.cells });
    expect(aSeatOf(third)).toBe("p1");
  });
});

describe("the match", () => {
  it("ends early once the trailing player can't catch up", () => {
    const game = playMatch(["p1", "p1", "p1"]);
    expect(game.phase).toBe("matchOver");
    expect(matchWinner(game)).toBe("p1");
    expect(game.nextAt).toBeUndefined();
  });

  it("goes the four rounds at 2-1", () => {
    expect(playMatch(["p1", "p2", "p1"]).phase).toBe("roundOver");
    const done = playMatch(["p1", "p2", "p1", "p1"]);
    expect(done.phase).toBe("matchOver");
    expect(done.score).toEqual({ p1: 3, p2: 1 });
  });

  it("plays another pair when level after four, and settles at its end", () => {
    expect(playMatch(["p1", "p2", "p2", "p1"]).phase).toBe("roundOver");
    expect(playMatch(["p1", "p2", "p2", "p1", "p2"]).phase).toBe("roundOver");
    const done = playMatch(["p1", "p2", "p2", "p1", "p2", "p2"]);
    expect(done.phase).toBe("matchOver");
    expect(matchWinner(done)).toBe("p2");
  });

  it("is a draw still level after the last round", () => {
    const winners = Array.from({ length: MAX_ROUNDS }, (_, i): Role => (i % 2 === 0 ? "p1" : "p2"));
    const done = playMatch(winners);
    expect(done.phase).toBe("matchOver");
    expect(done.round).toBe(MAX_ROUNDS);
    expect(matchWinner(done)).toBeNull();
  });

  it("plays again with a clean score, in the mode picked for the next match", () => {
    const done = playMatch(["p1", "p1", "p1"]);
    const again = startMatch(done, WIDE, "p2", T * 2);
    expect(again).toMatchObject({ phase: "playing", mode: "track", round: 1, score: { p1: 0, p2: 0 }, history: [], firstA: "p2" });
    const grid = startMatch(setMode(done, "grid"), { w: 4, h: 4, cells: "AAA.A.....BB..BB" }, "p1", T * 2);
    expect(grid).toMatchObject({ phase: "playing", mode: "grid", clocks: { p1: CLOCKS.grid.startMs, p2: CLOCKS.grid.startMs } });
  });
});
