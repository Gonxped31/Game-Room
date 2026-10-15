import type { Role, WithIdentity } from "./types";

const MAX_NAME_LENGTH = 24;
const ALL_ROLES: readonly Role[] = ["p1", "p2"];

/**
 * Sets a player's display name. Generic over any game's state (as long as it
 * has a `names` field) so every game can reuse this instead of reimplementing
 * it - always valid regardless of whatever in-game status/phase the game is in.
 *
 * Throws if `role` is already claimed AND the other seat is still open - two
 * devices racing to claim the same still-open seat (near-simultaneous picks,
 * e.g. both tapping "I'm the Investigator" within the same sync window)
 * would otherwise BOTH succeed: nothing previously stopped a second write
 * from silently overwriting the first, and - worse - `useGameSession`'s
 * `pickIdentity` used to set this device's own local seat optimistically
 * before knowing whether its write actually landed, so the loser of the
 * race would believe it held a seat someone else actually has, unable to
 * ever submit as the seat nobody now holds. Once BOTH seats are already
 * claimed, re-writing one (e.g. a "Welcome back, which one are you?"
 * re-confirmation, or a device simply re-picking its own already-held seat)
 * is allowed again - that's not a race, just restating a settled fact.
 */
export function setIdentityName<T extends WithIdentity>(state: T, role: Role, name: string): T {
  const trimmed = name.trim().slice(0, MAX_NAME_LENGTH);
  if (!trimmed) {
    throw new Error("Name cannot be empty.");
  }
  // `state.names` can be entirely absent, not just empty - Firebase drops an
  // empty object on write (see "Store design notes" in CLAUDE.md), so a fresh
  // room's state has no `names` key at all until the first seat is claimed.
  const names = state.names ?? {};
  const allSeatsClaimed = ALL_ROLES.every((r) => Boolean(names[r]));
  if (!allSeatsClaimed && names[role]) {
    throw new Error(`${role} has already been claimed.`);
  }
  return { ...state, names: { ...names, [role]: trimmed } };
}
