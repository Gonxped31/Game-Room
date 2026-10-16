"use client";

import { useRoom } from "./shared/useRoom";
import type { Store } from "@/lib/store";
import type { Role, WithIdentity } from "./types";

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
}

const ROLES: readonly Role[] = ["p1", "p2"];

/**
 * All the game-agnostic 2-player session mechanics shared by every 1v1 game
 * on this platform: guest identity, room resolution (including creating a
 * fresh room for a bare visit), the backend-agnostic store, seats, presence.
 * A game's page calls this once with its own state type and a factory for a
 * fresh game, then only has to deal with its own rules.
 *
 * Seats live at the room level (`games/{room}/seats`, keyed to guest IDs),
 * not in the game's own state, so a game resetting itself ("Reset game",
 * "Rematch") never unseats anyone. The `names` field every game state still
 * carries (WithIdentity) is no longer written by this layer.
 */
export function useGameSession<TState extends WithIdentity>(opts: {
  gameSlug: string;
  createInitialState: () => TState;
}): GameSession<TState> {
  const core = useRoom<TState>({ gameSlug: opts.gameSlug, maxPlayers: 2, createInitialState: opts.createInitialState });

  const me: Role | null = core.mySeat === "p1" || core.mySeat === "p2" ? core.mySeat : null;
  const other: Role | null = me === "p1" ? "p2" : me === "p2" ? "p1" : null;
  const names: Partial<Record<Role, string>> = {};
  const online: Partial<Record<Role, boolean>> = {};
  const canTakeOver: Partial<Record<Role, boolean>> = {};
  for (const role of ROLES) {
    if (core.names[role]) names[role] = core.names[role];
    online[role] = core.isOnline(role);
    canTakeOver[role] = core.canTakeOverSeat(role);
  }

  return {
    room: core.room,
    game: core.game,
    gameStore: core.gameStore,
    uid: core.uid,
    connectionError: core.connectionError,
    roomMissing: core.roomMissing,
    me,
    other,
    names,
    bothJoined: Boolean(names.p1 && names.p2),
    roomName: core.meta?.name,
    canRenameRoom: core.isCreator,
    setRoomName: core.setRoomName,
    roomNameError: core.roomNameError,
    online,
    canTakeOver,
    pickIdentity: async (role, name) => {
      await core.claimSeat(role, name);
    },
    releaseAllIdentities: () => {
      if (!other) return;
      void core.moveOrSwapTo(other, names[me!] ?? "");
    },
    transact: core.transact,
    setGame: core.gameStore.set,
    newRoom: () => void core.newRoom(),
  };
}
