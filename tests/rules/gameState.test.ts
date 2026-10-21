/**
 * Game-state .validate rules (spec §8). Valid states come from each game's
 * real state machine - a full round of First to Worst and a whole
 * Co-Counsel case, a Night Highway race series, written one transition at a time - so the rules are
 * checked against what the app actually writes, not a hand-built fixture.
 */
import { assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { lockIn as ftwLockIn, masterOf, newGame as newFtwGame, nextRound, setPlaced, setPrompt, setTopics, submitGuess } from "@/lib/games/ftw/game";
import { customRound, randomRound, TOPICS } from "@/lib/games/ftw/prompts";
import { continueAfterReveal, lockIn as ccLockIn, newGame as newCcGame } from "@/lib/games/cocounsel/game";
import { CASES, getCase } from "@/lib/games/cocounsel/cases";
import { giveUpOnMissingResults, newGame as newNhGame, type RunResult, setOptions, setReady, submitResult } from "@/lib/games/nighthighway/game";
import * as quiz from "@/lib/games/buzzerquiz/game";
import * as ws from "@/lib/games/wordscramble/game";
import { RESULT_MS as WS_RESULT_MS, SCOREBOARD_MS, START_LEAD_MS, STEAL_MS, STEAL_OFFER_MS, TURN_MS } from "@/lib/games/wordscramble/constants";
import { ANSWER_MS, BUZZ_WINDOW_MS, COUNTDOWN_MS, QUESTION_MS, RESULT_MS } from "@/lib/games/buzzerquiz/constants";
import { buzzerquizState, cocounselState, wordscrambleState, dbAs, ftwState, nighthighwayState, ROOM, seedRoom, setupEnv } from "./helpers";

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
    // Topics: a few, the longest names, all but one (the most there can be), then back to every topic.
    game = await write(setTopics(game, masterOf(game.round), [TOPICS[0], TOPICS[5]], TOPICS));
    game = await write(setTopics(game, masterOf(game.round), [...TOPICS].sort((a, b) => b.length - a.length).slice(0, 3), TOPICS));
    game = await write(setTopics(game, masterOf(game.round), TOPICS.slice(1), TOPICS));
    game = await write(submitGuess(game, game.current.items.map((i) => i.id)));
    game = await write(nextRound(game, randomRound(game.usedPrompts, game.topics)));
    await write(setTopics(game, masterOf(game.round), [], TOPICS));
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
    ["a topic over 60 chars", ftwState({ topics: ["x".repeat(61)] })],
    ["a topic that isn't text", ftwState({ topics: [7] })],
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

  it.each(Object.keys(CASES))("accepts every state of case %s, including a miss", async (id) => {
    const caseDef = getCase(id);
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

describe("Night Highway", () => {
  const path = `games/${ROOM}/nighthighway`;
  const run = (score: number): RunResult => ({ score, distance: 3120, top: 291, avg: 187, nearMiss: 6, overtakes: 41, crashes: 2 });
  beforeEach(async () => {
    await seedRoom(env, { creator: "alice", seated: ["alice", "bob"], gameSlug: "nighthighway" });
  });

  it("accepts every state of a real race series, including a race given up on", async () => {
    const db = dbAs(env, "alice");
    const write = <T,>(state: T) => writeAndReadBack(db, path, state);
    const now = Date.now();
    let game = await write(newNhGame());
    game = await write(setOptions(game, { rain: true }));
    game = await write(setOptions(game, { pickups: false }));
    game = await write(setOptions(game, { desert: true }));
    game = await write(setReady(game, "p1", true, now, 11));
    game = await write(setReady(game, "p1", false, now, 11));
    game = await write(setReady(game, "p2", true, now, 11));
    game = await write(setReady(game, "p1", true, now, 4242));
    expect(game.phase).toBe("RACING");
    game = await write(submitResult(game, "p2", run(14250)));
    game = await write(submitResult(game, "p1", run(9800)));
    expect(game.phase).toBe("DONE");
    game = await write(setReady(setReady(game, "p1", true, now, 1), "p2", true, now, 99));
    game = await write(submitResult(game, "p1", run(300)));
    game = await write(giveUpOnMissingResults(game, now + 60 * 60 * 1000));
    expect(game.history).toHaveLength(2);
  });

  it.each([
    ["a bad phase", nighthighwayState({ phase: "PAUSED" })],
    ["no wins", (() => { const s: Record<string, unknown> = nighthighwayState(); delete s.wins; return s; })()],
    ["a ready flag for p3", nighthighwayState({ ready: { p3: true } })],
    ["a ready flag that isn't true", nighthighwayState({ ready: { p1: "yes" } })],
    ["a string seed", nighthighwayState({ seed: "abc" })],
    ["a result missing a field", nighthighwayState({ results: { p1: { score: 1 } } })],
    ["a result with an extra field", nighthighwayState({ results: { p1: { ...run(1), lapTime: 3 } } })],
    ["a bad winner", nighthighwayState({ history: [{ race: 1, scores: { p1: 1 }, winner: "p3" }] })],
    ["an unknown key", nighthighwayState({ cheats: true })],
    ["a string option", nighthighwayState({ options: { rain: "yes", pickups: true } })],
    ["an unknown option", nighthighwayState({ options: { rain: false, pickups: true, turbo: true } })],
    ["a string circuit", nighthighwayState({ options: { rain: false, pickups: true, desert: "yes" } })],
  ])("rejects %s", async (_, state) => {
    await assertFails(dbAs(env, "alice").ref(path).set(state));
  });
});

describe("Night Highway live cars", () => {
  const car = (overrides: Record<string, unknown> = {}) => ({ race: 1, t: 1500, s: 46.5, x: -1.8, v: 31, score: 0, paint: 2, ...overrides });
  beforeEach(async () => {
    await seedRoom(env, { creator: "alice", seated: ["alice", "bob"], gameSlug: "nighthighway" });
  });

  it("lets each player write and clear only their own car", async () => {
    await assertSucceeds(dbAs(env, "alice").ref(`games/${ROOM}/nighthighwayCars/p1`).set(car()));
    await assertSucceeds(dbAs(env, "bob").ref(`games/${ROOM}/nighthighwayCars/p2`).set(car()));
    await assertFails(dbAs(env, "alice").ref(`games/${ROOM}/nighthighwayCars/p2`).set(car()));
    await assertFails(dbAs(env, "carol").ref(`games/${ROOM}/nighthighwayCars/p1`).set(car()));
    await assertSucceeds(dbAs(env, "alice").ref(`games/${ROOM}/nighthighwayCars/p1`).remove());
  });

  it.each([
    ["a missing field", (() => { const c: Record<string, unknown> = car(); delete c.s; return c; })()],
    ["an extra field", car({ boost: 1 })],
    ["a string position", car({ s: "46" })],
  ])("rejects %s", async (_, value) => {
    await assertFails(dbAs(env, "alice").ref(`games/${ROOM}/nighthighwayCars/p1`).set(value));
  });

  it("is refused in a room of another game", async () => {
    await seedRoom(env, { creator: "alice", seated: ["alice", "bob"], room: "zzz234" });
    await assertFails(dbAs(env, "alice").ref("games/zzz234/nighthighwayCars/p1").set(car()));
  });
});

describe("Buzzer Quiz", () => {
  const path = `games/${ROOM}/buzzerquiz`;
  beforeEach(async () => {
    await seedRoom(env, { creator: "alice", seated: ["alice", "bob", "carol"], gameSlug: "buzzerquiz", maxPlayers: 4 });
  });

  it("accepts every state of a real game", async () => {
    const db = dbAs(env, "bob");
    const write = (state: quiz.QuizState) => writeAndReadBack(db, path, state);
    const ids = Array.from({ length: 5 }, (_, i) => `sci-en-${i}`);
    let t = 1_000_000;
    let game = await write(quiz.newGame("fr"));
    game = await write(quiz.toggleTopic(quiz.toggleTopic(game, "music"), "science"));
    game = await write(quiz.setLength(quiz.setLang(game, "en"), 5));
    game = await write(quiz.toLobby(game));
    game = await write(quiz.start(game, { players: ["p1", "p2", "p3"], questionIds: ids, seed: 12345, now: t }));
    // Question 1: two buzz, the faster wins and answers wrong; the next answers right.
    t += COUNTDOWN_MS;
    game = await write(quiz.reveal(game, t));
    game = await write(quiz.buzz(game, "p2", 800, t + 800));
    game = await write(quiz.buzz(game, "p1", 650, t + 900));
    t += 800 + BUZZ_WINDOW_MS;
    game = await write(quiz.resolveBuzz(game, t));
    expect(game.buzzer).toBe("p1");
    game = await write(quiz.pick(game, "p1", 3, t + 1000));
    expect(game.struck).toEqual([3]);
    t += 1500;
    game = await write(quiz.resolveBuzz(await write(quiz.buzz(game, "p3", 300, t)), t + BUZZ_WINDOW_MS));
    game = await write(quiz.pick(game, "p3", 0, t + 1000));
    expect(game.outcome).toEqual({ kind: "right", seat: "p3", points: 2 });
    t += 1000 + RESULT_MS;
    game = await write(quiz.next(game, t));
    // Question 2: the buzzer doesn't answer in time, then it times out.
    t += COUNTDOWN_MS;
    game = await write(quiz.reveal(game, t));
    game = await write(quiz.resolveBuzz(await write(quiz.buzz(game, "p2", 400, t + 400)), t + 400 + BUZZ_WINDOW_MS));
    t += 400 + BUZZ_WINDOW_MS + ANSWER_MS;
    game = await write(quiz.answerTimeout(game, t));
    expect(game.timeLeft).toBeUndefined();
    game = await write(quiz.questionTimeout(game, t + QUESTION_MS));
    expect(game.outcome).toEqual({ kind: "none", reason: "timeout" });
    // Questions 3-5 time out, then the final ranking, a rematch and New topics.
    t += QUESTION_MS + RESULT_MS;
    game = await write(quiz.next(game, t));
    for (let i = 0; i < 3; i++) {
      t += COUNTDOWN_MS;
      game = await write(quiz.reveal(game, t));
      t += QUESTION_MS;
      game = await write(quiz.questionTimeout(game, t));
      t += RESULT_MS;
      game = await write(quiz.next(game, t));
    }
    expect(game.phase).toBe("final");
    expect(game.scores).toEqual({ p1: 0, p2: 0, p3: 2 });
    game = await write(quiz.rematch(game, { players: ["p1", "p2", "p3", "p4"], questionIds: ids, seed: 9, now: t }));
    game = await write(quiz.newTopics({ ...game, phase: "final" }));
    expect(game.phase).toBe("setup");
  });

  it.each([
    ["a bad phase", buzzerquizState({ phase: "paused" })],
    ["an unknown language", buzzerquizState({ settings: { lang: "de", length: 10 } })],
    ["an unknown length", buzzerquizState({ settings: { lang: "en", length: 12 } })],
    ["an unknown topic", buzzerquizState({ settings: { lang: "en", length: 10, topics: ["cooking"] } })],
    ["a fifth player", buzzerquizState({ players: ["p1", "p2", "p3", "p4", "p5"] })],
    ["a seat that doesn't exist", buzzerquizState({ buzzer: "p5" })],
    ["a negative reaction time", buzzerquizState({ buzzes: [{ seat: "p1", ms: -1 }] })],
    ["the right answer struck", buzzerquizState({ struck: [0] })],
    ["too many points", buzzerquizState({ outcome: { kind: "right", seat: "p1", points: 4 } })],
    ["an outcome without its reason", buzzerquizState({ outcome: { kind: "none" } })],
    ["a negative score", buzzerquizState({ scores: { p1: -1 } })],
    ["a missing seed", { phase: "setup", settings: { lang: "en", length: 10 }, index: 0, round: 0 }],
    ["an unknown key", buzzerquizState({ host: "p1" })],
  ])("rejects %s", async (_, state) => {
    await assertFails(dbAs(env, "alice").ref(path).set(state));
  });

  it("lets only the room's members write", async () => {
    await assertFails(dbAs(env, "dave").ref(path).set(buzzerquizState()));
  });
});

describe("Word Scramble", () => {
  const path = `games/${ROOM}/wordscramble`;
  const SEATED = ["p1", "p2", "p3", "p4"];
  beforeEach(async () => {
    await seedRoom(env, { creator: "alice", seated: ["alice", "bob", "carol", "dave"], gameSlug: "wordscramble", maxPlayers: 8 });
  });

  it("accepts every state of a real game", async () => {
    const db = dbAs(env, "carol");
    const write = (state: ws.ScrambleState) => writeAndReadBack(db, path, state);
    let t = 1_000_000;
    let game = await write(ws.newGame("fr"));
    game = await write(ws.setTurnsPerTeam(ws.setMode(ws.setLang(game, "en"), "turns"), 3));
    game = await write(ws.setTarget(game, 40));
    for (const [seat, team] of [["p1", "A"], ["p2", "B"], ["p3", "A"], ["p4", "B"]] as const) game = await write(ws.pickTeam(game, seat, team));
    game = await write(ws.start(game, { seated: SEATED, next: { wordId: "en-001", seed: 1 }, now: t }));
    t += START_LEAD_MS;
    // Team A: a wrong guess, a hint, then the right word.
    game = await write(ws.guess(game, "p3", "drib", "bird", t + 2000));
    game = await write(ws.hint(game, "p1", "bird", t + 3000));
    game = await write(ws.guess(game, "p1", "bird", "bird", t + 4000));
    expect(game.scores).toEqual({ A: 3, B: 0 });
    t += 4000 + WS_RESULT_MS;
    game = await write(ws.afterResult(game, t));
    t += SCOREBOARD_MS;
    game = await write(ws.nextTurn(game, { wordId: "en-002", seed: 2 }, t));
    // Team B runs out of time, and Team A steals "fish" right: +2.
    t += TURN_MS;
    game = await write(ws.timeUp(game, t));
    game = await write(ws.claimSteal(game, "p3", t + 1000));
    game = await write(ws.stealGuess(game, "p3", "fish", "fish", t + 3000));
    expect(game.scores).toEqual({ A: 5, B: 0 });
    t += 3000 + WS_RESULT_MS;
    game = await write(ws.afterResult(game, t));
    t += SCOREBOARD_MS;
    game = await write(ws.nextTurn(game, { wordId: "en-003", seed: 3 }, t));
    // Team A runs out of time, and Team B's steal runs out too: -2, below zero.
    t += TURN_MS;
    game = await write(ws.timeUp(game, t));
    game = await write(ws.claimSteal(game, "p2", t));
    t += STEAL_MS;
    game = await write(ws.stealTimeout(game, "lamp", t));
    expect(game.scores).toEqual({ A: 5, B: -2 });
    t += WS_RESULT_MS;
    game = await write(ws.afterResult(game, t));
    t += SCOREBOARD_MS;
    game = await write(ws.nextTurn(game, { wordId: "en-004", seed: 4 }, t));
    // The rest of the game runs out of time, and nobody steals.
    for (let turn = 3; turn < 6; turn++) {
      t += TURN_MS;
      game = await write(ws.timeUp(game, t));
      t += STEAL_OFFER_MS;
      game = await write(ws.noSteal(game, t));
      t += WS_RESULT_MS;
      game = await write(ws.afterResult(game, t));
      if (game.phase === "end") break;
      t += SCOREBOARD_MS;
      game = await write(ws.nextTurn(game, { wordId: `en-${100 + turn}`, seed: turn }, t));
    }
    expect(game.phase).toBe("end");
    game = await write(ws.shuffle(game, SEATED, Math.random));
    expect(game.phase).toBe("lobby");
  });

  it.each([
    ["a bad phase", wordscrambleState({ phase: "paused" })],
    ["an unknown mode", wordscrambleState({ settings: { lang: "en", mode: "sprint", turnsPerTeam: 5, target: 30 } })],
    ["too many turns per team", wordscrambleState({ settings: { lang: "en", mode: "turns", turnsPerTeam: 11, target: 30 } })],
    ["an unknown target", wordscrambleState({ settings: { lang: "en", mode: "target", turnsPerTeam: 5, target: 25 } })],
    ["a third team", wordscrambleState({ teams: { p1: "C" } })],
    ["a ninth seat", wordscrambleState({ teams: { p9: "A" } })],
    ["an overlong guess", wordscrambleState({ guesses: [{ seat: "p1", text: "ABCDEFGHIJKLM" }] })],
    ["a 31st guess", wordscrambleState({ guesses: Object.fromEntries(Array.from({ length: 31 }, (_, i) => [String(i), { seat: "p1", text: "NOPE" }])) })],
    ["a score missing a team", wordscrambleState({ scores: { A: 3 } })],
    ["a score that isn't a number", wordscrambleState({ scores: { A: "3", B: 0 } })],
    ["a steal worth too much", wordscrambleState({ stolen: { seat: "p2", points: 5 } })],
    ["a stealer that isn't a seat", wordscrambleState({ phase: "stealing", stealer: "p9" })],
    ["too many points for a word", wordscrambleState({ history: [{ team: "A", wordId: "en-001", points: 9 }] })],
    ["an unknown key", wordscrambleState({ word: "TIGER" })],
  ])("rejects %s", async (_, state) => {
    await assertFails(dbAs(env, "alice").ref(path).set(state));
  });

  it("lets each player write only their own typing signal", async () => {
    const at = { at: { ".sv": "timestamp" } };
    await assertSucceeds(dbAs(env, "alice").ref(`games/${ROOM}/wordscrambleTyping/p1`).set(at));
    await assertFails(dbAs(env, "alice").ref(`games/${ROOM}/wordscrambleTyping/p2`).set(at));
    await assertFails(dbAs(env, "eve").ref(`games/${ROOM}/wordscrambleTyping/p1`).set(at));
    await assertFails(dbAs(env, "alice").ref(`games/${ROOM}/wordscrambleTyping/p1`).set({ at: Date.now() + 60_000 }));
    await assertFails(dbAs(env, "alice").ref(`games/${ROOM}/wordscrambleTyping/p1`).set({ at: 1, text: "TIG" }));
  });
});
