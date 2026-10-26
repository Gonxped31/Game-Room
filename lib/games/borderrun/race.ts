import { createRace, normalizeCore, type RaceCore, type Mode, type RoundScore, type RunCore, type Runs as RaceRuns } from "@/lib/games/race/race";
import { AREAS, PAR_RANGE, PENALTY_MS, type Area } from "./constants";
import { addGuess, newPlay, status, type Guess, type Play } from "./play";
import { closenessOf, generateRoute, type Route } from "./route";

/**
 * Border Run with others (`/borderrun#room`): everyone races the same route
 * at the same moment, round after round, in Challenge or Survival
 * (lib/games/race/race.ts). Each player's guesses go to
 * `borderrunRuns/{seat}`.
 */

export { MODES, PLAYERS, ROOM_SEATS, ROUND_COUNTS, COUNTDOWN_MS, RESULTS_MS, DNF_EXTRA_MS, knockouts, startProblem } from "@/lib/games/race/race";
export type { Mode, Phase, RoundCount, RoundResult, RoundScore, Standing } from "@/lib/games/race/race";

/** A map for every round, or "mixed": a different one each round. */
export type MapChoice = Area | "mixed";
export const MAP_CHOICES: readonly MapChoice[] = ["mixed", ...AREAS];
/** The maps "mixed" goes through, round by round. */
export const MIXED: readonly Area[] = ["europe", "americas", "africa", "asia", "eurasia", "world"];

/** A round's time limit: whoever hasn't linked the route by then hasn't finished. */
export const ROUND_MS = 180_000;
/** The most guesses one player may send in a round (the rules check the same). */
export const MAX_GUESSES = 200;

export interface RaceState extends RaceCore {
  map: MapChoice;
  route: Route | null;
}

/** One player's guesses this round, as they send them (`borderrunRuns/{seat}`); `t` is ms after the round's start, by the server's clock. */
export interface Run extends RunCore {
  guesses: Guess[];
}

export type Runs = RaceRuns<Run>;

export function newRace(mode: Mode): RaceState {
  return { names: {}, phase: "lobby", mode, map: "mixed", rounds: 3, players: [], alive: [], round: 0, route: null, startsAt: 0, endsAt: 0, nextAt: 0, results: [] };
}

/** The Realtime Database drops empty arrays and objects: put them back. */
export function normalize(state: RaceState): RaceState {
  const current = normalizeCore(state);
  return { ...current, route: current.route ? { ...current.route, closed: current.route.closed ?? [] } : null };
}

export const normalizeRun = (run: Partial<Run> | null | undefined): Run => ({ at: run?.at ?? 0, guesses: run?.guesses ?? [], gaveUp: run?.gaveUp ?? false });

export function setMap(state: RaceState, map: MapChoice): RaceState {
  if (state.phase !== "lobby") throw new Error("Only in the lobby.");
  if (!MAP_CHOICES.includes(map)) throw new Error("No such map.");
  return { ...normalize(state), map };
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

export const race = createRace<RaceState, Run>({
  roundMs: ROUND_MS,
  penaltyMs: PENALTY_MS,
  lobby: (mode, from) => ({ ...newRace(mode), ...(from ? { map: from.map, rounds: from.rounds } : {}) }),
  normalize,
  roundContent: (state, round, seed) => ({ route: routeFor(state.map, round, seed) }),
  score: (state, run) => (state.route ? scoreOf(state.route, run, state.startsAt) : { ms: ROUND_MS, extra: 0, found: 0, done: false }),
});

export const { setMode, setRounds, start, backToLobby, total, compareScores, ranking, knockedOut, roundOver, endRound, decided, next, roundPoints, standings } = race;
