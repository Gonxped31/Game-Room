/** The two seats in any 1v1 game this platform hosts - never renamed per-game (each game maps its own role names onto p1/p2). */
export type Role = "p1" | "p2";

/**
 * A seat in any game, whatever its size: "p1", "p2", ..., "p8". Plain
 * `string` rather than a literal union (unlike `Role`) since the count varies
 * per game - a game declares its own `maxPlayers` and gets exactly that many.
 */
export type SeatId = string;

/** Every seat for a game with this many players: `["p1", "p2", ..., "pN"]`. */
export function seatIds(maxPlayers: number): SeatId[] {
  return Array.from({ length: maxPlayers }, (_, i) => `p${i + 1}`);
}
