import type { Lang } from "@/lib/i18n/lang";

/**
 * "Game finished" events: the north-star metric, games finished per week
 * (docs/tracking.md). A game reports once when it reaches its REAL end (a
 * match result, a final score, the end of a race, a finished solo game).
 * Abandoned or unfinished games never report. Daily puzzles are recorded by
 * the server when the result is submitted (app/api/daily/), so daily pages
 * don't call this.
 *
 * Every seated player's device calls it; one finished game is still counted
 * once (the event is created once per key), and each player's device adds its
 * own participation, with that guest's first-touch source.
 */

/** room: a private room; match: a matchmade room; challenge/survival: a race (matchmade or not, see `matchmade`). */
export type FinishMode = "room" | "match" | "solo" | "daily" | "challenge" | "survival";

export interface FinishedGame {
  /** The data slug (`ftw`, `regions`, ...). */
  slug: string;
  mode: FinishMode;
  /**
   * Identifies this one game, the same on every player's device: for a room
   * game, something in the shared state that changes with each new match in
   * the room (a match number, its start time); for a solo game, an id made
   * once per game on this device. Letters, digits and "-" only, 1-40 chars.
   */
  id: string;
  /** A room game's code (the database checks the reporter is seated there). Omitted for solo games. */
  room?: string;
  /** Players who took part in this game. */
  players: number;
  /** The game's content language if it has one (Buzzer Quiz, Word Scramble, Same Page), else the interface language. */
  lang: Lang;
  /** A race (challenge/survival) filled by matchmaking. */
  matchmade?: boolean;
}

/**
 * Records a finished game: fire-and-forget, never throws, a no-op when the
 * same game was already reported from this device. Call it from an effect or
 * an event handler, never during render.
 */
export function reportFinished(game: FinishedGame): void {
  // Stub: the database write lands with the tracking layer (docs/tracking.md).
  void game;
}
