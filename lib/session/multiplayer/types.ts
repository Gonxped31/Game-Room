/**
 * A seat identifier for a 3+ player game: "p1", "p2", ..., "pN". Plain
 * `string` rather than a literal union (unlike `Role` in the 1v1 session
 * layer) since N varies per game - a game declares its own `maxPlayers` and
 * gets exactly that many seats.
 */
export type SeatId = string;

/** Every seat for a game with this many players: `["p1", "p2", ..., "pN"]`. */
export function seatIds(maxPlayers: number): SeatId[] {
  return Array.from({ length: maxPlayers }, (_, i) => `p${i + 1}`);
}

/**
 * Every multiplayer game's state type must carry this so the shared
 * multiplayer session layer (useMultiplayerSession.ts) can show "who's in
 * this room" without knowing anything else about the game. Same shape as the
 * 1v1 session layer's `WithIdentity`, just keyed by the open `SeatId` type
 * instead of the closed 2-member `Role` union.
 */
export interface WithMultiplayerIdentity {
  /** Display names players picked for themselves, keyed by seat. */
  names: Partial<Record<SeatId, string>>;
}
