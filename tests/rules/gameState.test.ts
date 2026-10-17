/**
 * Game-state .validate rules (spec §8). Valid states come from each game's
 * real state machine - a full round of First to Worst and a whole
 * Co-Counsel case, written one transition at a time - so the rules are
 * checked against what the app actually writes, not a hand-built fixture.
 */
import { assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { lockIn as ftwLockIn, newGame as newFtwGame, nextRound, setPlaced, setPrompt, submitGuess } from "@/lib/games/ftw/game";
import { customRound, randomRound } from "@/lib/games/ftw/prompts";
import { continueAfterReveal, lockIn as ccLockIn, newGame as newCcGame } from "@/lib/games/cocounsel/game";
import { getCase } from "@/lib/games/cocounsel/cases";
import { cocounselState, dbAs, ftwState, ROOM, seedRoom, setupEnv } from "./helpers";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await setupEnv("demo-rules-games");
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearDatabase();
});

/**
 * Writes a state exactly as the app produced it, then reads it back - the
 * real Firebase round trip (empty objects and arrays come back missing). The
 * next transition gets that read-back state, as in the app. An explicit
 * `undefined` in a state makes the SDK's write throw, failing the test.
 */
async function writeAndReadBack<T>(db: ReturnType<typeof dbAs>, path: string, state: T): Promise<T> {
  await assertSucceeds(db.ref(path).set(state));
  return (await db.ref(path).get()).val() as T;
}

describe("First to Worst", () => {
  const path = `games/${ROOM}/ftw`;
  beforeEach(async () => {
    await seedRoom(env, { creator: "alice", seated: ["alice", "bob"] });
  });

  it("accepts every state of a real game, including a custom prompt and live placement progress", async () => {
    const db = dbAs(env, "alice");
    const write = <T,>(state: T) => writeAndReadBack(db, path, state);
    let game = await write(newFtwGame(randomRound()));
    game = await write(setPrompt(game, customRound("My very own prompt", ["One", "Two", "Three", "Four", "Five"])));
    const ids = game.current.items.map((i) => i.id);
    for (let n = 1; n <= ids.length; n++) game = await write(setPlaced(game, "RANKING", ids.slice(0, n)));
    game = await write(setPlaced(game, "RANKING", ids.slice(1))); // a card picked back up
    game = await write(ftwLockIn(game, ids));
    game = await write(setPlaced(game, "GUESSING", ids.slice(0, 2)));
    game = await write(submitGuess(game, [...ids].reverse()));
    game = await write(nextRound(game, randomRound(game.usedPrompts)));
    game = await write(ftwLockIn(game, game.current.items.map((i) => i.id)));
  });

  it.each([
    ["4 items", ftwState({ current: { ...ftwState().current, items: ftwState().current.items.slice(0, 4) } })],
    ["6 items", ftwState({ current: { ...ftwState().current, items: [...ftwState().current.items, { id: "x", label: "x" }] } })],
    ["an unknown top-level key", ftwState({ cheat: true })],
    ["an unknown round key", ftwState({ current: { ...ftwState().current, peek: "x" } })],
    ["a bad status", ftwState({ current: { ...ftwState().current, status: "DONE" } })],
    ["a prompt over 120 chars", ftwState({ current: { ...ftwState().current, prompt: "x".repeat(121) } })],
    ["a string score total", ftwState({ totals: { p1: "10", p2: 0 } })],
    ["a third player's total", ftwState({ totals: { p1: 0, p2: 0, p3: 0 } })],
    ["a history row for p3", ftwState({ history: [{ round: 1, prompt: "x", score: 1, master: "p3" }] })],
    ["a 4-card master order", ftwState({ current: { ...ftwState().current, masterOrder: ["a", "b", "c", "d"] } })],
    ["a missing round", (() => { const s: Record<string, unknown> = ftwState(); delete s.round; return s; })()],
    ["placement progress with a 6th slot", ftwState({ current: { ...ftwState().current, placed: ["a", "b", "c", "d", "e", "f"] } })],
    ["placement progress carrying numbers", ftwState({ current: { ...ftwState().current, placed: [3, 1] } })],
  ])("rejects %s", async (_, state) => {
    await assertFails(dbAs(env, "alice").ref(path).set(state));
  });
});

describe("Co-Counsel", () => {
  const path = `games/${ROOM}/cocounsel`;
  const caseDef = getCase("ruined-birthday");
  beforeEach(async () => {
    await seedRoom(env, { creator: "alice", seated: ["alice", "bob"], gameSlug: "cocounsel" });
  });

  it("accepts every state of a real case, including a miss", async () => {
    const db = dbAs(env, "alice");
    const write = <T,>(state: T) => writeAndReadBack(db, path, state);
    let game = await write(newCcGame(caseDef.id));
    for (const [i, part] of caseDef.parts.entries()) {
      if (i === 0) {
        const wrong = part.hands.defendant.find((c) => c.id !== part.correct[1])!.id;
        game = await write(ccLockIn(game, caseDef, "p1", part.correct[0]));
        game = await write(ccLockIn(game, caseDef, "p2", wrong));
        game = await write(continueAfterReveal(game, caseDef));
      }
      game = await write(ccLockIn(game, caseDef, "p1", part.correct[0]));
      game = await write(ccLockIn(game, caseDef, "p2", part.correct[1]));
      game = await write(continueAfterReveal(game, caseDef)); // includes "Continue to Part 2"
    }
    expect(game.phase).toBe("CASE_DONE");
  });

  it("accepts the in-between states (one lock, a pending reveal)", async () => {
    const db = dbAs(env, "alice");
    const write = <T,>(state: T) => writeAndReadBack(db, path, state);
    const part = caseDef.parts[0];
    let game = await write(ccLockIn(newCcGame(caseDef.id), caseDef, "p1", part.correct[0]));
    game = await write(ccLockIn(game, caseDef, "p2", part.correct[1]));
    expect(game.phase).toBe("REVEALED");
  });

  it.each([
    ["a bad phase", cocounselState({ phase: "WON" })],
    ["a lock for p3", cocounselState({ locks: { p3: "I1" } })],
    ["a bad log outcome", cocounselState({ log: [{ partIndex: 0, investigatorCard: "I1", defendantCard: "D1", outcome: "cheated", trustFlags: 0, focusFlags: 0 }] })],
    ["an unknown key", cocounselState({ score: 100 })],
    ["a string attempts count", cocounselState({ attempts: "0" })],
    ["a reveal with no cards", cocounselState({ lastReveal: { outcome: "solved" } })],
  ])("rejects %s", async (_, state) => {
    await assertFails(dbAs(env, "alice").ref(path).set(state));
  });
});
