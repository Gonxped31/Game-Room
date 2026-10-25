import { ServerValue } from "firebase-admin/database";

/** Where the time of the last stats clear is kept (admin only, like the rest of `analytics/`). */
export const STATS_SINCE_PATH = "analytics/statsSince";

/**
 * The single update that clears the dashboard's stats, given the `users`
 * tree. It erases what only the stats use - deleted rooms' summaries
 * (`analytics/archive`) and every guest's visit days (`users/{uid}/visits`) -
 * and records when, so history from before is left out of every number.
 * Rooms and guests' room lists stay: live rooms and "Your rooms" run on them.
 */
export function clearStatsUpdate(users: unknown): Record<string, unknown> {
  const update: Record<string, unknown> = { "analytics/archive": null, [STATS_SINCE_PATH]: ServerValue.TIMESTAMP };
  if (users && typeof users === "object") {
    for (const [uid, user] of Object.entries(users as Record<string, { visits?: unknown } | null>)) {
      if (user?.visits != null) update[`users/${uid}/visits`] = null;
    }
  }
  return update;
}
