import type { PresenceEntry, RoomMeta, UserRoomEntry } from "@/lib/session/shared/updates";
import type { GuestSnap, RoomSnap, Snapshot } from "./types";

/**
 * Game Room's side of the analytics: turns the raw `games` and `users` trees
 * (read with firebase-admin) into a platform-neutral `Snapshot`. Only the
 * room-level nodes are used; game state is never looked at. Malformed
 * entries are skipped rather than trusted.
 */

interface RawRoom {
  meta?: Partial<RoomMeta>;
  seats?: Record<string, string | null>;
  presence?: Record<string, Partial<PresenceEntry>>;
  lastActive?: unknown;
}

interface RawUser {
  rooms?: Record<string, Partial<UserRoomEntry>>;
}

const isTime = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;
const entries = <T>(tree: unknown) => (tree && typeof tree === "object" ? Object.entries(tree as Record<string, T>) : []);

export function toRoomSnap(code: string, raw: RawRoom): RoomSnap | null {
  const meta = raw?.meta;
  if (!meta || typeof meta.gameSlug !== "string" || !isTime(meta.createdAt)) return null;
  return {
    code,
    gameSlug: meta.gameSlug,
    createdAt: meta.createdAt,
    lastActive: isTime(raw.lastActive) ? raw.lastActive : undefined,
    name: typeof meta.name === "string" ? meta.name : undefined,
    seatsFilled: entries<string | null>(raw.seats).filter(([, uid]) => typeof uid === "string" && uid).length,
    maxPlayers: typeof meta.maxPlayers === "number" ? meta.maxPlayers : 2,
    onlineUids: entries<Partial<PresenceEntry>>(raw.presence)
      .filter(([, entry]) => entry?.online === true)
      .map(([uid]) => uid),
  };
}

export function toGuestSnap(uid: string, raw: RawUser): GuestSnap {
  return {
    uid,
    rooms: entries<Partial<UserRoomEntry>>(raw?.rooms).flatMap(([code, entry]) =>
      entry && typeof entry.gameSlug === "string" && isTime(entry.addedAt)
        ? [{ code, gameSlug: entry.gameSlug, addedAt: entry.addedAt, createdByMe: entry.createdByMe === true }]
        : [],
    ),
  };
}

/** `games` and `users` as read from the database root (either may be null when empty). */
export function toSnapshot(games: unknown, users: unknown, now: number): Snapshot {
  return {
    rooms: entries<RawRoom>(games).flatMap(([code, raw]) => toRoomSnap(code, raw) ?? []),
    guests: entries<RawUser>(users).map(([uid, raw]) => toGuestSnap(uid, raw)),
    now,
  };
}
