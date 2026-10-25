import { NextResponse } from "next/server";
import { deleteRooms } from "@/lib/admin/deleteRooms";
import { AdminConfigError, adminDb } from "@/lib/admin/firebaseAdmin";
import { NO_STORE, refuseUnlessAdmin } from "@/lib/admin/guard";
import { parseRoomCodes } from "@/lib/admin/roomCodes";

/**
 * Deletes several closed rooms at once (the dashboard's selection): body
 * `{codes: [...]}`, answer `{deleted, notClosed, missing}` (code lists).
 * Rooms that are gone or still open are skipped, not an error.
 */
export async function POST(request: Request) {
  const refused = await refuseUnlessAdmin();
  if (refused) return refused;
  const parsed = parseRoomCodes(await request.json().catch(() => null));
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });
  try {
    return NextResponse.json(await deleteRooms(adminDb(), parsed.codes, Date.now()), { headers: NO_STORE });
  } catch (error) {
    if (!(error instanceof AdminConfigError)) console.error(`Admin delete of ${parsed.codes.length} rooms failed`, error);
    const message = error instanceof AdminConfigError ? error.message : "Couldn't delete the rooms.";
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}
