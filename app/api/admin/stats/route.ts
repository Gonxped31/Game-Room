import { NextResponse } from "next/server";
import { AdminConfigError, adminDb } from "@/lib/admin/firebaseAdmin";
import { NO_STORE, refuseUnlessAdmin } from "@/lib/admin/guard";
import { toSnapshot } from "@/lib/analytics/gameRoomAdapter";
import { computeDashboard } from "@/lib/analytics/metrics";
import { ALL_GAMES } from "@/lib/games/registry";

/**
 * The dashboard's numbers. Reads every room, every guest's room list and the
 * summaries of deleted rooms with the admin SDK, and returns only the
 * aggregates - never the raw tree.
 * Reading all of `games` (game state included) is fine at this scale; if it
 * grows, read shallow keys and only the room-level nodes.
 */
export async function GET() {
  const refused = await refuseUnlessAdmin();
  if (refused) return refused;
  try {
    const db = adminDb();
    const [games, users, archive] = await Promise.all([db.ref("games").get(), db.ref("users").get(), db.ref("analytics/archive").get()]);
    const stats = computeDashboard(
      toSnapshot(games.val(), users.val(), Date.now(), archive.val()),
      ALL_GAMES.map((game) => game.slug),
    );
    return NextResponse.json(stats, { headers: NO_STORE });
  } catch (error) {
    if (!(error instanceof AdminConfigError)) console.error("Admin stats failed", error);
    const message = error instanceof AdminConfigError ? error.message : "Couldn't read the database.";
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}
