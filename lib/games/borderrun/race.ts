import type { SeatId, WithMultiplayerIdentity } from "@/lib/session/types";
import { AREAS, PAR_RANGE, PENALTY_MS, type Area } from "./constants";
import { addGuess, newPlay, status, type Guess, type Play } from "./play";
import { closenessOf, generateRoute, type Route } from "./route";

/**
 * Border Run with others (`/borderrun#room`): everyone races the same route
 * at the same moment, round after round.
 *
 * - **Challenge** (2-4 players): a set number of rounds; the lowest total
 *   time (with the guess penalty) wins.
 * - **Survival** (4-8 players): after each round the slowest are knocked out
 *   (two while more than 4 are left, then one) until one is left.
 *
 * The room's state (`games/{room}/borderrun`) holds the round, its route and
 * the results; each player's guesses live in `borderrunRuns/{seat}`, which
 * only that seat writes (8 players guessing at once would fight over one
 * transaction). A round ends at its deadline, or as soon as every player
 * still in is done; any device that sees it transacts `endRound`, which
 * replays everyone's guesses itself.
 */

export type Mode = "challenge" | "survival";
export const MODES: readonly Mode[] = ["challenge", "survival"];

/** A map for every round, or "mixed": a different one each round. */
export type MapChoice = Area | "mixed";
export const MAP_CHOICES: readonly MapChoice[] = ["mixed", ...AREAS];
/** The maps "mixed" goes through, round by round. */
export const MIXED: readonly Area[] = ["europe", "americas", "africa", "asia", "eurasia", "world"];

/** Rounds in a challenge. */
export const ROUND_COUNTS = [3, 5] as const;
export type RoundCount = (typeof ROUND_COUNTS)[number];

/** How many players each mode takes. A private room has 8 seats; a public one, the mode's most. */
export const PLAYERS: Record<Mode, { min: number; max: number }> = {
  challenge: { min: 2, max: 4 },
  survival: { min: 4, max: 8 },
};
export const ROOM_SEATS = 8;

/** "3, 2, 1" before each round. */
export const COUNTDOWN_MS = 4_000;
/** A round's time limit: whoever hasn't linked the route by then hasn't finished. */
export const ROUND_MS = 180_000;
/** How long a round's results show before the next round (or the final standings). */
export const RESULTS_MS = 12_000;
/** A round not finished counts in a challenge's total as the slowest finish (at least the time limit), plus this. */
export const DNF_EXTRA_MS = 30_000;
/** The most guesses one player may send in a round (the rules check the same). */
export const MAX_GUESSES = 200;

/** One player's round: their time to link the route (or the limit), the guesses past the par, the route countries found, and whether they finished. */
export interface RoundScore {
  ms: number;
  extra: number;
  found: number;
  done: boolean;
}

export interface RoundResult {
  scores: Partial<Record<SeatId, RoundScore>>;
  /** Survival: who was knocked out after this round. */
  out: SeatId[];
}

export type Phase = "lobby" | "round" | "results" | "over";

export interface RaceState extends WithMultiplayerIdentity {
  phase: Phase;
  mode: Mode;
  map: MapChoice;
  rounds: RoundCount;
  /** Everyone who started this game. */
  players: SeatId[];
  /** Still in (survival); everyone (challenge). */
  alive: SeatId[];
  /** The current round, from 0. */
  round: number;
  route: Route | null;
  /** Server ms: the round starts (after the countdown), its time limit, the next round. 0 when unset. */
  startsAt: number;
  endsAt: number;
  nextAt: number;
  results: RoundResult[];
}

/**
 * One player's guesses this round, as they send them (`borderrunRuns/{seat}`).
 * `at` is the round's `startsAt`, which no other round shares (not even a
 * rematch's first round); `t` is ms after it, by the server's clock.
 */
export interface Run {
  at: number;
  guesses: Guess[];
  gaveUp: boolean;
}

export type Runs = Partial<Record<SeatId, Run>>;

export function newRace(mode: Mode): RaceState {
  return { names: {}, phase: "lobby", mode, map: "mixed", rounds: 3, players: [], alive: [], round: 0, route: null, startsAt: 0, endsAt: 0, nextAt: 0, results: [] };
}

/** The Realtime Database drops empty arrays and objects: put them back. */
export function normalize(state: RaceState): RaceState {
  const results = (state.results ?? []).map((result) => ({ scores: result?.scores ?? {}, out: result?.out ?? [] }));
  const route = state.route ? { ...state.route, closed: state.route.closed ?? [] } : null;
  return { ...state, names: state.names ?? {}, players: state.players ?? [], alive: state.alive ?? [], route, results };
}

export const normalizeRun = (run: Partial<Run> | null | undefined): Run => ({ at: run?.at ?? 0, guesses: run?.guesses ?? [], gaveUp: run?.gaveUp ?? false });

const inLobby = (state: RaceState) => {
  if (state.phase !== "lobby") throw new Error("Only in the lobby.");
};

export function setMode(state: RaceState, mode: Mode): RaceState {
  inLobby(state);
  return { ...normalize(state), mode };
}

export function setMap(state: RaceState, map: MapChoice): RaceState {
  inLobby(state);
  if (!MAP_CHOICES.includes(map)) throw new Error("No such map.");
  return { ...normalize(state), map };
}

export function setRounds(state: RaceState, rounds: RoundCount): RaceState {
  inLobby(state);
  if (!ROUND_COUNTS.includes(rounds)) throw new Error("No such length.");
  return { ...normalize(state), rounds };
}

/** Why a game of this mode can't start with this many players, or null if it can. */
export function startProblem(mode: Mode, players: number): string | null {
  const { min, max } = PLAYERS[mode];
  if (players < min) return `${mode === "challenge" ? "Challenge" : "Survival"} needs at least ${min} players.`;
  if (players > max) return `${mode === "challenge" ? "Challenge" : "Survival"} is for ${max} players at most.`;
  return null;
}

/** The map a round is played on. */
export const areaOf = (map: MapChoice, round: number): Area => (map === "mixed" ? MIXED[round % MIXED.length] : map);

/** A round's route: on its map, longer as the rounds go on (from the map's shortest routes up to its longest). */
export function routeFor(map: MapChoice, round: number, seed: string): Route {
  const area = areaOf(map, round);
  const { minPar, maxPar } = PAR_RANGE[area];
  const low = Math.min(minPar + Math.floor(round / 2), maxPar);
  return generateRoute(seed, { area, minPar: low, maxPar: Math.min(low + 1, maxPar) });
}

const beginRound = (state: RaceState, round: number, seed: string, now: number): RaceState => {
  const startsAt = now + COUNTDOWN_MS;
  return { ...state, phase: "round", round, route: routeFor(state.map, round, seed), startsAt, endsAt: startsAt + ROUND_MS, nextAt: 0 };
};

/** Starts a game (from the lobby, or again once one is over) with `seated`, the first route drawn from `seed`. */
export function start(state: RaceState, opts: { seated: SeatId[]; seed: string; now: number }): RaceState {
  const current = normalize(state);
  if (current.phase !== "lobby" && current.phase !== "over") throw new Error("Already playing.");
  const problem = startProblem(current.mode, opts.seated.length);
  if (problem) throw new Error(problem);
  return beginRound({ ...current, players: [...opts.seated], alive: [...opts.seated], results: [] }, 0, opts.seed, opts.now);
}

/** Back to the lobby after a game, to change the mode or the settings. */
export function backToLobby(state: RaceState): RaceState {
  const current = normalize(state);
  if (current.phase !== "over") throw new Error("Not over.");
  return { ...newRace(current.mode), map: current.map, rounds: current.rounds };
}

/** A player's play this round, from what they sent: guesses that don't count (late, repeated, after the finish) are skipped. */
export function playOf(route: Route, run: Run | undefined, at: number): Play {
  let play = newPlay(route);
  if (!run || run.at !== at) return play;
  for (const guess of run.guesses.slice(0, MAX_GUESSES)) {
    if (guess.t > ROUND_MS) break;
    try {
      play = addGuess(play, guess.code, guess.t);
    } catch {
      // not a guess that counts
    }
  }
  return play;
}

/** Countries guessed that are on a shortest route (at most the par): "3 of 5 found". */
export const foundOf = (play: Play) => Math.min(play.route.par, play.guesses.filter((guess) => closenessOf(play.route, guess.code) === "best").length);

/** A player's round so far. */
export function scoreOf(route: Route, run: Run | undefined, at: number): RoundScore {
  const play = playOf(route, run, at);
  const result = status(play);
  return { ms: result.complete ? (play.guesses.at(-1)?.t ?? 0) : ROUND_MS, extra: result.extra, found: foundOf(play), done: result.complete };
}

/** Finished or gave up: nothing more will come from this player this round. */
export function isDone(route: Route, run: Run | undefined, at: number): boolean {
  return (run?.at === at && run.gaveUp) || scoreOf(route, run, at).done;
}

/** A finish's time with the penalty. */
export const total = (score: RoundScore) => score.ms + score.extra * PENALTY_MS;

/** Best first: finishers by time with penalty, then the rest by countries found, then fewer extra guesses. */
export function compareScores(a: RoundScore, b: RoundScore): number {
  if (a.done !== b.done) return a.done ? -1 : 1;
  if (a.done) return total(a) - total(b);
  return b.found - a.found || a.extra - b.extra;
}

/** The round's seats, best first (ties keep seat order). */
export function ranking(scores: Partial<Record<SeatId, RoundScore>>, seats: SeatId[]): SeatId[] {
  return seats.filter((seat) => scores[seat]).sort((a, b) => compareScores(scores[a]!, scores[b]!));
}

/** How many players a survival round knocks out: two while more than 4 are left, then one. */
export const knockouts = (left: number) => (left > 4 ? 2 : left > 1 ? 1 : 0);

/**
 * Who a survival round knocks out: the slowest `knockouts(n)`. A tie at the
 * cut knocks out nobody in the tie, so a round may send fewer home (or none,
 * if everyone ties).
 */
export function knockedOut(scores: Partial<Record<SeatId, RoundScore>>, alive: SeatId[]): SeatId[] {
  const order = ranking(scores, alive);
  const cut = order.length - knockouts(order.length);
  if (cut >= order.length) return [];
  const same = (a: SeatId, b: SeatId) => compareScores(scores[a]!, scores[b]!) === 0;
  const tied = cut > 0 && same(order[cut - 1], order[cut]);
  return order.slice(cut).filter((seat) => !(tied && same(seat, order[cut])));
}

/**
 * True once the round can end: its time is up, or everyone still in that
 * `present` lists (by default all of them; the page passes those online, so
 * a player who left doesn't hold the round up) is done.
 */
export function roundOver(state: RaceState, runs: Runs, now: number, present?: SeatId[]): boolean {
  if (state.phase !== "round" || !state.route) return false;
  if (now >= state.endsAt) return true;
  const waiting = state.alive.filter((seat) => !present || present.includes(seat));
  return now >= state.startsAt && waiting.length > 0 && waiting.every((seat) => isDone(state.route!, runs[seat], state.startsAt));
}

/** Ends the round: everyone's score from their guesses, and (survival) who goes out. Throws unless `roundOver` (with the same `present`). */
export function endRound(state: RaceState, runs: Runs, now: number, present?: SeatId[]): RaceState {
  const current = normalize(state);
  if (!roundOver(current, runs, now, present) || !current.route) throw new Error("The round isn't over.");
  const scores: Partial<Record<SeatId, RoundScore>> = {};
  for (const seat of current.alive) scores[seat] = scoreOf(current.route, runs[seat], current.startsAt);
  const out = current.mode === "survival" ? knockedOut(scores, current.alive) : [];
  return {
    ...current,
    phase: "results",
    alive: current.alive.filter((seat) => !out.includes(seat)),
    results: [...current.results, { scores, out }],
    nextAt: now + RESULTS_MS,
  };
}

/** The game is decided: the challenge's last round, or one survivor (or none left to knock out). */
export function decided(state: RaceState): boolean {
  if (state.mode === "challenge") return state.results.length >= state.rounds;
  return state.alive.length <= 1;
}

/** After the results: the next round (its route from `seed`), or the final standings. */
export function next(state: RaceState, seed: string, now: number): RaceState {
  const current = normalize(state);
  if (current.phase !== "results") throw new Error("Not showing results.");
  if (now < current.nextAt) throw new Error("Not due yet.");
  if (decided(current)) return { ...current, phase: "over", nextAt: 0 };
  return beginRound(current, current.round + 1, seed, now);
}

/** A challenge round's score for the total: a finish's time with penalty; not finished, the slowest finish (at least the limit) plus `DNF_EXTRA_MS`. */
export function roundPoints(result: RoundResult, seat: SeatId): number {
  const score = result.scores[seat];
  const finishes = Object.values(result.scores).filter((s): s is RoundScore => s != null && s.done).map(total);
  const unfinished = Math.max(ROUND_MS, ...finishes) + DNF_EXTRA_MS;
  return score?.done ? total(score) : unfinished;
}

export interface Standing {
  seat: SeatId;
  /** Challenge: the total (lower is better). Survival: the rounds survived. */
  value: number;
  /** Survival: the round they went out in, or null for the winner (or anyone still in). */
  outIn: number | null;
}

/** Everyone in the game, best first. Challenge: by total. Survival: still in first, then by how late they went out. */
export function standings(state: RaceState): Standing[] {
  const { players, results } = normalize(state);
  if (state.mode === "challenge") {
    return players
      .map((seat) => ({ seat, value: results.reduce((sum, result) => sum + roundPoints(result, seat), 0), outIn: null }))
      .sort((a, b) => a.value - b.value);
  }
  const outIn = (seat: SeatId) => {
    const index = results.findIndex((result) => result.out.includes(seat));
    return index < 0 ? null : index;
  };
  // Among those out in the same round, the better round score first.
  const lastScore = (seat: SeatId, round: number) => results[round]?.scores[seat];
  return players
    .map((seat) => ({ seat, outIn: outIn(seat), value: outIn(seat) ?? results.length }))
    .sort((a, b) => {
      if (a.outIn === null || b.outIn === null) return a.outIn === b.outIn ? 0 : a.outIn === null ? -1 : 1;
      if (a.outIn !== b.outIn) return b.outIn - a.outIn;
      const x = lastScore(a.seat, a.outIn);
      const y = lastScore(b.seat, b.outIn);
      return x && y ? compareScores(x, y) : 0;
    });
}
