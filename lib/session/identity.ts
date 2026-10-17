import type { Role, WithIdentity } from "./types";

const MAX_NAME_LENGTH = 24;
const ALL_ROLES: readonly Role[] = ["p1", "p2"];

/**
 * Sets a seat's display name inside a game state's own `names` field. Not
 * used by the session layer - seats and display names live at the room level
 * (lib/session/shared/updates.ts) - and kept, with its tests, until the
 * hook merge (todo T-014) removes it. Throws if `role` is
 * already claimed while the other seat is still open.
 */
export function setIdentityName<T extends WithIdentity>(state: T, role: Role, name: string): T {
  const trimmed = name.trim().slice(0, MAX_NAME_LENGTH);
  if (!trimmed) {
    throw new Error("Name cannot be empty.");
  }
  // `state.names` can be entirely absent, not just empty - Firebase drops an
  // empty object on write (see "Realtime Database data shapes" under Conventions in CLAUDE.md), so a fresh
  // room's state has no `names` key at all until the first seat is claimed.
  const names = state.names ?? {};
  const allSeatsClaimed = ALL_ROLES.every((r) => Boolean(names[r]));
  if (!allSeatsClaimed && names[role]) {
    throw new Error(`${role} has already been claimed.`);
  }
  return { ...state, names: { ...names, [role]: trimmed } };
}

/**
 * Clears every seat's name in a game state's own `names` field. Unused, like
 * `setIdentityName` above, and removed by the same follow-up.
 */
export function releaseAllIdentityNames<T extends WithIdentity>(state: T): T {
  return { ...state, names: {} };
}
