"use client";

import { useMemo } from "react";
import type { Store } from "@/lib/store";
import { useRoom } from "../shared/useRoom";
import { seatIds, type SeatId, type WithMultiplayerIdentity } from "./types";

export interface MultiplayerSession<TState extends WithMultiplayerIdentity> {
  room: string;
  /** null while signing in or before the room has delivered a value ("Connecting to the room…"). */
  game: TState | null;
  gameStore: Store<TState>;
  /** This browser's guest ID, once signed in. One guest holds at most one seat per room. */
  uid: string | null;
  /** Guest sign-in (or creating a room) failed. */
  connectionError: boolean;
  /** Every seat this game has, claimed or not - e.g. ["p1","p2","p3"] for a 3-player game. */
  seats: SeatId[];
  /** The seat this guest holds in this room, or null. */
  me: SeatId | null;
  /** Every seat other than `me`, claimed or not. */
  otherSeats: SeatId[];
  /** Display names of the held seats. */
  names: Partial<Record<SeatId, string>>;
  /** Seats that are held. */
  joinedSeats: SeatId[];
  /** Seats nobody holds - empty once the room is full. */
  unclaimedSeats: SeatId[];
  /** True once every seat is held. */
  allJoined: boolean;
  /** True while that seat's holder is connected. Always false for an empty seat. */
  online: Partial<Record<SeatId, boolean>>;
  /** Claims a seat + records a display name. Doesn't land if the seat is taken (or the room is full). */
  pickIdentity: (seat: SeatId, name: string) => void;
  /** Applies a pure state transition via the store's transaction; a thrown error (invalid move) becomes a safe no-op. */
  transact: (updater: (current: TState) => TState) => void;
  /** Unconditionally overwrites the room's game state - for a hard reset. Seats are untouched. */
  setGame: (state: TState) => void;
  /** Leaves this room (giving up this guest's seat) and jumps to a brand new room. */
  newRoom: () => void;
}

/**
 * The N-player counterpart to the 1v1 session layer's `useGameSession`, with
 * the same room mechanics (lib/session/shared/useRoom.ts) generalized to a
 * caller-supplied `maxPlayers` (2 to 8 - the rules refuse seats above it, so
 * a full room is enforced by the database, not just this hook). Kept as a
 * separate hook rather than merged with `useGameSession`, whose API every
 * 1v1 game depends on. No game is built on this yet - the first one that is
 * triggers merging the two hooks into one engine (see docs/follow-ups.md).
 */
export function useMultiplayerSession<TState extends WithMultiplayerIdentity>(opts: {
  gameSlug: string;
  /** Fixed per game - how many seats this game has. */
  maxPlayers: number;
  createInitialState: () => TState;
}): MultiplayerSession<TState> {
  const { gameSlug, maxPlayers, createInitialState } = opts;
  const core = useRoom<TState>({ gameSlug, maxPlayers, createInitialState });
  const seats = useMemo(() => seatIds(maxPlayers), [maxPlayers]);

  const me = core.mySeat;
  const joinedSeats = seats.filter((seat) => Boolean(core.seats[seat]));
  const unclaimedSeats = seats.filter((seat) => !core.seats[seat]);
  const online: Partial<Record<SeatId, boolean>> = {};
  for (const seat of seats) online[seat] = core.isOnline(seat);

  return {
    room: core.room,
    game: core.game,
    gameStore: core.gameStore,
    uid: core.uid,
    connectionError: core.connectionError,
    seats,
    me,
    otherSeats: seats.filter((seat) => seat !== me),
    names: core.names,
    joinedSeats,
    unclaimedSeats,
    allJoined: joinedSeats.length === seats.length,
    online,
    pickIdentity: (seat, name) => void core.claimSeat(seat, name),
    transact: core.transact,
    setGame: core.gameStore.set,
    newRoom: () => void core.newRoom(),
  };
}
