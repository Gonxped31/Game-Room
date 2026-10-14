import type { Role } from "./types";

/** How often a client refreshes its own heartbeat. */
export const HEARTBEAT_INTERVAL_MS = 4000;

/** A seat with no heartbeat newer than this is considered offline - a few missed beats, not just one, to tolerate normal network jitter. */
export const STALE_AFTER_MS = 3 * HEARTBEAT_INTERVAL_MS;

/** Last-heartbeat timestamp (epoch ms) per seat, kept in its own store path so it never collides with a game's own state writes. */
export type Presence = Partial<Record<Role, number>>;

/** `now: null` means the clock hasn't been read yet (e.g. still server-rendering) - treat as "not yet known", same as having no presence data. */
export function isOnline(presence: Presence | null, role: Role | null, now: number | null): boolean {
  if (!role || now == null) return false;
  const lastSeen = presence?.[role];
  return lastSeen != null && now - lastSeen < STALE_AFTER_MS;
}
