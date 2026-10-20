import type { SeatId, WithMultiplayerIdentity } from "@/lib/session/types";
import { assertDue } from "@/lib/session/shared/deadline";
import type { Lang } from "@/lib/games/shared/language";
import {
  MAX_GUESS_LENGTH,
  MAX_GUESSES,
  MIN_LETTERS_LEFT,
  RESULT_MS,
  SCOREBOARD_MS,
  START_LEAD_MS,
  TARGET_TURN_CAP,
  TARGETS,
  TURN_MS,
  TURNS_PER_TEAM,
} from "./constants";
import { onlySeated, setTeam, shuffleTeams, startProblem, type Team, type Teams } from "./teams";

/**
 * Word Scramble's state machine (references/scramble/word-scramble-game-design.md).
 *
 * Team A plays the even turns, Team B the odd ones. The word itself never
 * lives in the state, only its id: transitions that need it (`guess`, `hint`)
 * take it from the caller. Every timed step (`timeUp`, `afterResult`,
 * `nextTurn`) checks its phase and deadline with `assertDue`, so every device
 * can try it and only the first commit counts.
 */

export type Phase = "lobby" | "turn" | "result" | "scoreboard" | "end";

export interface Settings {
  lang: Lang;
  mode: "turns" | "target";
  turnsPerTeam: number;
  target: number;
}

export interface Guess {
  seat: SeatId;
  text: string;
}

export interface Played {
  team: Team;
  wordId: string;
  points: number;
}

export interface ScrambleState extends WithMultiplayerIdentity {
  phase: Phase;
  settings: Settings;
  teams: Teams;
  /** 0-based; Team A plays even turns. */
  turn: number;
  wordId?: string;
  /** The current word's scramble. */
  seed: number;
  /** Letters placed by hints this turn (always the leftmost ones). */
  hints: number;
  /** When the word appears (server ms). */
  startAt?: number;
  /** End of the current timed phase (server ms): the turn, the result, the scoreboard. */
  deadline?: number;
  /** This turn's wrong guesses. */
  guesses: Guess[];
  /** Who found this turn's word, and how fast. */
  found?: { seat: SeatId; ms: number };
  scores: Record<Team, number>;
  history: Played[];
  usedWordIds: string[];
}

export interface Word {
  id: string;
  lang: Lang;
  /** The real spelling, accents included. */
  word: string;
}

/** What starts a turn: the word (drawn by the caller with `pickWord`) and its scramble. */
export interface NextWord {
  wordId: string;
  seed: number;
}

/** Uppercase without accents: how tiles show letters and how guesses are compared. */
export function plain(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

export const playingTeam = (turn: number): Team => (turn % 2 === 0 ? "A" : "B");

/** The Realtime Database drops empty arrays and objects: put them back. */
export function normalize(game: ScrambleState): ScrambleState {
  return {
    ...game,
    names: game.names ?? {},
    teams: game.teams ?? {},
    guesses: game.guesses ?? [],
    history: game.history ?? [],
    usedWordIds: game.usedWordIds ?? [],
    scores: { A: game.scores?.A ?? 0, B: game.scores?.B ?? 0 },
  };
}

/** Builds a state without the optional fields listed (never write an explicit `undefined`). */
function without(game: ScrambleState, ...keys: (keyof ScrambleState)[]): ScrambleState {
  const copy = { ...game };
  for (const key of keys) delete copy[key];
  return copy;
}

export function newGame(lang: Lang): ScrambleState {
  return {
    phase: "lobby",
    settings: { lang, mode: "turns", turnsPerTeam: TURNS_PER_TEAM.default, target: TARGETS[1] },
    teams: {},
    turn: 0,
    seed: 0,
    hints: 0,
    guesses: [],
    scores: { A: 0, B: 0 },
    history: [],
    usedWordIds: [],
    names: {},
  };
}

// ---- Lobby --------------------------------------------------------------------------

function inLobby(state: ScrambleState): ScrambleState {
  const game = normalize(state);
  if (game.phase !== "lobby") throw new Error("Not in the lobby.");
  return game;
}

export function setLang(state: ScrambleState, lang: Lang): ScrambleState {
  const game = inLobby(state);
  return { ...game, settings: { ...game.settings, lang } };
}

export function setMode(state: ScrambleState, mode: Settings["mode"]): ScrambleState {
  const game = inLobby(state);
  if (mode !== "turns" && mode !== "target") throw new Error("Unknown mode.");
  return { ...game, settings: { ...game.settings, mode } };
}

export function setTurnsPerTeam(state: ScrambleState, turnsPerTeam: number): ScrambleState {
  const game = inLobby(state);
  if (!Number.isInteger(turnsPerTeam) || turnsPerTeam < TURNS_PER_TEAM.min || turnsPerTeam > TURNS_PER_TEAM.max) throw new Error("Out of range.");
  return { ...game, settings: { ...game.settings, turnsPerTeam } };
}

export function setTarget(state: ScrambleState, target: number): ScrambleState {
  const game = inLobby(state);
  if (!TARGETS.includes(target as (typeof TARGETS)[number])) throw new Error("Unknown target.");
  return { ...game, settings: { ...game.settings, target } };
}

/** A player picks (or switches) team: in the lobby, or on the end screen before a Rematch. */
export function pickTeam(state: ScrambleState, seat: SeatId, team: Team): ScrambleState {
  const game = normalize(state);
  if (game.phase !== "lobby" && game.phase !== "end") throw new Error("A game is under way.");
  if (team !== "A" && team !== "B") throw new Error("Unknown team.");
  return { ...game, teams: setTeam(game.teams, seat, team) };
}

/** "Shuffle teams": deals the seated players into two teams at random and returns to the lobby. */
export function shuffle(state: ScrambleState, seated: SeatId[], random: () => number): ScrambleState {
  const game = normalize(state);
  if (game.phase !== "lobby" && game.phase !== "end") throw new Error("A game is under way.");
  return { ...toLobby(game), teams: shuffleTeams(seated, random) };
}

/** Back to the lobby from the end screen, keeping the teams and settings. */
export function toLobby(state: ScrambleState): ScrambleState {
  const game = normalize(state);
  if (game.phase !== "end" && game.phase !== "lobby") throw new Error("A game is under way.");
  return {
    ...without(game, "wordId", "startAt", "deadline", "found"),
    phase: "lobby",
    turn: 0,
    hints: 0,
    guesses: [],
    scores: { A: 0, B: 0 },
    history: [],
    usedWordIds: [],
  };
}

function beginTurn(game: ScrambleState, next: NextWord, startAt: number): ScrambleState {
  return {
    ...without(game, "found"),
    phase: "turn",
    wordId: next.wordId,
    seed: next.seed,
    hints: 0,
    guesses: [],
    startAt,
    deadline: startAt + TURN_MS,
    usedWordIds: [...game.usedWordIds, next.wordId],
  };
}

/** Start, or Rematch from the end screen: the seated players with a team play, teams must be even. */
export function start(state: ScrambleState, opts: { seated: SeatId[]; next: NextWord; now: number }): ScrambleState {
  const game = normalize(state);
  if (game.phase !== "lobby" && game.phase !== "end") throw new Error("A game is under way.");
  const teams = onlySeated(game.teams, opts.seated);
  if (startProblem(teams, opts.seated)) throw new Error("Everyone needs a team, and the teams must be even.");
  return beginTurn({ ...toLobby(game), teams }, opts.next, opts.now + START_LEAD_MS);
}

// ---- A turn -------------------------------------------------------------------------

function assertPlaying(game: ScrambleState, seat: SeatId, now: number): Team {
  if (game.phase !== "turn") throw new Error("No turn under way.");
  const team = game.teams[seat];
  if (!team || team !== playingTeam(game.turn)) throw new Error("Not your team's turn.");
  if (game.startAt != null && now < game.startAt) throw new Error("Not started yet.");
  return team;
}

/** What the current word is worth: its letters minus the hints used. */
export const worth = (word: string, hints: number): number => plain(word).length - hints;

/** A playing-team member guesses. Right ends the turn with the points; wrong goes to the feed. */
export function guess(state: ScrambleState, seat: SeatId, text: string, word: string, now: number): ScrambleState {
  const game = normalize(state);
  const team = assertPlaying(game, seat, now);
  const attempt = plain(text);
  if (!attempt || attempt.length > MAX_GUESS_LENGTH) throw new Error("Bad guess.");
  if (attempt === plain(word)) {
    const points = worth(word, game.hints);
    return {
      ...game,
      phase: "result",
      found: { seat, ms: Math.max(0, now - (game.startAt ?? now)) },
      scores: { ...game.scores, [team]: game.scores[team] + points },
      history: [...game.history, { team, wordId: game.wordId!, points }],
      deadline: now + RESULT_MS,
    };
  }
  if (game.guesses.length >= MAX_GUESSES) throw new Error("Too many guesses.");
  return { ...game, guesses: [...game.guesses, { seat, text: attempt }] };
}

/** Whether a hint is still allowed for this word. */
export const canHint = (word: string, hints: number): boolean => plain(word).length - (hints + 1) >= MIN_LETTERS_LEFT;

/** A playing-team member asks for a hint: the next letter from the left drops into its slot. */
export function hint(state: ScrambleState, seat: SeatId, word: string, now: number): ScrambleState {
  const game = normalize(state);
  assertPlaying(game, seat, now);
  if (!canHint(word, game.hints)) throw new Error("No more hints.");
  return { ...game, hints: game.hints + 1 };
}

/** Time's up: the word is revealed, no points. */
export function timeUp(state: ScrambleState, now: number): ScrambleState {
  const game = normalize(state);
  assertDue(game, "turn", game.deadline, now);
  return {
    ...game,
    phase: "result",
    history: [...game.history, { team: playingTeam(game.turn), wordId: game.wordId!, points: 0 }],
    deadline: now + RESULT_MS,
  };
}

/** Whether the game is over once turn `turn` has been played. */
export function isOver(game: Pick<ScrambleState, "settings" | "scores">, turn: number): boolean {
  const played = turn + 1;
  if (played % 2 !== 0) return false; // both teams always play the same number of turns
  if (game.settings.mode === "turns") return played >= game.settings.turnsPerTeam * 2;
  return Math.max(game.scores.A, game.scores.B) >= game.settings.target || played >= TARGET_TURN_CAP * 2;
}

/** The result has been shown: the scoreboard, or the end. */
export function afterResult(state: ScrambleState, now: number): ScrambleState {
  const game = normalize(state);
  assertDue(game, "result", game.deadline, now);
  if (isOver(game, game.turn)) return { ...without(game, "deadline", "startAt"), phase: "end" };
  return { ...game, phase: "scoreboard", deadline: now + SCOREBOARD_MS };
}

/** The scoreboard has been shown: the other team's turn, with a new word. */
export function nextTurn(state: ScrambleState, next: NextWord, now: number): ScrambleState {
  const game = normalize(state);
  assertDue(game, "scoreboard", game.deadline, now);
  return beginTurn({ ...game, turn: game.turn + 1 }, next, now);
}

/** The deadline a device should be waiting on in this phase, if any. */
export const dueAt = (game: ScrambleState): number | undefined => (game.phase === "lobby" || game.phase === "end" ? undefined : game.deadline);

/** The timed step for this phase, applied once its deadline passes. `next` is only used after the scoreboard. */
export function advance(state: ScrambleState, now: number, next: NextWord): ScrambleState {
  switch (state.phase) {
    case "turn":
      return timeUp(state, now);
    case "result":
      return afterResult(state, now);
    case "scoreboard":
      return nextTurn(state, next, now);
    default:
      throw new Error("Nothing to advance.");
  }
}

/** The winner, or "draw". */
export const winner = (game: Pick<ScrambleState, "scores">): Team | "draw" =>
  game.scores.A === game.scores.B ? "draw" : game.scores.A > game.scores.B ? "A" : "B";

// ---- Words and scrambling -----------------------------------------------------------

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

/**
 * The word's letters (uppercase, no accents) in scrambled order. Never the
 * word itself, and for 5+ letters at least half the letters move.
 */
export function scramble(word: string, seed: number): string[] {
  const letters = [...plain(word)];
  const random = seededRandom(seed);
  const enough = (order: string[]) => {
    const moved = order.filter((letter, i) => letter !== letters[i]).length;
    return order.join("") !== letters.join("") && (letters.length < 5 || moved >= Math.ceil(letters.length / 2));
  };
  let best = letters;
  for (let attempt = 0; attempt < 50; attempt++) {
    const order = [...letters];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    if (enough(order)) return order;
    best = order;
  }
  // A word of one repeated letter can't be scrambled; the word lists never contain one.
  return best.join("") === letters.join("") ? [...letters.slice(1), letters[0]] : best;
}

/**
 * Draws the next word: the room's language, not used yet this game, and a
 * length different from the previous word's when possible, so a game's
 * lengths stay varied.
 */
export function pickWord(bank: readonly Word[], game: Pick<ScrambleState, "settings" | "usedWordIds" | "wordId">, random: () => number): Word {
  const used = new Set(game.usedWordIds ?? []);
  const fresh = bank.filter((w) => w.lang === game.settings.lang && !used.has(w.id));
  const pool = fresh.length ? fresh : bank.filter((w) => w.lang === game.settings.lang);
  if (!pool.length) throw new Error("No words.");
  const last = bank.find((w) => w.id === game.wordId);
  const varied = last ? pool.filter((w) => plain(w.word).length !== plain(last.word).length) : pool;
  const from = varied.length ? varied : pool;
  return from[Math.floor(random() * from.length)];
}
