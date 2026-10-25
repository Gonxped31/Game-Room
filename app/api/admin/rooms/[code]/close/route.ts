import { NextResponse } from "next/server";
import { closeRooms } from "@/lib/admin/closeRooms";
import { AdminConfigError, adminDb } from "@/lib/admin/firebaseAdmin";
import { NO_STORE, refuseUnlessAdmin } from "@/lib/admin/guard";
import { isRoomCode } from "@/lib/session/room";

/**
 * Closes one room (see `closeRooms`). Several at once: POST
 * /api/admin/rooms/close. Deleting comes separately (T-061).
 */
export async function POST(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const refused = await refuseUnlessAdmin();
  if (refused) return refused;
  const { code } = await params;
  if (!isRoomCode(code)) return NextResponse.json({ error: "Not a room code." }, { status: 400, headers: NO_STORE });
  try {
    const { missing } = await closeRooms(adminDb(), [code]);
    if (missing.length) return NextResponse.json({ error: "No such room." }, { status: 404, headers: NO_STORE });
    return NextResponse.json({ closed: true }, { headers: NO_STORE });
  } catch (error) {
    if (!(error instanceof AdminConfigError)) console.error(`Admin close of ${code} failed`, error);
    const message = error instanceof AdminConfigError ? error.message : "Couldn't close the room.";
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}
