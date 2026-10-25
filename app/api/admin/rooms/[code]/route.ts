import { NextResponse } from "next/server";
import { AdminConfigError, adminDb } from "@/lib/admin/firebaseAdmin";
import { NO_STORE, refuseUnlessAdmin } from "@/lib/admin/guard";
import { type RawRoom, toArchivedRoom } from "@/lib/analytics/gameRoomAdapter";
import { isRoomCode } from "@/lib/session/room";

/**
 * Deletes a closed room (close it first: POST .../close). One update removes
 * `games/{code}` and its `roomsByName` entry, and writes a summary to
 * `analytics/archive/{code}` so the dashboard's history keeps it. Anyone who
 * opens the link again gets a fresh, empty room at that code.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const refused = await refuseUnlessAdmin();
  if (refused) return refused;
  const { code } = await params;
  if (!isRoomCode(code)) return NextResponse.json({ error: "Not a room code." }, { status: 400, headers: NO_STORE });
  try {
    const db = adminDb();
    const room = await db.ref(`games/${code}`).get();
    const raw = room.val() as RawRoom | null;
    if (!raw?.meta) return NextResponse.json({ error: "No such room." }, { status: 404, headers: NO_STORE });
    if (raw.closedAt == null) return NextResponse.json({ error: "Close the room before deleting it." }, { status: 409, headers: NO_STORE });
    const nameKey = raw.meta.nameKey;
    const [users, nameEntry] = await Promise.all([db.ref("users").get(), nameKey ? db.ref(`roomsByName/${nameKey}`).get() : null]);
    const summary = toArchivedRoom(code, raw, users.val(), Date.now());
    await db.ref().update({
      [`games/${code}`]: null,
      // The name only goes if it still points here (a closed room can't be renamed, but check anyway).
      ...(nameKey && nameEntry?.val() === code ? { [`roomsByName/${nameKey}`]: null } : {}),
      ...(summary ? { [`analytics/archive/${code}`]: summary } : {}),
    });
    return NextResponse.json({ deleted: true }, { headers: NO_STORE });
  } catch (error) {
    if (!(error instanceof AdminConfigError)) console.error(`Admin delete of ${code} failed`, error);
    const message = error instanceof AdminConfigError ? error.message : "Couldn't delete the room.";
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}
