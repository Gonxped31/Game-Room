import { createGameStore, createRoomNameIndexStore } from "@/lib/store";

/**
 * Which game a room code belongs to, plus an optional human-friendly name -
 * lives in its own store path (`games/{room}/meta`, via createGameStore's
 * ordinary `gameSlug` nesting with the slug literally "meta"), a sibling of
 * each game's own state and of `presence`, for the same reason presence
 * isn't folded into a game's own object: it changes independently of
 * gameplay and needs to be readable without knowing (or touching) whatever
 * game-specific state shape is in play.
 *
 * `gameSlug` is what makes "join a room by code" possible from the picker
 * page without asking which game it's for - the first client to open a
 * fresh room (in useGameSession) records it here, and a typed-in code can
 * be looked up via `readRoomMeta` to find out where to route to.
 */
export interface RoomMeta {
  gameSlug: string;
  /** User-chosen room name. Absent (never an explicit `undefined`, per the
   * Firebase write gotcha) means "no custom name" - callers should fall back
   * to displaying the room code itself. */
  name?: string;
}

/**
 * One-off lookup of an arbitrary room code's meta, independent of whichever
 * room (if any) the current page is itself subscribed to - what the picker
 * page's "join a room" form uses to find which game a typed-in code belongs
 * to before routing there. Returns null for a code with no meta at all
 * (never visited since this feature shipped, or simply doesn't exist).
 */
export function readRoomMeta(room: string): Promise<RoomMeta | null> {
  return createGameStore<RoomMeta>(room, "meta").readOnce();
}

/** Trim + lowercase, so "Birthday Crew" and "birthday crew" land in the same name-index bucket. */
export function normalizeRoomName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * The room-name -> room-codes index store for one (already normalized) name.
 * `useGameSession.ts`'s `setRoomName` writes to this; `findRoomsByName` below
 * reads it. Exported mainly for that writer - most callers want
 * `findRoomsByName` instead.
 */
export function roomNameIndexStore(name: string) {
  return createRoomNameIndexStore(normalizeRoomName(name));
}

/**
 * Every room currently registered under `name` (case/whitespace-insensitive),
 * validated live against each candidate's own meta - a renamed-away room
 * leaves a stale index entry behind (best-effort cleanup only, see
 * `useGameSession.ts`), so this is what actually filters those back out
 * rather than trusting the index alone. What the picker's "join a room by
 * name" form calls.
 */
export async function findRoomsByName(name: string): Promise<{ room: string; meta: RoomMeta }[]> {
  const normalized = normalizeRoomName(name);
  if (!normalized) return [];
  const index = await createRoomNameIndexStore(normalized).readOnce();
  const codes = Object.keys(index ?? {});
  const candidates = await Promise.all(codes.map(async (room) => ({ room, meta: await readRoomMeta(room) })));
  return candidates.filter((c): c is { room: string; meta: RoomMeta } => c.meta != null && normalizeRoomName(c.meta.name ?? "") === normalized);
}
