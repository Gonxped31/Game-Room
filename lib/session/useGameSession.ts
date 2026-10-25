"use client";

import type { Store } from "@/lib/store";
import type { Role, WithIdentity } from "./types";
import { useSession } from "./useSession";

export interface GameSession<TState extends WithIdentity> {
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
  /** The seat this guest holds in this room, or null. */
  me: Role | null;
  /** The other seat, or null if `me` isn't set yet. */
  other: Role | null;
  /** Display names of the held seats. */
  names: Partial<Record<Role, string>>;
  bothJoined: boolean;
  /** The seat the room's creator holds, or null if they hold none. */
  hostSeat: Role | null;
  /** User-chosen room name, or undefined if nobody's set one - callers should fall back to showing `room` itself. */
  roomName: string | undefined;
  /** Only the room's creator may name it. */
  canRenameRoom: boolean;
  /** Sets (or, given an empty/whitespace-only string, clears) the room's name - creator only. */
  setRoomName: (name: string) => void;
  /** Why the last rename didn't go through (e.g. "That name is taken. Try another."), or null. */
  roomNameError: string | null;
  /** True while that seat's holder is connected. Always false for an empty seat. */
  online: Partial<Record<Role, boolean>>;
  /** True when a seat's holder has been offline long enough that this guest may take the seat over. */
  canTakeOver: Partial<Record<Role, boolean>>;
  /**
   * Claims a seat with a display name - the RolePicker's onPick target.
   * Also how a guest re-confirms its own seat, moves to the other (empty)
   * seat, or takes over an offline holder's seat. Resolves once the shared
   * write has settled; if someone else got there first it simply doesn't
   * land, and the picker re-renders with the seat shown as taken.
   */
  pickIdentity: (role: Role, name: string) => Promise<void>;
  /**
   * "Switch role": trades seats with the other player if both are seated
   * (one update, so neither is ever left without a seat), or moves to the
   * other seat if it's still empty. Display names stay with the seat.
   */
  releaseAllIdentities: () => void;
  /** Applies a pure state transition via the store's transaction; a thrown error (invalid move) becomes a safe no-op. */
  transact: (updater: (current: TState) => TState) => void;
  /** Unconditionally overwrites the room's game state - for a hard reset. Seats are untouched. */
  setGame: (state: TState) => void;
  /** Leaves this room (giving up this guest's seat) and jumps to a brand new room. */
  newRoom: () => void;
  /** Gives up this guest's seat and stays put (matchmaking's "Leave room"). */
  leave: () => Promise<void>;
  /** The held seats, and those whose holder is online. */
  joinedSeats: Role[];
  onlineSeats: Role[];
  /** Set in a room made by matchmaking (docs/matchmaking.md): its queue's language. */
  publicLang: string | undefined;
}

const asRole = (seat: string | null): Role | null => (seat === "p1" || seat === "p2" ? seat : null);

/**
 * The 1v1 session hook every 2-player game page calls: `useSession` with two
 * seats, narrowed to the `Role` pair and the stable API those games were
 * built on (`other`, `bothJoined`, `releaseAllIdentities`).
 *
 * Seats live at the room level (`games/{room}/seats`, keyed to guest IDs),
 * not in the game's own state, so a game resetting itself ("Reset game",
 * "Rematch") never unseats anyone. The `names` field every game state still
 * carries (WithIdentity) isn't used by this layer.
 */
export function useGameSession<TState extends WithIdentity>(opts: {
  gameSlug: string;
  createInitialState: () => TState;
}): GameSession<TState> {
  const session = useSession<TState>({ gameSlug: opts.gameSlug, maxPlayers: 2, createInitialState: opts.createInitialState });

  const me = asRole(session.me);
  const other: Role | null = me === "p1" ? "p2" : me === "p2" ? "p1" : null;
  const names: Partial<Record<Role, string>> = {};
  if (session.names.p1) names.p1 = session.names.p1;
  if (session.names.p2) names.p2 = session.names.p2;

  return {
    room: session.room,
    game: session.game,
    gameStore: session.gameStore,
    uid: session.uid,
    connectionError: session.connectionError,
    roomMissing: session.roomMissing,
    me,
    other,
    names,
    bothJoined: Boolean(names.p1 && names.p2),
    hostSeat: asRole(session.hostSeat),
    roomName: session.roomName,
    canRenameRoom: session.canRenameRoom,
    setRoomName: session.setRoomName,
    roomNameError: session.roomNameError,
    online: { p1: Boolean(session.online.p1), p2: Boolean(session.online.p2) },
    canTakeOver: { p1: Boolean(session.canTakeOver.p1), p2: Boolean(session.canTakeOver.p2) },
    pickIdentity: session.pickIdentity,
    releaseAllIdentities: () => {
      if (other) session.moveToSeat(other);
    },
    transact: session.transact,
    setGame: session.setGame,
    newRoom: session.newRoom,
    leave: session.leave,
    joinedSeats: session.joinedSeats.filter((seat): seat is Role => asRole(seat) != null),
    onlineSeats: session.onlineSeats.filter((seat): seat is Role => asRole(seat) != null),
    publicLang: session.publicLang,
  };
}
