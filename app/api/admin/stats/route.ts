import { NextResponse } from "next/server";
import { AdminConfigError, adminDb } from "@/lib/admin/firebaseAdmin";
import { STATS_SINCE_PATH } from "@/lib/admin/clearStats";
import { NO_STORE, refuseUnlessAdmin } from "@/lib/admin/guard";
import { toSnapshot } from "@/lib/analytics/gameRoomAdapter";
import { computeDashboard } from "@/lib/analytics/metrics";
import { computeFinished, computeSources, rangeFromParams, resolveRange } from "@/lib/analytics/tracking";
import { toTrackingSnapshot } from "@/lib/analytics/trackingAdapter";
import type { AdminStats } from "@/lib/analytics/types";
import { ALL_GAMES } from "@/lib/games/registry";
import { FINISHED_GAMES, FINISHED_PLAYERS } from "@/lib/tracking/events";

/**
 * The dashboard's numbers. Reads every room, every guest's room list and
 * first touch, the summaries of deleted rooms, the finished games
 * (docs/tracking.md) and the time of the last stats clear with the admin
 * SDK, and returns only the aggregates - never the raw tree.
 * Reading all of `games` (game state included) and `finished` is fine at
 * this scale; if it grows, read shallow keys and only the room-level nodes,
 * and query `finished` by `at` (both nodes have `.indexOn: at`).
 * Query: the source table's days, `?range=7d|30d|week|lastweek|all` or
 * `?from=YYYY-MM-DD&to=YYYY-MM-DD` (Toronto days); 30 days by default.
 */
export async function GET(request: Request) {
  const refused = await refuseUnlessAdmin();
  if (refused) return refused;
  try {
    const db = adminDb();
    const [games, users, archive, statsSince, finishedGames, finishedPlayers] = await Promise.all([
      db.ref("games").get(),
      db.ref("users").get(),
      db.ref("analytics/archive").get(),
      db.ref(STATS_SINCE_PATH).get(),
      db.ref(FINISHED_GAMES).get(),
      db.ref(FINISHED_PLAYERS).get(),
    ]);
    const now = Date.now();
    const since = typeof statsSince.val() === "number" ? (statsSince.val() as number) : undefined;
    const order = ALL_GAMES.map((game) => game.slug);
    const tracking = toTrackingSnapshot(
      { games: games.val(), users: users.val(), archive: archive.val(), finishedGames: finishedGames.val(), finishedPlayers: finishedPlayers.val() },
      now,
      since,
    );
    const stats: AdminStats = {
      ...computeDashboard(toSnapshot(games.val(), users.val(), now, archive.val(), since), order),
      finished: computeFinished(tracking, order),
      sources: computeSources(tracking, resolveRange(rangeFromParams(new URL(request.url).searchParams), now)),
    };
    return NextResponse.json(stats, { headers: NO_STORE });
  } catch (error) {
    if (!(error instanceof AdminConfigError)) console.error("Admin stats failed", error);
    const message = error instanceof AdminConfigError ? error.message : "Couldn't read the database.";
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}
