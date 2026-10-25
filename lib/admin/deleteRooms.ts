import type { Database } from "firebase-admin/database";
import { type RawRoom, toArchivedRoom } from "@/lib/analytics/gameRoomAdapter";

export interface DeleteResult {
  deleted: string[];
  /** Still open: a room is closed before it can be deleted. */
  notClosed: string[];
  /** No such room (deleted since the dashboard loaded, or never existed). */
  missing: string[];
}

/**
 * Deletes closed rooms, in a single update: each `games/{code}` goes with its
 * `roomsByName` entry, and a summary goes to `analytics/archive/{code}` so
 * the dashboard's history keeps it. Anyone who opens one of their links again
 * gets a fresh, empty room at that code. Open rooms are skipped.
 */
export async function deleteRooms(db: Database, codes: string[], now: number): Promise<DeleteResult> {
  const result: DeleteResult = { deleted: [], notClosed: [], missing: [] };
  const [snaps, users] = await Promise.all([Promise.all(codes.map((code) => db.ref(`games/${code}`).get())), db.ref("users").get()]);
  const update: Record<string, unknown> = {};
  await Promise.all(
    codes.map(async (code, i) => {
      const raw = snaps[i].val() as RawRoom | null;
      if (!raw?.meta) return result.missing.push(code);
      if (raw.closedAt == null) return result.notClosed.push(code);
      const nameKey = raw.meta.nameKey;
      // The name only goes if it still points here (a closed room can't be renamed, but check anyway).
      if (nameKey && (await db.ref(`roomsByName/${nameKey}`).get()).val() === code) update[`roomsByName/${nameKey}`] = null;
      const summary = toArchivedRoom(code, raw, users.val(), now);
      if (summary) update[`analytics/archive/${code}`] = summary;
      update[`games/${code}`] = null;
      result.deleted.push(code);
    }),
  );
  if (result.deleted.length) await db.ref().update(update);
  return result;
}
