import { type Database, ServerValue } from "firebase-admin/database";

export interface CloseResult {
  closed: string[];
  alreadyClosed: string[];
  /** No such room (deleted since the dashboard loaded, or never existed). */
  missing: string[];
}

/**
 * Closes rooms: sets `games/{code}/closedAt` on each open one, in a single
 * update. From then on the rules refuse every client change except guests
 * marking themselves offline, and every device in the room shows "This room
 * was closed". A public (matchmade) room also leaves the matchmaking queue,
 * so nobody is sent to it. The data stays, so the dashboard keeps its history.
 */
export async function closeRooms(db: Database, codes: string[]): Promise<CloseResult> {
  const result: CloseResult = { closed: [], alreadyClosed: [], missing: [] };
  const update: Record<string, unknown> = {};
  // Read, then write: a room closed twice at once just gets the later timestamp.
  await Promise.all(
    codes.map(async (code) => {
      const room = db.ref(`games/${code}`);
      const [meta, closedAt] = await Promise.all([room.child("meta").get(), room.child("closedAt").get()]);
      if (!meta.exists()) return result.missing.push(code);
      if (closedAt.exists()) return result.alreadyClosed.push(code);
      const { gameSlug, publicLang } = meta.val() as { gameSlug?: string; publicLang?: string };
      update[`games/${code}/closedAt`] = ServerValue.TIMESTAMP;
      if (gameSlug && publicLang) update[`queue/${gameSlug}/${publicLang}/${code}`] = null;
      result.closed.push(code);
    }),
  );
  if (result.closed.length) await db.ref().update(update);
  return result;
}
