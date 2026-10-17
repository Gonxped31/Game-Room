import { describe, expect, it } from "vitest";
import { pruneLikeFirebase, undefinedPaths } from "@/lib/store/firebaseShape";
import { RACE_START_DELAY_MS, RESULT_GRACE_MS } from "./constants";
import {
  type GameState,
  giveUpOnMissingResults,
  nearMissPoints,
  newGame,
  raceEndsAt,
  resultsOverdue,
  type RunResult,
  runScore,
  setOptions,
  setReady,
  submitResult,
} from "./game";

const NOW = 1_700_000_000_000;
const result = (score: number): RunResult => ({ score, distance: 3000, top: 280, avg: 190, nearMiss: 4, overtakes: 30, crashes: 1 });

function racing(): GameState {
  return setReady(setReady(newGame(), "p1", true, NOW, 1), "p2", true, NOW, 77);
}

describe("setReady", () => {
  it("waits for both players, then starts a race with the seed and a delayed start", () => {
    const one = setReady(newGame(), "p1", true, NOW, 1);
    expect(one.phase).toBe("LOBBY");
    expect(one.ready).toEqual({ p1: true });
    const both = setReady(one, "p2", true, NOW, 77);
    expect(both.phase).toBe("RACING");
    expect(both.race).toBe(1);
    expect(both.seed).toBe(77);
    expect(both.startAt).toBe(NOW + RACE_START_DELAY_MS);
    expect(both.ready).toEqual({});
    expect(both.results).toEqual({});
  });

  it("can be taken back", () => {
    const g = setReady(setReady(newGame(), "p1", true, NOW, 1), "p1", false, NOW, 1);
    expect(g.ready).toEqual({});
    expect(g.phase).toBe("LOBBY");
  });

  it("is refused mid-race", () => {
    expect(() => setReady(racing(), "p1", true, NOW, 1)).toThrow();
  });

  it("starts the next race from DONE, clearing the last results", () => {
    const done = submitResult(submitResult(racing(), "p1", result(5)), "p2", result(9));
    const next = setReady(setReady(done, "p2", true, NOW, 3), "p1", true, NOW + 1, 4);
    expect(next.phase).toBe("RACING");
    expect(next.race).toBe(2);
    expect(next.results).toEqual({});
    expect(next.history).toHaveLength(1);
  });
});

describe("setOptions", () => {
  it("starts with pickups on, rain off, in the city", () => {
    expect(newGame().options).toEqual({ rain: false, pickups: true, desert: false });
  });

  it("changes a switch and takes back both players' Ready", () => {
    const g = setOptions(setReady(newGame(), "p1", true, NOW, 1), { rain: true });
    expect(g.options).toEqual({ rain: true, pickups: true, desert: false });
    expect(g.ready).toEqual({});
  });

  it("moves the race to the desert, and back", () => {
    const desert = setOptions(newGame(), { desert: true });
    expect(desert.options).toEqual({ rain: false, pickups: true, desert: true });
    expect(setOptions(desert, { desert: false }).options.desert).toBe(false);
    expect(() => setOptions(desert, { desert: true })).toThrow();
  });

  it("is refused mid-race, or when nothing changes", () => {
    expect(() => setOptions(racing(), { rain: true })).toThrow();
    expect(() => setOptions(newGame(), { pickups: true })).toThrow();
  });

  it("gives a room from before the options the defaults", () => {
    const old = { ...newGame() } as Partial<GameState>;
    delete old.options;
    expect(setOptions(old as GameState, { rain: true }).options).toEqual({ rain: true, pickups: true, desert: false });
  });

  it("keeps a room from before the desert in the city", () => {
    const old = { ...newGame(), options: { rain: true, pickups: false } } as unknown as GameState;
    expect(setOptions(old, { pickups: true }).options).toEqual({ rain: true, pickups: true, desert: false });
  });
});

describe("submitResult", () => {
  it("waits for both, then picks the higher score and counts the win", () => {
    const one = submitResult(racing(), "p1", result(12000));
    expect(one.phase).toBe("RACING");
    const done = submitResult(one, "p2", result(9000));
    expect(done.phase).toBe("DONE");
    expect(done.wins).toEqual({ p1: 1, p2: 0 });
    expect(done.history).toEqual([{ race: 1, scores: { p1: 12000, p2: 9000 }, winner: "p1" }]);
  });

  it("calls a tie a tie", () => {
    const done = submitResult(submitResult(racing(), "p1", result(500)), "p2", result(500));
    expect(done.history[0].winner).toBe("tie");
    expect(done.wins).toEqual({ p1: 0, p2: 0 });
  });

  it("refuses a second result for the same seat, or one outside a race", () => {
    expect(() => submitResult(submitResult(racing(), "p1", result(1)), "p1", result(2))).toThrow();
    expect(() => submitResult(newGame(), "p1", result(1))).toThrow();
  });
});

describe("giveUpOnMissingResults", () => {
  it("only once the grace period has passed, and the finisher wins", () => {
    const one = submitResult(racing(), "p2", result(4000));
    const deadline = raceEndsAt(one.startAt!) + RESULT_GRACE_MS;
    expect(resultsOverdue(one, deadline - 1)).toBe(false);
    expect(() => giveUpOnMissingResults(one, deadline - 1)).toThrow();
    expect(resultsOverdue(one, deadline)).toBe(true);
    const done = giveUpOnMissingResults(one, deadline);
    expect(done.phase).toBe("DONE");
    expect(done.history[0]).toEqual({ race: 1, scores: { p2: 4000 }, winner: "p2" });
  });
});

describe("scoring", () => {
  it("scales near misses by combo, half again when very close", () => {
    expect(nearMissPoints(1, 0.8)).toBe(250);
    expect(nearMissPoints(3, 0.8)).toBe(750);
    expect(nearMissPoints(2, 0.3)).toBe(750);
  });

  it("is distance plus bonus, rounded down", () => {
    expect(runScore(1234.9, 500)).toBe(1734);
  });
});

describe("writes Firebase accepts", () => {
  // Each transition gets the state as Firebase hands it back (empty objects
  // and arrays dropped), and must never write an explicit undefined.
  const roundTrip = (g: GameState) => pruneLikeFirebase(g) as GameState;
  it("never writes undefined across a full race series", () => {
    let g = roundTrip(newGame());
    const steps: ((g: GameState) => GameState)[] = [
      (s) => setOptions(s, { rain: true, pickups: false }),
      (s) => setReady(s, "p1", true, NOW, 1),
      (s) => setReady(s, "p2", true, NOW, 2),
      (s) => submitResult(s, "p1", result(10)),
      (s) => submitResult(s, "p2", result(20)),
      (s) => setReady(s, "p1", true, NOW, 3),
      (s) => setReady(s, "p2", true, NOW, 4),
      (s) => submitResult(s, "p1", result(30)),
      (s) => giveUpOnMissingResults(s, NOW + 10 * 60 * 1000),
    ];
    for (const step of steps) {
      const next = step(g);
      expect(undefinedPaths(next)).toEqual([]);
      g = roundTrip(next);
    }
    expect(g.phase).toBe("DONE");
    expect(g.wins).toEqual({ p1: 1, p2: 1 });
  });
});
