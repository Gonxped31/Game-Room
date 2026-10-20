import type { SeatId, WithMultiplayerIdentity } from "@/lib/session/types";
import { assertDue } from "@/lib/session/shared/deadline";
import type { Lang } from "@/lib/games/shared/language";
import {
  ANSWER_MS,
  BUZZ_WINDOW_MS,
  CHOICES,
  COUNTDOWN_MS,
  DEFAULT_LENGTH,
  type GameLength,
  LENGTHS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  QUESTION_MS,
  RESULT_MS,
  TOPICS,
  type TopicId,
} from "./constants";

/**
 * Buzzer Quiz's state machine (references/buzzer-quiz/buzzer-quiz-game-design.md).
 *
 * Choices are referred to by their index in the bank, where 0 is always the
 * right answer; `choiceOrder` shuffles them for display. Every timed step
 * (`reveal`, `resolveBuzz`, `answerTimeout`, `questionTimeout`, `next`)
 * checks its phase and deadline with `assertDue`, so every device can try it
 * and only the first commit counts.
 */

export type Phase = "setup" | "lobby" | "countdown" | "question" | "buzzing" | "answering" | "result" | "final";

export interface Settings {
  lang: Lang;
  topics: TopicId[];
  length: GameLength;
}

export interface Buzz {
  seat: SeatId;
  /** Reaction time, measured on the player's device from when buzzing opened. */
  ms: number;
}

export type Outcome =
  | { kind: "right"; seat: SeatId; points: number }
  | { kind: "none"; reason: "one-left" | "all-locked" | "timeout" };

export interface QuizState extends WithMultiplayerIdentity {
  phase: Phase;
  settings: Settings;
  /** Who plays this game, fixed at Start (in seat order). Anyone else watches. */
  players: SeatId[];
  questionIds: string[];
  /** Shuffles choice order per question. */
  seed: number;
  /** The current question, 0-based. */
  index: number;
  /** Buzz round within the question: +1 each time buzzing reopens after a wrong answer. */
  round: number;
  /** End of the current timed phase (server ms): countdown, buzz window, answer, result. */
  deadline?: number;
  /** When buzzing opened for this round (server ms) - devices measure reaction time from here. */
  openedAt?: number;
  /** When the question times out (server ms); absent while paused. */
  questionEnd?: number;
  /** Question time left while paused (buzz window and answering). */
  timeLeft?: number;
  buzzes: Buzz[];
  buzzer?: SeatId;
  /** Struck choices (bank indices). */
  struck: number[];
  locked: SeatId[];
  lastPick?: { seat: SeatId; choice: number; right: boolean };
  outcome?: Outcome;
  scores: Partial<Record<SeatId, number>>;
}

export interface Question {
  id: string;
  lang: Lang;
  topic: TopicId;
  question: string;
  /** Exactly 4; the first is the right answer. */
  choices: string[];
}

/** The Realtime Database drops empty arrays and objects: put them back. */
export function normalize(game: QuizState): QuizState {
  return {
    ...game,
    names: game.names ?? {},
    settings: { ...game.settings, topics: game.settings?.topics ?? [] },
    players: game.players ?? [],
    questionIds: game.questionIds ?? [],
    buzzes: game.buzzes ?? [],
    struck: game.struck ?? [],
    locked: game.locked ?? [],
    scores: game.scores ?? {},
  };
}

/** Builds a state without the optional fields listed (never write an explicit `undefined`). */
function without(game: QuizState, ...keys: (keyof QuizState)[]): QuizState {
  const copy = { ...game };
  for (const key of keys) delete copy[key];
  return copy;
}

export function newGame(lang: Lang): QuizState {
  return {
    phase: "setup",
    settings: { lang, topics: [], length: DEFAULT_LENGTH },
    players: [],
    questionIds: [],
    seed: 0,
    index: 0,
    round: 0,
    buzzes: [],
    struck: [],
    locked: [],
    scores: {},
    names: {},
  };
}

// ---- Setup and lobby (host) ---------------------------------------------------------

export function setLang(state: QuizState, lang: Lang): QuizState {
  const game = normalize(state);
  if (game.phase !== "setup" && game.phase !== "lobby") throw new Error("Settings are locked.");
  return { ...game, settings: { ...game.settings, lang } };
}

export function toggleTopic(state: QuizState, topic: TopicId): QuizState {
  const game = normalize(state);
  if (game.phase !== "setup" && game.phase !== "lobby") throw new Error("Settings are locked.");
  if (!TOPICS.includes(topic)) throw new Error("Unknown topic.");
  const has = game.settings.topics.includes(topic);
  if (has && game.settings.topics.length === 1 && game.phase === "lobby") throw new Error("Keep at least one topic.");
  const topics = has ? game.settings.topics.filter((t) => t !== topic) : TOPICS.filter((t) => t === topic || game.settings.topics.includes(t));
  return { ...game, settings: { ...game.settings, topics } };
}

export function setLength(state: QuizState, length: number): QuizState {
  const game = normalize(state);
  if (game.phase !== "setup" && game.phase !== "lobby") throw new Error("Settings are locked.");
  if (!LENGTHS.includes(length as GameLength)) throw new Error("Unknown length.");
  return { ...game, settings: { ...game.settings, length: length as GameLength } };
}

/** "Continue to the waiting room". */
export function toLobby(state: QuizState): QuizState {
  const game = normalize(state);
  if (game.phase !== "setup") throw new Error("Not in setup.");
  if (!game.settings.topics.length) throw new Error("Pick at least one topic.");
  return { ...game, phase: "lobby" };
}

/** The host's "Edit" from the waiting room. */
export function backToSetup(state: QuizState): QuizState {
  const game = normalize(state);
  if (game.phase !== "lobby") throw new Error("Not in the lobby.");
  return { ...game, phase: "setup" };
}

function startRun(game: QuizState, opts: { players: SeatId[]; questionIds: string[]; seed: number; now: number }): QuizState {
  const { players, questionIds, seed, now } = opts;
  if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) throw new Error(`Needs ${MIN_PLAYERS} to ${MAX_PLAYERS} players.`);
  if (new Set(players).size !== players.length) throw new Error("Duplicate player.");
  if (questionIds.length !== game.settings.length) throw new Error("Wrong number of questions.");
  const scores: Partial<Record<SeatId, number>> = {};
  for (const seat of players) scores[seat] = 0;
  return {
    ...without(game, "openedAt", "questionEnd", "timeLeft", "buzzer", "lastPick", "outcome"),
    phase: "countdown",
    players,
    questionIds,
    seed,
    index: 0,
    round: 0,
    deadline: now + COUNTDOWN_MS,
    buzzes: [],
    struck: [],
    locked: [],
    scores,
  };
}

/** Start: the questions are drawn by the caller (`pickQuestions`) from the bank. */
export function start(state: QuizState, opts: { players: SeatId[]; questionIds: string[]; seed: number; now: number }): QuizState {
  const game = normalize(state);
  if (game.phase !== "lobby") throw new Error("Not in the lobby.");
  return startRun(game, opts);
}

/** Rematch from the final ranking: same settings, new questions, scores back to 0. */
export function rematch(state: QuizState, opts: { players: SeatId[]; questionIds: string[]; seed: number; now: number }): QuizState {
  const game = normalize(state);
  if (game.phase !== "final") throw new Error("The game isn't over.");
  return startRun(game, opts);
}

/** "New topics" from the final ranking. */
export function newTopics(state: QuizState): QuizState {
  const game = normalize(state);
  if (game.phase !== "final") throw new Error("The game isn't over.");
  return { ...without(game, "deadline", "openedAt", "questionEnd", "timeLeft", "buzzer", "lastPick", "outcome"), phase: "setup", buzzes: [], struck: [], locked: [] };
}

// ---- A question ---------------------------------------------------------------------

/** Countdown over: the question and its choices appear, buzzing opens. */
export function reveal(state: QuizState, now: number): QuizState {
  const game = normalize(state);
  assertDue(game, "countdown", game.deadline, now);
  const openedAt = game.deadline!;
  return {
    ...without(game, "deadline", "timeLeft", "buzzer", "lastPick", "outcome"),
    phase: "question",
    round: 0,
    openedAt,
    questionEnd: openedAt + QUESTION_MS,
    buzzes: [],
    struck: [],
    locked: [],
  };
}

/** A player buzzes with their reaction time. The first buzz of a round opens the buzz window. */
export function buzz(state: QuizState, seat: SeatId, ms: number, now: number): QuizState {
  const game = normalize(state);
  if (game.phase !== "question" && game.phase !== "buzzing") throw new Error("Buzzing is closed.");
  if (!game.players.includes(seat)) throw new Error("Not playing.");
  if (game.locked.includes(seat)) throw new Error("Locked out.");
  if (game.buzzes.some((b) => b.seat === seat)) throw new Error("Already buzzed.");
  if (!Number.isInteger(ms) || ms < 0 || ms > QUESTION_MS) throw new Error("Bad reaction time.");
  const buzzes = [...game.buzzes, { seat, ms }];
  if (game.phase === "buzzing") return { ...game, buzzes };
  return {
    ...without(game, "questionEnd"),
    phase: "buzzing",
    buzzes,
    deadline: now + BUZZ_WINDOW_MS,
    timeLeft: Math.max(0, (game.questionEnd ?? now) - now),
  };
}

/** Buzz window over: the fastest reaction answers (a tie goes to the lower seat). */
export function resolveBuzz(state: QuizState, now: number): QuizState {
  const game = normalize(state);
  assertDue(game, "buzzing", game.deadline, now);
  const order = (seat: SeatId) => game.players.indexOf(seat);
  const [winner] = [...game.buzzes].sort((a, b) => a.ms - b.ms || order(a.seat) - order(b.seat));
  if (!winner) throw new Error("No buzz.");
  return { ...game, phase: "answering", buzzer: winner.seat, deadline: now + ANSWER_MS };
}

/** Choices still in play. */
export const choicesLeft = (game: Pick<QuizState, "struck">): number => CHOICES - (game.struck ?? []).length;

/** Points for a right answer with this many choices left: 4 -> 3, 3 -> 2, 2 -> 1. */
export const pointsFor = (left: number): number => Math.max(0, left - 1);

function endQuestion(game: QuizState, outcome: Outcome, now: number): QuizState {
  return {
    ...without(game, "openedAt", "questionEnd", "timeLeft", "buzzer"),
    phase: "result",
    outcome,
    deadline: now + RESULT_MS,
  };
}

/** After a wrong answer (or no answer): end the question if nobody can still win it, else reopen buzzing. */
function afterMiss(game: QuizState, now: number): QuizState {
  if (choicesLeft(game) <= 1) return endQuestion(game, { kind: "none", reason: "one-left" }, now);
  if (game.players.every((seat) => game.locked.includes(seat))) return endQuestion(game, { kind: "none", reason: "all-locked" }, now);
  return {
    ...without(game, "deadline", "buzzer", "timeLeft"),
    phase: "question",
    round: game.round + 1,
    buzzes: [],
    openedAt: now,
    questionEnd: now + (game.timeLeft ?? 0),
  };
}

/** The buzzer picks a choice (a bank index; 0 is right). */
export function pick(state: QuizState, seat: SeatId, choice: number, now: number): QuizState {
  const game = normalize(state);
  if (game.phase !== "answering") throw new Error("Nobody is answering.");
  if (seat !== game.buzzer) throw new Error("Not your turn.");
  if (!Number.isInteger(choice) || choice < 0 || choice >= CHOICES) throw new Error("No such choice.");
  if (game.struck.includes(choice)) throw new Error("Already struck.");
  if (choice === 0) {
    const points = pointsFor(choicesLeft(game));
    const scores = { ...game.scores, [seat]: (game.scores[seat] ?? 0) + points };
    return endQuestion({ ...game, scores, lastPick: { seat, choice, right: true } }, { kind: "right", seat, points }, now);
  }
  return afterMiss(
    { ...game, struck: [...game.struck, choice], locked: [...game.locked, seat], lastPick: { seat, choice, right: false } },
    now,
  );
}

/** The buzzer didn't pick in time: locked out, nothing struck. */
export function answerTimeout(state: QuizState, now: number): QuizState {
  const game = normalize(state);
  assertDue(game, "answering", game.deadline, now);
  return afterMiss({ ...without(game, "lastPick"), locked: [...game.locked, game.buzzer!] }, now);
}

/** Nobody buzzed before the question timer ran out. */
export function questionTimeout(state: QuizState, now: number): QuizState {
  const game = normalize(state);
  assertDue(game, "question", game.questionEnd, now);
  return endQuestion(game, { kind: "none", reason: "timeout" }, now);
}

/** Result shown: the next countdown, or the final ranking after the last question. */
export function next(state: QuizState, now: number): QuizState {
  const game = normalize(state);
  assertDue(game, "result", game.deadline, now);
  const cleared = without(game, "lastPick", "outcome");
  if (game.index + 1 >= game.questionIds.length) return { ...without(cleared, "deadline"), phase: "final", struck: [], locked: [], buzzes: [] };
  return { ...cleared, phase: "countdown", index: game.index + 1, round: 0, deadline: now + COUNTDOWN_MS, struck: [], locked: [], buzzes: [] };
}

/** The deadline a device should be waiting on in this phase, if any. */
export function dueAt(game: QuizState): number | undefined {
  return game.phase === "question" ? game.questionEnd : game.deadline;
}

/** The timed step for this phase, applied once its deadline passes (see `dueAt`). */
export function advance(state: QuizState, now: number): QuizState {
  switch (state.phase) {
    case "countdown":
      return reveal(state, now);
    case "question":
      return questionTimeout(state, now);
    case "buzzing":
      return resolveBuzz(state, now);
    case "answering":
      return answerTimeout(state, now);
    case "result":
      return next(state, now);
    default:
      throw new Error("Nothing to advance.");
  }
}

// ---- Questions and display ----------------------------------------------------------

/** A small seeded generator (mulberry32), so every device shuffles the same way. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The display order of question `index`'s choices, as bank indices (so the answer isn't always first). */
export function choiceOrder(seed: number, index: number): number[] {
  return shuffle([0, 1, 2, 3], seededRandom(seed * 31 + index + 1));
}

/**
 * Draws `length` questions in the chosen language, spread evenly across the
 * chosen topics, in random order. Throws if the bank is too small.
 */
export function pickQuestions(bank: readonly Question[], settings: Pick<Settings, "lang" | "topics"> & { length: number }, random: () => number): string[] {
  const { lang, topics, length } = settings;
  if (!topics.length) throw new Error("No topics.");
  const pools = topics.map((topic) => shuffle(bank.filter((q) => q.lang === lang && q.topic === topic), random));
  const picked: string[] = [];
  for (let i = 0; picked.length < length; i++) {
    const pool = pools[i % pools.length];
    const round = Math.floor(i / pools.length);
    if (round < pool.length) picked.push(pool[round].id);
    else if (pools.every((p) => round >= p.length)) throw new Error("Not enough questions.");
  }
  return shuffle(picked, random);
}

/** Final ranking: by score, ties share a rank (1, 1, 3). */
export function ranking(game: Pick<QuizState, "players" | "scores">): { seat: SeatId; score: number; rank: number }[] {
  const rows = (game.players ?? []).map((seat) => ({ seat, score: game.scores?.[seat] ?? 0 }));
  rows.sort((a, b) => b.score - a.score || game.players.indexOf(a.seat) - game.players.indexOf(b.seat));
  return rows.map((row) => ({ ...row, rank: rows.findIndex((r) => r.score === row.score) + 1 }));
}
