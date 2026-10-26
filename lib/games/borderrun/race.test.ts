import { describe, expect, it } from "vitest";
import { PENALTY_MS } from "./constants";
import {
  areaOf,
  backToLobby,
  COUNTDOWN_MS,
  decided,
  DNF_EXTRA_MS,
  endRound,
  knockedOut,
  knockouts,
  newRace,
  next,
  normalize,
  playOf,
  RESULTS_MS,
  ROUND_MS,
  roundOver,
  roundPoints,
  routeFor,
  type RaceState,
  type RoundScore,
  type Run,
  type Runs,
  scoreOf,
  setMap,
  setMode,
  setRounds,
  standings,
  start,
  startProblem,
} from "./race";
import { shortestPath, type Route } from "./route";

const T0 = 1_000_000;
const seats = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);

/** The countries between start and end, guessed `every` ms apart from `from`. */
const solve = (route: Route, from: number, every = 1000) => shortestPath(route)!.slice(1, -1).map((code, i) => ({ code, t: from + i * every }));
const run = (at: number, guesses: { code: string; t: number }[], gaveUp = false): Run => ({ at, guesses, gaveUp });

const started = (mode: "challenge" | "survival", players: number, map: RaceState["map"] = "europe") =>
  start({ ...newRace(mode), map }, { seated: seats(players), seed: "s1", now: T0 });

describe("lobby", () => {
  it("starts in the lobby with defaults, and only the lobby changes the settings", () => {
    const race = newRace("survival");
    expect(race).toMatchObject({ phase: "lobby", mode: "survival", map: "mixed", rounds: 3 });
    const set = setRounds(setMap(setMode(race, "challenge"), "africa"), 5);
    expect(set).toMatchObject({ mode: "challenge", map: "africa", rounds: 5 });
    const playing = started("challenge", 2);
    expect(() => setMode(playing, "survival")).toThrow();
    expect(() => setMap(set, "oceania" as never)).toThrow();
    expect(() => setRounds(set, 4 as never)).toThrow();
  });

  it("needs 2-4 players for a challenge and 4-8 for survival", () => {
    expect(startProblem("challenge", 1)).toMatch(/at least 2/);
    expect(startProblem("challenge", 2)).toBeNull();
    expect(startProblem("challenge", 4)).toBeNull();
    expect(startProblem("challenge", 5)).toMatch(/4 players at most/);
    expect(startProblem("survival", 3)).toMatch(/at least 4/);
    expect(startProblem("survival", 8)).toBeNull();
    expect(() => start(newRace("survival"), { seated: seats(3), seed: "x", now: T0 })).toThrow();
  });
});

describe("rounds", () => {
  it("starts round 1 after a countdown, with a route on the round's map", () => {
    const race = started("challenge", 3, "mixed");
    expect(race).toMatchObject({ phase: "round", round: 0, players: seats(3), alive: seats(3), startsAt: T0 + COUNTDOWN_MS, endsAt: T0 + COUNTDOWN_MS + ROUND_MS });
    expect(race.route!.area).toBe("europe");
    expect(areaOf("mixed", 1)).toBe("americas");
    expect(areaOf("asia", 4)).toBe("asia");
  });

  it("draws the same route from the same seed, longer as the rounds go on", () => {
    expect(routeFor("europe", 0, "abc")).toEqual(routeFor("europe", 0, "abc"));
    expect(routeFor("europe", 0, "abc").par).toBeLessThanOrEqual(4);
    expect(routeFor("europe", 4, "abc").par).toBe(5);
    for (const map of ["mixed", "world", "eurasia"] as const) for (let round = 0; round < 7; round++) expect(routeFor(map, round, `seed${round}`).par).toBeGreaterThan(0);
  });

  it("counts only the guesses that count: in time, in order, not repeated, none after the finish", () => {
    const race = started("challenge", 2);
    const route = race.route!;
    const answer = solve(route, 1000);
    const late = { code: answer[0].code, t: ROUND_MS + 1 };
    const play = playOf(route, run(race.startsAt, [{ code: "ZZ", t: 10 }, answer[0], answer[0], ...answer.slice(1), { code: "IS", t: 99_000 }]), race.startsAt);
    expect(play.guesses.map((g) => g.code)).toEqual(answer.map((g) => g.code));
    expect(playOf(route, run(race.startsAt, [late]), race.startsAt).guesses).toEqual([]);
    expect(playOf(route, run(race.startsAt - 1, answer), race.startsAt).guesses).toEqual([]); // another round's guesses
    expect(scoreOf(route, run(race.startsAt, answer), race.startsAt)).toMatchObject({ done: true, ms: answer.at(-1)!.t, extra: 0, found: route.par });
    expect(scoreOf(route, undefined, race.startsAt)).toEqual({ ms: ROUND_MS, extra: 0, found: 0, done: false });
  });

  it("ends when everyone present is done, or at the time limit", () => {
    const race = started("challenge", 2);
    const t = race.startsAt;
    const one = { p1: run(race.startsAt, solve(race.route!, 2000)) };
    expect(roundOver(race, one, t + 30_000)).toBe(false);
    expect(roundOver(race, { ...one, p2: run(race.startsAt, [], true) }, t + 30_000)).toBe(true); // p2 gave up
    expect(roundOver(race, one, t + 30_000, ["p1"])).toBe(true); // p2 left
    expect(roundOver(race, {}, race.endsAt)).toBe(true);
    expect(() => endRound(race, one, t + 30_000)).toThrow();
  });

  it("scores a challenge round and moves on after the results", () => {
    const race = started("challenge", 3);
    const runs: Runs = { p1: run(race.startsAt, solve(race.route!, 20_000)), p2: run(race.startsAt, solve(race.route!, 30_000)), p3: run(race.startsAt, []) };
    const ended = endRound(race, runs, race.endsAt);
    expect(ended.phase).toBe("results");
    expect(ended.results[0].scores.p1).toMatchObject({ done: true });
    expect(ended.results[0].scores.p3).toMatchObject({ done: false });
    expect(ended.results[0].out).toEqual([]);
    expect(ended.alive).toEqual(seats(3));
    expect(() => next(ended, "s2", ended.nextAt - 1)).toThrow();
    const round2 = next(ended, "s2", ended.nextAt);
    expect(round2).toMatchObject({ phase: "round", round: 1 });
    expect(round2.nextAt).toBe(0);
  });
});

const score = (ms: number, done = true, extra = 0, found = 0): RoundScore => ({ ms, done, extra, found });

describe("survival", () => {
  it("knocks out two while more than 4 are left, then one", () => {
    expect([8, 6, 5, 4, 3, 2, 1].map(knockouts)).toEqual([2, 2, 2, 1, 1, 1, 0]);
    const scores = { p1: score(10), p2: score(20), p3: score(30), p4: score(40), p5: score(0, false, 0, 2), p6: score(0, false, 0, 1) };
    expect(knockedOut(scores, seats(6))).toEqual(["p5", "p6"]);
    expect(knockedOut({ p1: score(10), p2: score(20), p3: score(30), p4: score(40) }, seats(4))).toEqual(["p4"]);
  });

  it("counts the penalty, and a tie at the cut knocks out nobody in it", () => {
    expect(knockedOut({ p1: score(10_000, true, 1), p2: score(20_000), p3: score(30_000), p4: score(1000) }, seats(4))).toEqual(["p3"]);
    expect(knockedOut({ p1: score(10), p2: score(20), p3: score(30), p4: score(30) }, seats(4))).toEqual([]);
    // Two to go, but the 7th ties with the 6th: only the 8th goes.
    expect(knockedOut({ p1: score(1), p2: score(2), p3: score(3), p4: score(4), p5: score(5), p6: score(6), p7: score(6), p8: score(9) }, seats(8))).toEqual(["p8"]);
  });

  it("plays down to one survivor, then shows the standings", () => {
    let race = started("survival", 5);
    const order: string[][] = [];
    while (race.phase !== "over") {
      if (race.phase === "round") {
        // The lower the seat, the faster: everyone finishes, 1 s apart.
        const runs: Runs = {};
        race.alive.forEach((seat, i) => {
          const guesses = solve(race.route!, 1000 + i * 1000, 10);
          runs[seat] = run(race.startsAt, guesses);
        });
        race = endRound(race, runs, race.startsAt + 60_000);
        order.push(race.results.at(-1)!.out);
      } else race = next(race, `r${race.round + 1}`, race.nextAt);
    }
    expect(order).toEqual([["p4", "p5"], ["p3"], ["p2"]]);
    expect(race.alive).toEqual(["p1"]);
    expect(decided(race)).toBe(true);
    expect(standings(race).map((s) => s.seat)).toEqual(["p1", "p2", "p3", "p4", "p5"]);
    expect(standings(race)[0].outIn).toBeNull();
  });
});

describe("challenge totals", () => {
  it("adds each round's time with penalty; not finishing counts as the slowest finish plus 30 s", () => {
    const result = { scores: { p1: score(40_000, true, 2), p2: score(ROUND_MS, false, 0, 3) }, out: [] };
    expect(roundPoints(result, "p1")).toBe(40_000 + 2 * PENALTY_MS);
    expect(roundPoints(result, "p2")).toBe(ROUND_MS + DNF_EXTRA_MS);
    const slow = { scores: { p1: score(170_000, true, 2), p2: score(ROUND_MS, false) }, out: [] };
    expect(roundPoints(slow, "p2")).toBe(170_000 + 2 * PENALTY_MS + DNF_EXTRA_MS); // never better than a finish
  });

  it("ends after the set number of rounds, lowest total first", () => {
    let race: RaceState = { ...started("challenge", 2), rounds: 3 };
    while (race.phase !== "over") {
      if (race.phase === "round") {
        const runs: Runs = { p1: run(race.startsAt, solve(race.route!, 5000, 10)), p2: run(race.startsAt, solve(race.route!, 2000, 10)) };
        race = endRound(race, runs, race.startsAt + 60_000);
      } else race = next(race, `c${race.round + 1}`, race.nextAt);
    }
    expect(race.results).toHaveLength(3);
    expect(standings(race).map((s) => s.seat)).toEqual(["p2", "p1"]);
  });
});

describe("after a game", () => {
  it("rematches from the end, or goes back to the lobby keeping the settings", () => {
    let race = started("challenge", 2, "asia");
    race = { ...race, phase: "over" };
    const again = start(race, { seated: ["p1", "p2"], seed: "again", now: T0 + 5 });
    expect(again).toMatchObject({ phase: "round", round: 0, results: [] });
    // Last game's first round, given up, doesn't count in the rematch's.
    expect(roundOver(again, { p1: run(race.startsAt, [], true), p2: run(race.startsAt, [], true) }, again.startsAt + 1000)).toBe(false);
    const lobby = backToLobby(race);
    expect(lobby).toMatchObject({ phase: "lobby", mode: "challenge", map: "asia", players: [] });
    expect(() => backToLobby(again)).toThrow();
  });

  it("puts back what the database drops", () => {
    const stored = { ...started("survival", 4), players: undefined, alive: undefined, results: [{ scores: undefined, out: undefined }], route: { ...routeFor("europe", 0, "x"), closed: undefined } } as unknown as RaceState;
    const fixed = normalize(stored);
    expect(fixed.players).toEqual([]);
    expect(fixed.results[0]).toEqual({ scores: {}, out: [] });
    expect(fixed.route!.closed).toEqual([]);
    expect(RESULTS_MS).toBeGreaterThan(0);
  });
});
