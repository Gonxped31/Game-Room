import { describe, expect, it } from "vitest";
import { pruneLikeFirebase, undefinedPaths } from "@/lib/store/firebaseShape";
import { CASES, getCase } from "./cases";
import { DEFENDANT, INVESTIGATOR } from "./constants";
import {
  classifyDuo,
  continueAfterReveal,
  focusPercent,
  type GameState,
  lockIn,
  newGame,
  screenOfRole,
  totalAttempts,
  trustPercent,
} from "./game";

const CASE = getCase("ruined-birthday");

function fresh(): GameState {
  return newGame(CASE.id);
}

describe("screenOfRole", () => {
  it("maps the investigator seat to the investigator screen and the defendant seat to the defendant screen", () => {
    expect(screenOfRole(INVESTIGATOR)).toBe("investigator");
    expect(screenOfRole(DEFENDANT)).toBe("defendant");
  });
});

describe("newGame", () => {
  it("starts Part 1, SELECTING, zero attempts, empty locks/log/names", () => {
    const game = fresh();
    expect(game.caseId).toBe("ruined-birthday");
    expect(game.partIndex).toBe(0);
    expect(game.attempts).toBe(0);
    expect(game.phase).toBe("SELECTING");
    expect(game.locks).toEqual({});
    expect(game.log).toEqual([]);
    expect(game.names).toEqual({});
  });
});

describe("lockIn", () => {
  it("rejects locking in while not SELECTING", () => {
    const solved = lockIn(lockIn(fresh(), CASE, INVESTIGATOR, "I1"), CASE, DEFENDANT, "D1");
    expect(solved.phase).toBe("REVEALED");
    expect(() => lockIn(solved, CASE, INVESTIGATOR, "I2")).toThrow();
  });

  it("rejects a role locking in twice before the other has locked in", () => {
    const afterFirst = lockIn(fresh(), CASE, INVESTIGATOR, "I1");
    expect(() => lockIn(afterFirst, CASE, INVESTIGATOR, "I2")).toThrow();
  });

  it("rejects a card that isn't in that role's hand for the current Part", () => {
    expect(() => lockIn(fresh(), CASE, INVESTIGATOR, "D1")).toThrow();
    expect(() => lockIn(fresh(), CASE, INVESTIGATOR, "I4")).toThrow(); // a Part 2 card, not available in Part 1
  });

  it("only transitions to REVEALED once both roles have locked in", () => {
    const afterFirst = lockIn(fresh(), CASE, INVESTIGATOR, "I1");
    expect(afterFirst.phase).toBe("SELECTING");
    expect(afterFirst.locks).toEqual({ p1: "I1" });
    const afterSecond = lockIn(afterFirst, CASE, DEFENDANT, "D1");
    expect(afterSecond.phase).toBe("REVEALED");
  });

  it("resolves the correct pair as solved, with no flags and solvedOnFirstTry", () => {
    const revealed = lockIn(lockIn(fresh(), CASE, INVESTIGATOR, "I1"), CASE, DEFENDANT, "D1");
    expect(revealed.lastReveal).toEqual({ outcome: "solved", investigatorCardId: "I1", defendantCardId: "D1", solvedOnFirstTry: true });
    expect(revealed.log).toEqual([{ partIndex: 0, investigatorCard: "I1", defendantCard: "D1", outcome: "solved", trustFlags: 0, focusFlags: 0 }]);
    expect(revealed.attempts).toBe(0); // a solve isn't a miss
  });

  it("resolves the documented Part 1 trap pair with a Trust flag from the investigator's card only", () => {
    const revealed = lockIn(lockIn(fresh(), CASE, INVESTIGATOR, "I2"), CASE, DEFENDANT, "D2");
    expect(revealed.lastReveal?.outcome).toBe("retry"); // 1st miss, not the judge yet
    expect(revealed.attempts).toBe(1);
    const entry = revealed.log[0];
    expect(entry.outcome).toBe("trap");
    // I2 contradicts P1-D2 (defendant's own-Part fact) -> Trust flag.
    // D2 contradicts P1-D2 too, but that's Defendant's OWN screen/Part -> no flag.
    expect(entry.trustFlags).toBe(1);
    expect(entry.focusFlags).toBe(0);
  });

  it("resolves a non-trap wrong pair as 'wrong', not 'trap'", () => {
    const revealed = lockIn(lockIn(fresh(), CASE, INVESTIGATOR, "I3"), CASE, DEFENDANT, "D3");
    expect(revealed.log[0].outcome).toBe("wrong");
  });

  it("running out of the case-wide budget on an EARLIER Part is 'adjourned' - no correct pair is revealed, just what was actually played", () => {
    let game = lockIn(lockIn(fresh(), CASE, INVESTIGATOR, "I2"), CASE, DEFENDANT, "D2"); // miss 1
    game = continueAfterReveal(game, CASE);
    game = lockIn(lockIn(game, CASE, INVESTIGATOR, "I3"), CASE, DEFENDANT, "D3"); // miss 2
    expect(game.lastReveal?.outcome).toBe("retry"); // still 1 try left - not adjourned yet
    game = continueAfterReveal(game, CASE);
    game = lockIn(lockIn(game, CASE, INVESTIGATOR, "I2"), CASE, DEFENDANT, "D2"); // miss 3 - replaying the same wrong pair is fine
    expect(game.attempts).toBe(3);
    expect(game.partIndex).toBe(0); // still Part 1 - this budget ran out well before the last Part
    // Shows what was actually played (I2/D2), NOT the correct pair (I1/D1) - unlike the last-Part case below.
    expect(game.lastReveal).toEqual({ outcome: "adjourned", investigatorCardId: "I2", defendantCardId: "D2" });
    expect(game.log[2].outcome).toBe("adjourned");
  });

  it("running out of the case-wide budget on the LAST Part is 'judgeRevealed' - the correct pair IS shown on the way out", () => {
    // Fast-forward to Part 3 (the last) by solving Parts 1 and 2 on the first try.
    let game = fresh();
    game = continueAfterReveal(lockIn(lockIn(game, CASE, INVESTIGATOR, "I1"), CASE, DEFENDANT, "D1"), CASE);
    game = continueAfterReveal(lockIn(lockIn(game, CASE, INVESTIGATOR, "I5"), CASE, DEFENDANT, "D4"), CASE);
    expect(game.partIndex).toBe(2);

    game = lockIn(lockIn(game, CASE, INVESTIGATOR, "I8"), CASE, DEFENDANT, "D8"); // miss 1
    game = continueAfterReveal(game, CASE);
    game = lockIn(lockIn(game, CASE, INVESTIGATOR, "I9"), CASE, DEFENDANT, "D9"); // miss 2
    game = continueAfterReveal(game, CASE);
    game = lockIn(lockIn(game, CASE, INVESTIGATOR, "I8"), CASE, DEFENDANT, "D8"); // miss 3
    expect(game.attempts).toBe(3);
    expect(game.lastReveal).toEqual({ outcome: "judgeRevealed", investigatorCardId: "I7", defendantCardId: "D7" });
    expect(game.log.at(-1)?.outcome).toBe("judgeRevealed");
  });

  it("computes a Focus flag for a card contradicting an earlier Part's fact (the documented Part 3 memory lures)", () => {
    // Fast-forward to Part 3 by solving Parts 1 and 2 on the first try.
    let game = fresh();
    game = continueAfterReveal(lockIn(lockIn(game, CASE, INVESTIGATOR, "I1"), CASE, DEFENDANT, "D1"), CASE);
    game = continueAfterReveal(lockIn(lockIn(game, CASE, INVESTIGATOR, "I5"), CASE, DEFENDANT, "D4"), CASE);
    expect(game.partIndex).toBe(2);

    const revealed = lockIn(lockIn(game, CASE, INVESTIGATOR, "I9"), CASE, DEFENDANT, "D9");
    const entry = revealed.log.at(-1)!;
    // I9 contradicts P2-D2 (Part 2, earlier) -> Focus. D9 contradicts P2-D1 (Part 2, earlier) -> Focus.
    expect(entry.trustFlags).toBe(0);
    expect(entry.focusFlags).toBe(2);
  });

  it("accumulates misses across Parts rather than resetting per Part, and the judge can trigger on the very first miss of a later Part", () => {
    // Part 1: one miss, then solve (1 total miss used, 2 remaining).
    let game = lockIn(lockIn(fresh(), CASE, INVESTIGATOR, "I2"), CASE, DEFENDANT, "D2");
    expect(game.attempts).toBe(1);
    game = continueAfterReveal(game, CASE);
    game = continueAfterReveal(lockIn(lockIn(game, CASE, INVESTIGATOR, "I1"), CASE, DEFENDANT, "D1"), CASE);
    expect(game.partIndex).toBe(1);
    expect(game.attempts).toBe(1); // carried over, not reset by advancing to Part 2

    // Part 2: one miss (2 total used, 1 remaining) - still a retry, not the judge.
    game = lockIn(lockIn(game, CASE, INVESTIGATOR, "I4"), CASE, DEFENDANT, "D5");
    expect(game.attempts).toBe(2);
    expect(game.lastReveal?.outcome).toBe("retry");
    game = continueAfterReveal(game, CASE);
    game = continueAfterReveal(lockIn(lockIn(game, CASE, INVESTIGATOR, "I5"), CASE, DEFENDANT, "D4"), CASE);
    expect(game.partIndex).toBe(2);
    expect(game.attempts).toBe(2); // still carried over

    // Part 3: the very FIRST miss here is the 3rd total miss - the judge
    // reveals immediately, with no retry offered for this Part at all.
    game = lockIn(lockIn(game, CASE, INVESTIGATOR, "I8"), CASE, DEFENDANT, "D8");
    expect(game.attempts).toBe(3);
    expect(game.lastReveal).toEqual({ outcome: "judgeRevealed", investigatorCardId: "I7", defendantCardId: "D7" });
  });
});

describe("continueAfterReveal", () => {
  it("rejects continuing while not REVEALED", () => {
    expect(() => continueAfterReveal(fresh(), CASE)).toThrow();
  });

  it("a retry clears the locks and returns to SELECTING, keeping the attempt count", () => {
    const afterMiss = lockIn(lockIn(fresh(), CASE, INVESTIGATOR, "I2"), CASE, DEFENDANT, "D2");
    const retried = continueAfterReveal(afterMiss, CASE);
    expect(retried.phase).toBe("SELECTING");
    expect(retried.locks).toEqual({});
    expect(retried.attempts).toBe(1);
    expect(retried.partIndex).toBe(0);
  });

  it("a solved Part advances to the next Part, resetting locks but NOT the case-wide attempt count", () => {
    const solved = lockIn(lockIn(fresh(), CASE, INVESTIGATOR, "I1"), CASE, DEFENDANT, "D1");
    const next = continueAfterReveal(solved, CASE);
    expect(next.phase).toBe("SELECTING");
    expect(next.partIndex).toBe(1);
    expect(next.attempts).toBe(0); // zero misses so far in this playthrough, so still 0 - see the dedicated cross-Part test above for the carry-over behavior itself
    expect(next.locks).toEqual({});
  });

  it("solving the last Part goes to CASE_DONE instead of a Part 4", () => {
    let game = fresh();
    game = continueAfterReveal(lockIn(lockIn(game, CASE, INVESTIGATOR, "I1"), CASE, DEFENDANT, "D1"), CASE);
    game = continueAfterReveal(lockIn(lockIn(game, CASE, INVESTIGATOR, "I5"), CASE, DEFENDANT, "D4"), CASE);
    game = lockIn(lockIn(game, CASE, INVESTIGATOR, "I7"), CASE, DEFENDANT, "D7");
    expect(game.phase).toBe("REVEALED");
    expect(game.lastReveal?.outcome).toBe("solved");
    const done = continueAfterReveal(game, CASE);
    expect(done.phase).toBe("CASE_DONE");
    expect(done.partIndex).toBe(2); // unchanged - there is no Part 4 to advance to
  });

  it("running out of the budget on an EARLIER Part ends the case immediately, skipping the remaining Parts entirely", () => {
    let game = lockIn(lockIn(fresh(), CASE, INVESTIGATOR, "I2"), CASE, DEFENDANT, "D2"); // miss 1
    game = continueAfterReveal(game, CASE);
    game = lockIn(lockIn(game, CASE, INVESTIGATOR, "I3"), CASE, DEFENDANT, "D3"); // miss 2
    game = continueAfterReveal(game, CASE);
    game = lockIn(lockIn(game, CASE, INVESTIGATOR, "I2"), CASE, DEFENDANT, "D2"); // miss 3 - budget exhausted on Part 1
    expect(game.lastReveal?.outcome).toBe("adjourned");
    const done = continueAfterReveal(game, CASE);
    expect(done.phase).toBe("CASE_DONE");
    expect(done.partIndex).toBe(0); // never advanced past Part 1
    expect(done.log.at(-1)?.outcome).toBe("adjourned");
  });

  it("running out of the budget on the LAST Part also ends the case (same as today's solved-on-the-last-Part path)", () => {
    let game = fresh();
    game = continueAfterReveal(lockIn(lockIn(game, CASE, INVESTIGATOR, "I1"), CASE, DEFENDANT, "D1"), CASE);
    game = continueAfterReveal(lockIn(lockIn(game, CASE, INVESTIGATOR, "I5"), CASE, DEFENDANT, "D4"), CASE);
    game = continueAfterReveal(lockIn(lockIn(game, CASE, INVESTIGATOR, "I8"), CASE, DEFENDANT, "D8"), CASE); // miss 1
    game = continueAfterReveal(lockIn(lockIn(game, CASE, INVESTIGATOR, "I9"), CASE, DEFENDANT, "D9"), CASE); // miss 2
    game = lockIn(lockIn(game, CASE, INVESTIGATOR, "I8"), CASE, DEFENDANT, "D8"); // miss 3 - budget exhausted on the last Part
    expect(game.lastReveal?.outcome).toBe("judgeRevealed");
    const done = continueAfterReveal(game, CASE);
    expect(done.phase).toBe("CASE_DONE");
    expect(done.partIndex).toBe(2);
    expect(done.log.at(-1)?.outcome).toBe("judgeRevealed");
  });

  it("does not write an explicit undefined lastReveal (Firebase rejects that) - the key is simply absent", () => {
    const solved = lockIn(lockIn(fresh(), CASE, INVESTIGATOR, "I1"), CASE, DEFENDANT, "D1");
    const next = continueAfterReveal(solved, CASE);
    expect(Object.prototype.hasOwnProperty.call(next, "lastReveal")).toBe(false);
  });
});

describe("scoring", () => {
  it("trustPercent/focusPercent are 100 with no lock-ins yet", () => {
    expect(trustPercent([])).toBe(100);
    expect(trustPercent(undefined)).toBe(100);
    expect(focusPercent([])).toBe(100);
    expect(focusPercent(undefined)).toBe(100);
  });

  it("trustPercent counts flags over every lock-in; focusPercent only counts Part 2+ lock-ins", () => {
    const log = [
      { partIndex: 0, investigatorCard: "I2", defendantCard: "D2", outcome: "trap" as const, trustFlags: 1, focusFlags: 0 },
      { partIndex: 0, investigatorCard: "I1", defendantCard: "D1", outcome: "solved" as const, trustFlags: 0, focusFlags: 0 },
      { partIndex: 2, investigatorCard: "I9", defendantCard: "D9", outcome: "trap" as const, trustFlags: 0, focusFlags: 2 },
    ];
    expect(trustPercent(log)).toBeCloseTo((100 * (1 - 1 / 3)));
    // only the Part-2 (index 2) entry counts toward the focus denominator: 2
    // flags on 1 lock-in is a raw formula result of 100*(1-2/1) = -100,
    // which the function clamps to 0 rather than showing a negative percent.
    expect(focusPercent(log)).toBe(0);
  });

  it("totalAttempts is just the log length", () => {
    expect(totalAttempts(undefined)).toBe(0);
    expect(totalAttempts([{ partIndex: 0, investigatorCard: "I1", defendantCard: "D1", outcome: "solved", trustFlags: 0, focusFlags: 0 }])).toBe(1);
  });

  it("classifies the duo per the documented table, evaluated top to bottom", () => {
    expect(classifyDuo(95, 95)).toBe("Mind-Reading Team");
    expect(classifyDuo(95, 50)).toBe("Loyal, Slightly Forgetful");
    expect(classifyDuo(50, 95)).toBe("Sharp, Slightly Suspicious");
    expect(classifyDuo(75, 80)).toBe("Solid Partners");
    expect(classifyDuo(50, 50)).toBe("Still Learning Each Other");
  });
});

describe("a full clean playthrough of the shipped case", () => {
  it("solving every Part on the first try reaches CASE_DONE with a perfect score", () => {
    let game = fresh();
    game = continueAfterReveal(lockIn(lockIn(game, CASE, INVESTIGATOR, "I1"), CASE, DEFENDANT, "D1"), CASE);
    game = continueAfterReveal(lockIn(lockIn(game, CASE, INVESTIGATOR, "I5"), CASE, DEFENDANT, "D4"), CASE);
    game = continueAfterReveal(lockIn(lockIn(game, CASE, INVESTIGATOR, "I7"), CASE, DEFENDANT, "D7"), CASE);

    expect(game.phase).toBe("CASE_DONE");
    expect(game.log).toHaveLength(3);
    expect(trustPercent(game.log)).toBe(100);
    expect(focusPercent(game.log)).toBe(100);
    expect(totalAttempts(game.log)).toBe(3);
    expect(classifyDuo(trustPercent(game.log), focusPercent(game.log))).toBe("Mind-Reading Team");
  });
});

describe("every shipped case", () => {
  it.each(Object.keys(CASES))("%s can be played through, first try, to a perfect score", (id) => {
    const caseDef = getCase(id);
    let game = newGame(id);
    for (const part of caseDef.parts) {
      game = lockIn(game, caseDef, INVESTIGATOR, part.correct[0]);
      game = lockIn(game, caseDef, DEFENDANT, part.correct[1]);
      expect(game.lastReveal?.outcome).toBe("solved");
      game = continueAfterReveal(game, caseDef);
    }
    expect(game.phase).toBe("CASE_DONE");
    expect(game.log).toHaveLength(caseDef.parts.length);
    expect(trustPercent(game.log)).toBe(100);
    expect(focusPercent(game.log)).toBe(100);
  });
});

describe("writes Firebase accepts", () => {
  // Each transition gets the state as Firebase hands it back (empty objects
  // and arrays dropped, so `names`, `locks` and `log` can read back missing).
  // A result with an explicit `undefined` makes the real write throw, and the
  // move silently does nothing - this is how "Continue to Part 2" once broke.
  const asStored = (state: GameState): GameState => pruneLikeFirebase(state) as GameState;
  const expectWritable = (step: string, state: GameState) =>
    expect({ step, undefinedAt: undefinedPaths(state) }).toEqual({ step, undefinedAt: [] });

  it("never produces an explicit undefined across a whole case, including a miss", () => {
    let game = asStored(newGame(CASE.id));
    CASE.parts.forEach((part, i) => {
      if (i === 0) {
        const wrong = part.hands.defendant.find((c) => c.id !== part.correct[1])!.id;
        for (const [step, apply] of [
          ["lock (miss) p1", (g: GameState) => lockIn(g, CASE, INVESTIGATOR, part.correct[0])],
          ["lock (miss) p2", (g: GameState) => lockIn(g, CASE, DEFENDANT, wrong)],
          ["continue after retry", (g: GameState) => continueAfterReveal(g, CASE)],
        ] as const) {
          const next = apply(game);
          expectWritable(`Part ${i + 1}: ${step}`, next);
          game = asStored(next);
        }
      }
      for (const [step, apply] of [
        ["lock p1", (g: GameState) => lockIn(g, CASE, INVESTIGATOR, part.correct[0])],
        ["lock p2", (g: GameState) => lockIn(g, CASE, DEFENDANT, part.correct[1])],
        ["continue", (g: GameState) => continueAfterReveal(g, CASE)],
      ] as const) {
        const next = apply(game);
        expectWritable(`Part ${i + 1}: ${step}`, next);
        game = asStored(next);
      }
    });
    expect(game.phase).toBe("CASE_DONE");
  });
});
