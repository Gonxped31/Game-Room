import { NextResponse } from "next/server";
import { ServerValue } from "firebase-admin/database";
import { AdminConfigError, adminDb } from "@/lib/admin/firebaseAdmin";
import { NO_STORE, refuseUnlessAdmin } from "@/lib/admin/guard";
import { isRoomCode } from "@/lib/session/room";

/**
 * Closes a room: sets `games/{code}/closedAt`. From then on the rules refuse
 * every client change except guests marking themselves offline, and every
 * device in the room shows "This room was closed". The data stays, so the
 * dashboard's history keeps it; deleting comes separately (T-061).
 */
export async function POST(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const refused = await refuseUnlessAdmin();
  if (refused) return refused;
  const { code } = await params;
  if (!isRoomCode(code)) return NextResponse.json({ error: "Not a room code." }, { status: 400, headers: NO_STORE });
  try {
    const db = adminDb();
    const room = db.ref(`games/${code}`);
    // Read, then write: a room closed twice at once just gets the later timestamp.
    const [meta, closedAt] = await Promise.all([room.child("meta").get(), room.child("closedAt").get()]);
    if (!meta.exists()) return NextResponse.json({ error: "No such room." }, { status: 404, headers: NO_STORE });
    if (!closedAt.exists()) {
      // A public (matchmade) room also leaves the matchmaking queue, so nobody is sent to it.
      const { gameSlug, publicLang } = meta.val() as { gameSlug?: string; publicLang?: string };
      await db.ref().update({
        [`games/${code}/closedAt`]: ServerValue.TIMESTAMP,
        ...(gameSlug && publicLang ? { [`queue/${gameSlug}/${publicLang}/${code}`]: null } : {}),
      });
    }
    return NextResponse.json({ closed: true }, { headers: NO_STORE });
  } catch (error) {
    if (!(error instanceof AdminConfigError)) console.error(`Admin close of ${code} failed`, error);
    const message = error instanceof AdminConfigError ? error.message : "Couldn't close the room.";
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}
