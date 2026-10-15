import { HEARTBEAT_INTERVAL_MS, STALE_AFTER_MS } from "../presence";
import type { SeatId } from "./types";

// Re-exported rather than redefined - these are pure timing constants with
// zero player-count coupling, so there's no reason for the multiplayer and
// 1v1 session layers to drift on how often a heartbeat fires or how stale is
// "offline".
export { HEARTBEAT_INTERVAL_MS, STALE_AFTER_MS };

/** Last-heartbeat timestamp (epoch ms) per seat, kept in its own store path so it never collides with a game's own state writes. */
export type MultiplayerPresence = Partial<Record<SeatId, number>>;

/** `now: null` means the clock hasn't been read yet (e.g. still server-rendering) - treat as "not yet known", same as having no presence data. */
export function isSeatOnline(presence: MultiplayerPresence | null, seat: SeatId | null, now: number | null): boolean {
  if (!seat || now == null) return false;
  const lastSeen = presence?.[seat];
  return lastSeen != null && now - lastSeen < STALE_AFTER_MS;
}
