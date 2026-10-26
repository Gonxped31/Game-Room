/**
 * What a game hands the shared daily system (lib/daily/service.ts). The
 * system does the rest: today's secret seed, the server-timed start and
 * finish, one ranked attempt per guest and per connection, the leaderboard,
 * streaks and names.
 */
export interface DailyGame<P = unknown> {
  slug: string;
  title: string;
  /** A short line for the day's puzzle, e.g. "Knight · 7×7". */
  describe(day: string): string;
  /** The day's puzzle from its secret seed: the same seed always gives the same puzzle. What it returns is sent to the player. */
  generate(seed: string, day: string): P;
  /** Checks a submitted game (untrusted JSON) against the puzzle. */
  verify(puzzle: P, moves: unknown): Verdict;
  /** Faster than this isn't a person: the attempt counts, unranked. */
  minHumanMs(puzzle: P): number;
}

export type Verdict =
  | {
      ok: true;
      /** When each move was made, ms after the start by the player's clock (for the bot check). */
      moveTimes: number[];
      /** Added to the server's time for the board, e.g. Border Run's seconds per guess beyond the par. None by default. */
      penaltyMs?: number;
    }
  | { ok: false; reason: string };
