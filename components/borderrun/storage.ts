import { AREAS, MAX_PAR, MIN_PAR, type Area } from "@/lib/games/borderrun/constants";
import { isCountry } from "@/lib/games/borderrun/countries";
import type { Guess } from "@/lib/games/borderrun/play";
import { shortestPath, type Route } from "@/lib/games/borderrun/route";

/**
 * What this device remembers for Detour, so a reload loses nothing: the
 * tab, the Endless route in progress and today's Daily guesses. (Country
 * names follow the page's language, /fr or not: the old per-device names
 * switch, "border-run:lang", is gone and no longer read.) Every read and
 * write is wrapped in try/catch (storage can be blocked) and only ever runs
 * in effects or handlers, never during render.
 */
export const MODE_KEY = "border-run:mode";
export const ENDLESS_KEY = "border-run:endless:v1";
export const ENDLESS_GAME_KEY = "border-run:endless-game:v1";
export const DAILY_KEY = "border-run:daily:v1";
export const DAILY_GUESSES_KEY = "border-run:daily-guesses:v1";

export function readJson(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Not saved: the game plays the same.
  }
}

export function removeKey(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing to do.
  }
}

/** An Endless route in progress: the route, the guesses, the time spent on it before the page closed, and its id (for the "game finished" report; missing in games saved before it existed). */
export interface SavedEndlessGame {
  route: Route;
  guesses: Guess[];
  elapsed: number;
  id?: string;
}

/** Today's Daily guesses (the server keeps the route and the clock); kept once finished, with the route, for the map and the share text. */
export interface SavedDailyGuesses {
  day: string;
  route: Route;
  guesses: Guess[];
}

export const isArea = (value: unknown): value is Area => AREAS.includes(value as Area);

/** A stored route that holds together: real countries, and a par that is its shortest route's. */
export function isRoute(value: unknown): value is Route {
  const r = value as Route | null;
  if (!r || !isArea(r.area) || !isCountry(r.start) || !isCountry(r.end) || !Number.isInteger(r.par) || r.par < MIN_PAR || r.par > MAX_PAR) return false;
  if (!Array.isArray(r.closed) || !r.closed.every((pair) => Array.isArray(pair) && pair.length === 2 && pair.every(isCountry))) return false;
  return shortestPath(r)?.length === r.par + 2;
}
