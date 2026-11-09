import { ServerValue } from "firebase-admin/database";
import { FINISHED_ROOT } from "@/lib/tracking/events";

/** Where the time of the last stats clear is kept (admin only, like the rest of `analytics/`). */
export const STATS_SINCE_PATH = "analytics/statsSince";

/**
 * The single update that clears the dashboard's stats, given the `users`
 * tree. It erases what only the stats use - deleted rooms' summaries
 * (`analytics/archive`), every guest's visit days (`users/{uid}/visits`) and
 * the finished games (`finished`, docs/tracking.md) - and records when, so
 * history from before is left out of every number.
 * Rooms and guests' room lists stay: live rooms and "Your rooms" run on them.
 * So do guests' first touches (`users/{uid}/firstTouch`, written once): they
 * say where a guest came from, and only guests first seen since the clear
 * count as new.
 */
export function clearStatsUpdate(users: unknown): Record<string, unknown> {
  const update: Record<string, unknown> = { "analytics/archive": null, [FINISHED_ROOT]: null, [STATS_SINCE_PATH]: ServerValue.TIMESTAMP };
  if (users && typeof users === "object") {
    for (const [uid, user] of Object.entries(users as Record<string, { visits?: unknown } | null>)) {
      if (user?.visits != null) update[`users/${uid}/visits`] = null;
    }
  }
  return update;
}
