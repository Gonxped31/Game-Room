/** The working title shown in the UI and the browser tab. */
export const GAME_TITLE = "Night Highway";

/** A run's length once the countdown ends. */
export const RUN_SECONDS = 60;
/** The 3-2-1 countdown before a run, during which the car cruises on its own. */
export const COUNTDOWN_SECONDS = 3;
/** The speed (m/s) every car cruises at through the countdown, so both racers reach "Go" side by side. */
export const COUNTDOWN_SPEED = 31;
/**
 * How long after the second "Ready" a race's countdown starts. It gives the
 * other device time to receive the start before its countdown would begin.
 */
export const RACE_START_DELAY_MS = 2000;
/**
 * How long after a race should have ended a missing result is given up on
 * (the other player's tab closed mid-race), so the room isn't stuck.
 */
export const RESULT_GRACE_MS = 20000;
/** How often (ms) a racer sends their car's position for the other's ghost. */
export const LIVE_INTERVAL_MS = 100;

/** Lane centres (m) on our side of the freeway, left (fast lane, by the median) to right. */
export const LANES = [-5.4, -1.8, 1.8, 5.4] as const;
/** Each seat's starting lane: p1 left of centre, p2 right of centre. */
export const START_LANE = { p1: 1, p2: 2 } as const;
