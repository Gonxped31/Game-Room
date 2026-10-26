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
