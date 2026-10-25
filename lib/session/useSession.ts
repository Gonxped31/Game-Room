"use client";

import { useMemo } from "react";
import type { Store } from "@/lib/store";
import { useRoom } from "./shared/useRoom";
import { seatIds, type SeatId, type WithMultiplayerIdentity } from "./types";

export interface Session<TState extends WithMultiplayerIdentity> {
  room: string;
  /** null while signing in or before the room has delivered a value ("Connecting to the room…"). */
  game: TState | null;
  gameStore: Store<TState>;
  /** This browser's guest ID, once signed in. One guest holds at most one seat per room. */
  uid: string | null;
  /** Guest sign-in (or creating a room) failed - show CONNECTION_ERROR_MESSAGE instead of "Connecting…". */
  connectionError: boolean;
  /** The #code doesn't lead to a room of this game. */
  roomMissing: boolean;
  /** The room was closed from /admin; nothing in it can change any more. */
  roomClosed: boolean;
  /** Every seat this game has, held or not - e.g. ["p1","p2","p3","p4"] for a 4-player game. */
  seats: SeatId[];
  /** The seat this guest holds in this room, or null. */
  me: SeatId | null;
  /** Every seat other than `me`, held or not. */
  otherSeats: SeatId[];
  /** Display names of the held seats. */
  names: Partial<Record<SeatId, string>>;
  /** Seats that are held, in seat order (which is join order: a newcomer takes the first free seat). */
  joinedSeats: SeatId[];
  /** Seats nobody holds - empty once the room is full. */
  unclaimedSeats: SeatId[];
  /** True once every seat is held. */
  allJoined: boolean;
  /** True once at least `minPlayers` seats are held. */
  enoughJoined: boolean;
  /** This guest created the room - the host, for games that have one. */
  isHost: boolean;
  /** The seat the room's creator holds, or null if they hold none. */
  hostSeat: SeatId | null;
  /** User-chosen room name, or undefined if nobody's set one - callers should fall back to showing `room` itself. */
  roomName: string | undefined;
  /** Only the room's creator may name it. */
  canRenameRoom: boolean;
  /** Sets (or, given an empty/whitespace-only string, clears) the room's name - creator only. */
  setRoomName: (name: string) => void;
  /** Why the last rename didn't go through (e.g. "That name is taken. Try another."), or null. */
  roomNameError: string | null;
  /** True while that seat's holder is connected. Always false for an empty seat. */
  online: Partial<Record<SeatId, boolean>>;
  /** True when a seat's holder has been offline long enough that this guest may take the seat over. */
  canTakeOver: Partial<Record<SeatId, boolean>>;
  /**
   * Claims a seat with a display name. Also how a guest re-confirms its own
   * seat, moves to an empty seat, or takes over an offline holder's seat.
   * Resolves once the shared write has settled; if someone else got there
   * first it simply doesn't land.
   */
  pickIdentity: (seat: SeatId, name: string) => Promise<void>;
  /** Trades seats with whoever holds `seat` (both stay seated), or moves there if it's empty. */
  moveToSeat: (seat: SeatId) => void;
  /** Applies a pure state transition via the store's transaction; a thrown error (invalid move) becomes a safe no-op. */
  transact: (updater: (current: TState) => TState) => void;
  /** Unconditionally overwrites the room's game state - for a hard reset. Seats are untouched. */
  setGame: (state: TState) => void;
  /** Leaves this room (giving up this guest's seat) and jumps to a brand new room. */
  newRoom: () => void;
  /** Gives up this guest's seat and stays on the page (as a spectator) - e.g. before going back to the hub. */
  leave: () => Promise<void>;
  /** Held seats whose holder is connected, in seat order. */
  onlineSeats: SeatId[];
  /** A public room's queue language (matchmaking, docs/matchmaking.md); undefined for a private room. */
  publicLang: string | undefined;
}

/**
 * The session hook every game page calls once: guest identity, the room
 * (created for a bare visit), seats, presence, the room name and the game's
 * own state, for a game of `maxPlayers` seats (2 to 8 - the rules refuse a
 * seat above the room's `maxPlayers`, so a full room is enforced by the
 * database, not just this hook). 1v1 games use the `useGameSession` wrapper,
 * which narrows this to the two `Role`s.
 */
export function useSession<TState extends WithMultiplayerIdentity>(opts: {
  gameSlug: string;
  /** Fixed per game - how many seats it has. */
  maxPlayers: number;
  /** The fewest players a game can start with (defaults to `maxPlayers`). A room counts as in use once this many are seated. */
  minPlayers?: number;
  createInitialState: () => TState;
}): Session<TState> {
  const { gameSlug, maxPlayers, createInitialState } = opts;
  const minPlayers = opts.minPlayers ?? maxPlayers;
  const core = useRoom<TState>({ gameSlug, maxPlayers, minPlayers, createInitialState });
  const seats = useMemo(() => seatIds(maxPlayers), [maxPlayers]);

  const me = core.mySeat;
  const joinedSeats = seats.filter((seat) => Boolean(core.seats[seat]));
  const online: Partial<Record<SeatId, boolean>> = {};
  const canTakeOver: Partial<Record<SeatId, boolean>> = {};
  for (const seat of seats) {
    online[seat] = core.isOnline(seat);
    canTakeOver[seat] = core.canTakeOverSeat(seat);
  }

  return {
    room: core.room,
    game: core.game,
    gameStore: core.gameStore,
    uid: core.uid,
    connectionError: core.connectionError,
    roomMissing: core.roomMissing,
    roomClosed: core.roomClosed,
    seats,
    me,
    otherSeats: seats.filter((seat) => seat !== me),
    names: core.names,
    joinedSeats,
    unclaimedSeats: seats.filter((seat) => !core.seats[seat]),
    allJoined: joinedSeats.length === seats.length,
    enoughJoined: joinedSeats.length >= minPlayers,
    isHost: core.isCreator,
    hostSeat: seats.find((seat) => core.meta != null && core.seats[seat] === core.meta.createdBy) ?? null,
    roomName: core.meta?.name,
    canRenameRoom: core.isCreator,
    setRoomName: core.setRoomName,
    roomNameError: core.roomNameError,
    online,
    canTakeOver,
    pickIdentity: async (seat, name) => {
      await core.claimSeat(seat, name);
    },
    moveToSeat: (seat) => {
      if (me) void core.moveOrSwapTo(seat, core.names[me] ?? "");
    },
    transact: core.transact,
    setGame: core.gameStore.set,
    newRoom: () => void core.newRoom(),
    leave: core.leave,
    onlineSeats: joinedSeats.filter((seat) => online[seat]),
    publicLang: core.meta?.publicLang,
  };
}
