import { createGameStore } from "@/lib/store";

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
