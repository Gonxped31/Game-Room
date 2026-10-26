/** The working title shown in the UI and the browser tab (the name isn't final yet). */
export const GAME_TITLE = "Border Run";

/** Each guess beyond the par adds this to the time (the user's call, 2026-10-26). */
export const PENALTY_MS = 15_000;

/**
 * The maps a route can be drawn on. Oceania has almost no land borders, so it
 * has no map of its own; "eurasia" is Europe and Asia together.
 */
export const AREAS = ["europe", "americas", "africa", "asia", "eurasia", "world"] as const;
export type Area = (typeof AREAS)[number];

/** How long a route can be, in countries between the start and the end. */
export const MIN_PAR = 2;
export const MAX_PAR = 8;

/** How long routes are on each map, in countries between start and end: Endless, and the race's (which climbs through it round by round). The daily's weekday ranges. */
export const PAR_RANGE: Record<Area, { minPar: number; maxPar: number }> = {
  europe: { minPar: 3, maxPar: 5 },
  americas: { minPar: 3, maxPar: 5 },
  africa: { minPar: 3, maxPar: 5 },
  asia: { minPar: 3, maxPar: 5 },
  eurasia: { minPar: 4, maxPar: 6 },
  world: { minPar: 5, maxPar: 7 },
};
