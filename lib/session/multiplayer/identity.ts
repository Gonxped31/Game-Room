import type { SeatId, WithMultiplayerIdentity } from "./types";

const MAX_NAME_LENGTH = 24;

/**
 * Sets a player's display name. Generic over any multiplayer game's state (as
 * long as it has a `names` field) so every game can reuse this instead of
 * reimplementing it - always valid regardless of whatever in-game status/phase
 * the game is in. Direct counterpart to the 1v1 session layer's
 * `setIdentityName`, generalized from `Role` to the open `SeatId` type.
 */
export function setMultiplayerIdentityName<T extends WithMultiplayerIdentity>(state: T, seat: SeatId, name: string): T {
  const trimmed = name.trim().slice(0, MAX_NAME_LENGTH);
  if (!trimmed) {
    throw new Error("Name cannot be empty.");
  }
  return { ...state, names: { ...state.names, [seat]: trimmed } };
}
