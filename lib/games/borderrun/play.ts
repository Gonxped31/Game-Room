import { AREA_COUNTRIES } from "./areas";
import { PENALTY_MS } from "./constants";
import { isCountry } from "./countries";
import { neighboursOf, shortestPath, type Route } from "./route";

/** One guess: a country code, `t` ms after the start by the player's clock. */
export interface Guess {
  code: string;
  t: number;
}

/** A route in progress: the guesses so far, in order. */
export interface Play {
  route: Route;
  guesses: Guess[];
}

export const newPlay = (route: Route): Play => ({ route, guesses: [] });

/** Why a guess can't be taken; the page says so, and the guess doesn't count. */
export type Refusal = "unknown" | "not-on-map" | "endpoint" | "repeat" | "done";

export function refusalOf(play: Play, code: string | null): Refusal | null {
  if (code === null || !isCountry(code)) return "unknown";
  if (status(play).complete) return "done";
  if (!AREA_COUNTRIES[play.route.area].has(code)) return "not-on-map";
  if (code === play.route.start || code === play.route.end) return "endpoint";
  if (play.guesses.some((guess) => guess.code === code)) return "repeat";
  return null;
}

/** Adds a guess; throws on one refusalOf refuses, or a time that goes backwards. */
export function addGuess(play: Play, code: string, t: number): Play {
  const refusal = refusalOf(play, code);
  if (refusal) throw new Error(`Guess refused: ${refusal}`);
  const last = play.guesses[play.guesses.length - 1];
  if (!Number.isFinite(t) || t < 0 || (last && t < last.t)) throw new Error("Bad time");
  return { ...play, guesses: [...play.guesses, { code, t }] };
}

/** Replays a guess log on a route; throws where addGuess would. */
export function replay(route: Route, guesses: readonly Guess[]): Play {
  return guesses.reduce((play, guess) => addGuess(play, guess.code, guess.t), newPlay(route));
}

export interface Status {
  /** The guesses link start to end. */
  complete: boolean;
  /** The shortest route through the guesses, start and end included, once complete. */
  path: string[] | null;
  /** Guesses beyond the par. */
  extra: number;
  penaltyMs: number;
}

/**
 * The run so far, as links between neighbours (each [from, to]), for the map
 * to draw as you play: grown from the start and from the end, one guess at a
 * time. A guess links to the first country of the run it borders (by when
 * that one joined); a guess that borders none waits, and links as soon as a
 * neighbour joins. A new guess only ever adds links, so the drawing never
 * jumps.
 */
export function links(play: Play): [string, string][] {
  const neighbours = neighboursOf(play.route);
  const joined = [play.route.start, play.route.end];
  const result: [string, string][] = [];
  let waiting: string[] = [];
  for (const { code } of play.guesses) {
    waiting.push(code);
    // Link whatever now can, until nothing more does: one guess can bring in others waiting on it.
    for (let more = true; more; ) {
      more = false;
      for (const candidate of waiting) {
        const borders = new Set(neighbours(candidate));
        const to = joined.find((code) => borders.has(code));
        if (to === undefined) continue;
        result.push([to, candidate]);
        joined.push(candidate);
        waiting = waiting.filter((code) => code !== candidate);
        more = true;
        break;
      }
    }
  }
  return result;
}

export function status(play: Play): Status {
  const guessed = new Set(play.guesses.map((guess) => guess.code));
  const { start, end } = play.route;
  const path = shortestPath(play.route, (code) => guessed.has(code) || code === start || code === end);
  const extra = Math.max(0, play.guesses.length - play.route.par);
  return { complete: path !== null, path, extra, penaltyMs: extra * PENALTY_MS };
}
