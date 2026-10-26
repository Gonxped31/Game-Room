import { describe, expect, it } from "vitest";
import { COUNTDOWN_MS, MAX_ROUNDS } from "@/lib/games/race/race";
import { MARK, PIECE, type Move } from "./play";
import { cleanPieces, newRace, normalize, playOf, puzzleOf, race, roundSpec, ROUND_MS, scoreOf, setPieces, type GridRaceState, type Run } from "./race";

const { start, endRound, next, roundOver, decided, standings, backToLobby } = race;

const run = (at: number, moves: Move[], gaveUp = false): Run => ({ at, moves, gaveUp });
/** The solution placed one piece a second, from `from` ms. */
const solve = (state: GridRaceState, from = 1000): Move[] => puzzleOf(state).solution.map((cell, i) => ({ cell, to: PIECE, t: from + i * 1000 }));

describe("Checkmate Grid's race", () => {
  it("climbs from 6×6 to 9×9 and goes through the pieces when mixed", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((round) => roundSpec("mixed", round).size)).toEqual([6, 6, 7, 7, 8, 8, 9, 9]);
    expect([0, 1, 2, 3, 4, 5].map((round) => roundSpec("mixed", round).variant)).toEqual(["rook", "king", "knight", "queen", "mix", "rook"]);
    expect(roundSpec("knight", 3)).toEqual({ variant: "knight", size: 7, minLevel: 2 });
    expect(roundSpec("rook", 6).minLevel).toBe(1);
  });

  it("builds every round's puzzle from the seed, the same each time", () => {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const state = { pieces: "mixed" as const, round, seed: `s${round}` };
      const a = puzzleOf(state);
      expect(a.puzzle.size).toBe(roundSpec("mixed", round).size);
      expect(a.solution).toHaveLength(a.puzzle.size);
      expect(puzzleOf({ ...state }).puzzle).toEqual(a.puzzle);
    }
  }, 30_000); // ten puzzles up to 9×9

  it("settings change only in the lobby, and a game keeps them", () => {
    const lobby = setPieces(newRace("challenge"), "queen");
    expect(lobby.pieces).toBe("queen");
    expect(() => setPieces(lobby, "pawn" as never)).toThrow();
    const game = start(lobby, { seated: ["p1", "p2"], seed: "a", now: 0 });
    expect(game).toMatchObject({ phase: "round", seed: "a", round: 0, startsAt: COUNTDOWN_MS, endsAt: COUNTDOWN_MS + ROUND_MS });
    expect(() => setPieces(game, "rook")).toThrow();
  });

  it("replays a run: late moves, other rounds' moves and moves after the solve don't count", () => {
    const state = start(newRace("challenge"), { seated: ["p1", "p2"], seed: "b", now: 0 });
    const { puzzle } = puzzleOf(state);
    const moves = solve(state);
    const at = state.startsAt;
    expect(scoreOf(puzzle, run(at, moves), at)).toEqual({ ms: moves.at(-1)!.t, extra: 0, found: puzzle.size, done: true });
    expect(playOf(puzzle, run(at, [...moves, { cell: 0, to: MARK, t: 99_000 }]), at).moves).toHaveLength(moves.length);
    expect(scoreOf(puzzle, run(at - 1, moves), at).done).toBe(false);
    expect(scoreOf(puzzle, run(at, [{ ...moves[0], t: ROUND_MS + 1 }]), at).found).toBe(0);
    // Two pieces in one row clash: neither counts.
    const [a] = moves;
    const sameRow = (a.cell % puzzle.size === 0 ? a.cell + 1 : a.cell - 1);
    const clash = playOf(puzzle, run(at, [a, { cell: sameRow, to: PIECE, t: 2000 }]), at);
    expect(cleanPieces(clash)).toBe(0);
  });

  it("plays a survival to the end, the unsolved out first", () => {
    let state = start(newRace("survival"), { seated: ["p1", "p2", "p3", "p4"], seed: "c", now: 0 });
    const t = state.startsAt;
    const runs = { p1: run(t, solve(state)), p2: run(t, solve(state, 2000)), p3: run(t, solve(state, 3000)), p4: run(t, [], true) };
    expect(roundOver(state, runs, t + 60_000)).toBe(true);
    state = endRound(state, runs, t + 60_000);
    expect(state.results[0].out).toEqual(["p4"]);
    expect(state.alive).toEqual(["p1", "p2", "p3"]);
    state = next(state, "d", state.nextAt);
    expect(state).toMatchObject({ phase: "round", round: 1, seed: "d" });
    while (!decided(state)) {
      const at = state.startsAt;
      const rs = Object.fromEntries(state.alive.map((seat, i) => [seat, run(at, solve(state, 1000 + i * 500))]));
      state = endRound(state, rs, state.endsAt);
      state = state.alive.length > 1 ? next(state, `r${state.round}`, state.nextAt) : state;
    }
    expect(state.alive).toEqual(["p1"]);
    expect(next(state, "e", state.nextAt).phase).toBe("over");
    expect(standings(next(state, "e", state.nextAt)).map((row) => row.seat)).toEqual(["p1", "p2", "p3", "p4"]);
  });

  it("goes back to the lobby keeping the piece and the length", () => {
    let state = start(setPieces({ ...newRace("challenge"), rounds: 5 }, "king"), { seated: ["p1", "p2"], seed: "f", now: 0 });
    for (let i = 0; i < 5; i++) {
      state = endRound(state, {}, state.endsAt);
      state = next(state, `g${i}`, state.nextAt);
    }
    expect(state.phase).toBe("over");
    expect(normalize(backToLobby(state))).toMatchObject({ phase: "lobby", pieces: "king", rounds: 5, seed: "", players: [] });
  });
});
