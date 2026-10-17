import type { Role, WithIdentity } from "@/lib/session/types";
import { COUNTDOWN_SECONDS, RACE_START_DELAY_MS, RESULT_GRACE_MS, RUN_SECONDS } from "./constants";

/**
 * A Night Highway room's shared state: a series of 60-second races on the
 * same road. Both players press Ready; the second press starts a race with a
 * shared traffic seed and a start time on the server's clock, so both devices
 * run the same countdown and see the same traffic. Each device drives its own
 * car and submits its result when the clock runs out; the higher score wins.
 *
 * The cars' live positions (for each other's ghost) are NOT in here - they
 * change ten times a second, so they live at their own path
 * (`games/{room}/nighthighwayCars/{seat}`, see ./live.ts) instead of
 * contending with this state's transactions.
 */

export type Phase = "LOBBY" | "RACING" | "DONE";

/** One run's numbers, as shown on the results screen. All whole numbers. */
export interface RunResult {
  score: number;
  /** Metres. */
  distance: number;
  /** km/h. */
  top: number;
  /** km/h. */
  avg: number;
  nearMiss: number;
  overtakes: number;
  crashes: number;
}

export type Winner = Role | "tie";

/** Switches the players choose before a race. Curves are always on; these aren't. */
export interface RaceOptions {
  /** Wet road: less grip, so the car slides. */
  rain: boolean;
  /** Nitro, phase and shield pickups on the road (see ./pickups.ts). */
  pickups: boolean;
  /** The desert circuit at sunset, with hills (see ./road.ts), instead of the city at night. */
  desert: boolean;
}

export const DEFAULT_OPTIONS: RaceOptions = { rain: false, pickups: true, desert: false };
const OPTION_KEYS = ["rain", "pickups", "desert"] as const;

export interface RaceRecord {
  race: number;
  /** A seat with no score didn't finish (its device left mid-race). */
  scores: Partial<Record<Role, number>>;
  winner: Winner;
}

export interface GameState extends WithIdentity {
  phase: Phase;
  /** How many races have started in this room. */
  race: number;
  /** Who has pressed Ready for the next race (LOBBY or DONE). */
  ready: Partial<Record<Role, true>>;
  /** The current/last race's traffic seed (RACING and DONE). */
  seed?: number;
  /** Server time (ms) the current/last race's countdown starts (RACING and DONE). */
  startAt?: number;
  /** The current/last race's results, per seat. */
  results: Partial<Record<Role, RunResult>>;
  wins: Record<Role, number>;
  history: RaceRecord[];
  /** The next race's switches; fixed for a race once it starts (they can't change mid-race). */
  options: RaceOptions;
}

const ROLES: Role[] = ["p1", "p2"];

export function newGame(): GameState {
  return { phase: "LOBBY", race: 0, ready: {}, results: {}, wins: { p1: 0, p2: 0 }, history: [], options: { ...DEFAULT_OPTIONS }, names: {} };
}

/**
 * Realtime Database drops empty objects and arrays, so they can read back
 * missing. Every transition normalizes first, and so must any code reading
 * the state (the page does, once, on every snapshot).
 */
export function normalizeGame(game: GameState): GameState {
  return {
    ...game,
    names: game.names ?? {},
    ready: game.ready ?? {},
    results: game.results ?? {},
    wins: { p1: game.wins?.p1 ?? 0, p2: game.wins?.p2 ?? 0 },
    history: game.history ?? [],
    // A room made before the options existed has none.
    options: { rain: game.options?.rain ?? DEFAULT_OPTIONS.rain, pickups: game.options?.pickups ?? DEFAULT_OPTIONS.pickups, desert: game.options?.desert ?? DEFAULT_OPTIONS.desert },
  };
}

/**
 * Changes the next race's switches. Not mid-race, and it takes back both
 * players' Ready, so nobody starts a race with settings they didn't see.
 */
export function setOptions(rawGame: GameState, change: Partial<RaceOptions>): GameState {
  const game = normalizeGame(rawGame);
  if (game.phase === "RACING") throw new Error("The options can't change mid-race.");
  const options: RaceOptions = { rain: change.rain ?? game.options.rain, pickups: change.pickups ?? game.options.pickups, desert: change.desert ?? game.options.desert };
  if (OPTION_KEYS.every((key) => options[key] === game.options[key])) throw new Error("Nothing changed.");
  return { ...game, options, ready: {} };
}

/** When a race's driving ends, on the server's clock. */
export function raceEndsAt(startAt: number): number {
  return startAt + (COUNTDOWN_SECONDS + RUN_SECONDS) * 1000;
}

/**
 * `role` presses Ready (or takes it back). The second Ready starts a race:
 * `now` is the server's clock (ms), `seed` the new race's traffic seed.
 */
export function setReady(rawGame: GameState, role: Role, isReady: boolean, now: number, seed: number): GameState {
  const game = normalizeGame(rawGame);
  if (game.phase === "RACING") throw new Error("A race is already running.");
  const ready: Partial<Record<Role, true>> = {};
  for (const r of ROLES) if (r === role ? isReady : game.ready[r]) ready[r] = true;
  if (!(ready.p1 && ready.p2)) return { ...game, ready };
  return {
    ...game,
    phase: "RACING",
    race: game.race + 1,
    ready: {},
    seed,
    startAt: now + RACE_START_DELAY_MS,
    results: {},
  };
}

function finish(game: GameState): GameState {
  const scores: Partial<Record<Role, number>> = {};
  for (const r of ROLES) if (game.results[r]) scores[r] = game.results[r]!.score;
  const p1 = scores.p1 ?? -1;
  const p2 = scores.p2 ?? -1;
  const winner: Winner = p1 === p2 ? "tie" : p1 > p2 ? "p1" : "p2";
  const wins = { ...game.wins };
  if (winner !== "tie") wins[winner] += 1;
  return { ...game, phase: "DONE", wins, history: [...game.history, { race: game.race, scores, winner }] };
}

/** `role`'s run is over: records its result, and ends the race once both are in. */
export function submitResult(rawGame: GameState, role: Role, result: RunResult): GameState {
  const game = normalizeGame(rawGame);
  if (game.phase !== "RACING") throw new Error("No race is running.");
  if (game.results[role]) throw new Error("That result is already in.");
  const next = { ...game, results: { ...game.results, [role]: result } };
  return next.results.p1 && next.results.p2 ? finish(next) : next;
}

/**
 * Ends a race whose missing result is long overdue (that player's device
 * left mid-race). The missing seat has no score, so whoever finished wins.
 */
export function giveUpOnMissingResults(rawGame: GameState, now: number): GameState {
  const game = normalizeGame(rawGame);
  if (game.phase !== "RACING" || game.startAt === undefined) throw new Error("No race is running.");
  if (now < raceEndsAt(game.startAt) + RESULT_GRACE_MS) throw new Error("The race may still finish.");
  return finish(game);
}

/** True when this race's missing results may be given up on (see giveUpOnMissingResults). */
export function resultsOverdue(game: GameState, now: number): boolean {
  return game.phase === "RACING" && game.startAt !== undefined && now >= raceEndsAt(game.startAt) + RESULT_GRACE_MS;
}

// ---------- scoring (the original game's rules) ----------

/** Points for a near miss: 250 per combo step, half again for a very close one (under 0.5 m). */
export function nearMissPoints(combo: number, gap: number): number {
  return Math.round(250 * combo * (gap < 0.5 ? 1.5 : 1));
}

/** A near miss within this gap (m) counts, above this speed (m/s), unless the car is still recovering from a crash. */
export const NEAR_MISS_GAP = 1.1;
export const NEAR_MISS_MIN_SPEED = 25;
/** The combo multiplier caps here, and resets after this many seconds without a near miss (or on a crash). */
export const MAX_COMBO = 9;
export const COMBO_SECONDS = 4;

/** A run's score: one point per metre driven, plus near-miss bonuses. */
export function runScore(distanceMetres: number, bonus: number): number {
  return Math.floor(distanceMetres + bonus);
}
