/** The two seats in any 1v1 game this platform hosts - never renamed per-game (each game maps its own role names onto p1/p2). */
export type Role = "p1" | "p2";

/**
 * Every per-game state type must carry this so the shared session layer
 * (lib/session/useGameSession.ts) can show "who's in this room" without
 * knowing anything else about the game.
 */
export interface WithIdentity {
  /** Display names the two players picked for themselves, keyed by seat - not by in-game role, since in-game roles can rotate (e.g. master/guesser, emperor/slave). */
  names: Partial<Record<Role, string>>;
}
