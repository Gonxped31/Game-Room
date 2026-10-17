import type { Role, WithIdentity } from "@/lib/session/types";

/**
 * An Iaï co-op room's shared state: a series of runs, both samurai on one
 * field. Both press Ready; the second press starts a run on the server's
 * clock. The fight itself isn't in here: the host's engine runs it and
 * streams snapshots over `games/{room}/iaiLive/{seat}` (see the iai skill).
 * When both samurai have fallen, the host reports the run's result.
 */

export type Phase = "LOBBY" | "RUNNING" | "DONE";

/** A run's numbers, as the results show them. Whole numbers. */
export interface CoopResult {
  score: number;
  /** Seconds survived. */
  survived: number;
  kills: number;
  oni: number;
  combo: number;
  /** Percent of cuts that were perfect. */
  perfect: number;
}

export interface GameState extends WithIdentity {
  phase: Phase;
  /** How many runs have started in this room. */
  run: number;
  ready: Partial<Record<Role, true>>;
  /** Server time (ms) the current run starts. */
  startAt?: number;
  /** The last run's result. */
  result?: CoopResult;
  /** The room's best score. */
  best: number;
}

/** How long after the second Ready a run starts, so the other device hears of it first. */
export const RUN_START_DELAY_MS = 2500;

const ROLES: Role[] = ["p1", "p2"];

export function newGame(): GameState {
  return { phase: "LOBBY", run: 0, ready: {}, best: 0, names: {} };
}

/** Realtime Database drops empty objects; every transition (and the page, on read) normalizes first. */
export function normalizeGame(game: GameState): GameState {
  return { ...game, names: game.names ?? {}, ready: game.ready ?? {}, best: game.best ?? 0 };
}

/** Without `result` and `startAt` (never written as undefined: Firebase rejects that). */
function withoutRun(game: GameState): GameState {
  const rest = { ...game };
  delete rest.result;
  delete rest.startAt;
  return rest;
}

/** `role` presses Ready (or takes it back); the second Ready starts a run at `now` + the delay (server ms). */
export function setReady(rawGame: GameState, role: Role, isReady: boolean, now: number): GameState {
  const game = normalizeGame(rawGame);
  if (game.phase === "RUNNING") throw new Error("A run is already going.");
  const ready: Partial<Record<Role, true>> = {};
  for (const r of ROLES) if (r === role ? isReady : game.ready[r]) ready[r] = true;
  if (!(ready.p1 && ready.p2)) return { ...game, ready };
  return { ...withoutRun(game), phase: "RUNNING", run: game.run + 1, ready: {}, startAt: now + RUN_START_DELAY_MS };
}

/** The host reports how run `run` ended (both samurai fell). */
export function finishRun(rawGame: GameState, run: number, result: CoopResult): GameState {
  const game = normalizeGame(rawGame);
  if (game.phase !== "RUNNING" || game.run !== run) throw new Error("That run isn't going.");
  return { ...withoutRun(game), phase: "DONE", result, best: Math.max(game.best, result.score) };
}

/** Back to the lobby mid-run (the host left, so nobody is running the fight). */
export function abandonRun(rawGame: GameState): GameState {
  const game = normalizeGame(rawGame);
  if (game.phase !== "RUNNING") throw new Error("No run to abandon.");
  return { ...withoutRun(game), phase: "LOBBY", ready: {} };
}
