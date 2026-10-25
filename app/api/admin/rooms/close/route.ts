import { NextResponse } from "next/server";
import { closeRooms, parseRoomCodes } from "@/lib/admin/closeRooms";
import { AdminConfigError, adminDb } from "@/lib/admin/firebaseAdmin";
import { NO_STORE, refuseUnlessAdmin } from "@/lib/admin/guard";

/**
 * Closes several rooms at once (the dashboard's selection): body
 * `{codes: [...]}`, answer `{closed, alreadyClosed, missing}` (code lists).
 * Rooms that are gone or already closed are skipped, not an error.
 */
export async function POST(request: Request) {
  const refused = await refuseUnlessAdmin();
  if (refused) return refused;
  const parsed = parseRoomCodes(await request.json().catch(() => null));
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });
  try {
    return NextResponse.json(await closeRooms(adminDb(), parsed.codes), { headers: NO_STORE });
  } catch (error) {
    if (!(error instanceof AdminConfigError)) console.error(`Admin close of ${parsed.codes.length} rooms failed`, error);
    const message = error instanceof AdminConfigError ? error.message : "Couldn't close the rooms.";
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}
