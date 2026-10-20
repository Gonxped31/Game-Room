/**
 * Deadlines for games that move on by themselves (a countdown ends, a
 * question times out). There's no game server: the deadline is a server
 * timestamp stored in the game state, every device watches it on the server
 * clock (`useServerClock`), and whichever devices see it pass transact the
 * next step. The step must be idempotent - it checks the phase and the
 * deadline itself, so the first device to commit moves the game on and every
 * other attempt is a no-op. That way a player going offline never stalls a
 * game, and there's no host to hand off.
 */

/** Milliseconds until `deadline`, never negative. */
export function msLeft(deadline: number, now: number): number {
  return Math.max(0, deadline - now);
}

/** Whole seconds left for a countdown label: 2.1 s shows as 3, 0 only once it has passed. */
export function secondsLeft(deadline: number, now: number): number {
  return Math.ceil(msLeft(deadline, now) / 1000);
}

/** True once the server clock has reached `deadline`. */
export function hasPassed(deadline: number, now: number): boolean {
  return now >= deadline;
}

/**
 * Guards an advance-on-deadline transition: throws (so the store turns the
 * transaction into a no-op) unless the state is still in `phase` and its
 * deadline has passed. Call it first in every timed transition.
 */
export function assertDue(state: { phase: string }, phase: string, deadline: number | undefined, now: number): void {
  if (state.phase !== phase) throw new Error(`Not in ${phase}.`);
  if (deadline == null || !hasPassed(deadline, now)) throw new Error("Not due yet.");
}
