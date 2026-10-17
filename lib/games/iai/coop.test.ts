import { describe, expect, it } from "vitest";
import { pruneLikeFirebase, undefinedPaths } from "@/lib/store/firebaseShape";
import { abandonRun, type CoopResult, finishRun, type GameState, newGame, RUN_START_DELAY_MS, setReady } from "./coop";

const NOW = 1_700_000_000_000;
const result = (score: number): CoopResult => ({ score, survived: 95, kills: 40, oni: 1, combo: 22, perfect: 41 });
const running = () => setReady(setReady(newGame(), "p1", true, NOW), "p2", true, NOW);

describe("setReady", () => {
  it("waits for both, then starts a run after a short delay", () => {
    const one = setReady(newGame(), "p2", true, NOW);
    expect(one.phase).toBe("LOBBY");
    const g = setReady(one, "p1", true, NOW);
    expect(g.phase).toBe("RUNNING");
    expect(g.run).toBe(1);
    expect(g.startAt).toBe(NOW + RUN_START_DELAY_MS);
    expect(g.ready).toEqual({});
  });

  it("can be taken back, and is refused mid-run", () => {
    expect(setReady(setReady(newGame(), "p1", true, NOW), "p1", false, NOW).ready).toEqual({});
    expect(() => setReady(running(), "p1", true, NOW)).toThrow();
  });
});

describe("finishRun", () => {
  it("records the host's result and the room's best, for the current run only", () => {
    const done = finishRun(running(), 1, result(9000));
    expect(done.phase).toBe("DONE");
    expect(done.result!.score).toBe(9000);
    expect(done.best).toBe(9000);
    expect(done.startAt).toBeUndefined();
    expect(() => finishRun(running(), 2, result(1))).toThrow();
    const again = finishRun(setReady(setReady(done, "p1", true, NOW), "p2", true, NOW), 2, result(4000));
    expect(again.best).toBe(9000);
  });
});

describe("abandonRun", () => {
  it("goes back to the lobby when the host is gone", () => {
    const g = abandonRun(running());
    expect(g.phase).toBe("LOBBY");
    expect(g.startAt).toBeUndefined();
    expect(() => abandonRun(newGame())).toThrow();
  });
});

describe("writes Firebase accepts", () => {
  it("never writes undefined through a series", () => {
    const roundTrip = (g: GameState) => pruneLikeFirebase(g) as GameState;
    let g = roundTrip(newGame());
    for (const step of [
      (s: GameState) => setReady(s, "p1", true, NOW),
      (s: GameState) => setReady(s, "p2", true, NOW),
      (s: GameState) => finishRun(s, 1, result(100)),
      (s: GameState) => setReady(s, "p2", true, NOW),
      (s: GameState) => setReady(s, "p1", true, NOW),
      (s: GameState) => abandonRun(s),
    ]) {
      const next = step(g);
      expect(undefinedPaths(next)).toEqual([]);
      g = roundTrip(next);
    }
    expect(g.phase).toBe("LOBBY");
  });
});
