import { NextResponse } from "next/server";
import { deleteRooms } from "@/lib/admin/deleteRooms";
import { AdminConfigError, adminDb } from "@/lib/admin/firebaseAdmin";
import { NO_STORE, refuseUnlessAdmin } from "@/lib/admin/guard";
import { isRoomCode } from "@/lib/session/room";

/**
 * Deletes one closed room (see `deleteRooms`; close it first: POST
 * .../close). Several at once: POST /api/admin/rooms/delete.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const refused = await refuseUnlessAdmin();
  if (refused) return refused;
  const { code } = await params;
  if (!isRoomCode(code)) return NextResponse.json({ error: "Not a room code." }, { status: 400, headers: NO_STORE });
  try {
    const { missing, notClosed } = await deleteRooms(adminDb(), [code], Date.now());
    if (missing.length) return NextResponse.json({ error: "No such room." }, { status: 404, headers: NO_STORE });
    if (notClosed.length) return NextResponse.json({ error: "Close the room before deleting it." }, { status: 409, headers: NO_STORE });
    return NextResponse.json({ deleted: true }, { headers: NO_STORE });
  } catch (error) {
    if (!(error instanceof AdminConfigError)) console.error(`Admin delete of ${code} failed`, error);
    const message = error instanceof AdminConfigError ? error.message : "Couldn't delete the room.";
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}
