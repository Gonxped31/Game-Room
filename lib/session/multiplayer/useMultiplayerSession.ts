"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createGameStore, type Store } from "@/lib/store";
import { createLocalStore } from "@/lib/store/localStore";
import { setMultiplayerIdentityName } from "./identity";
import { HEARTBEAT_INTERVAL_MS, isSeatOnline, type MultiplayerPresence } from "./presence";
import { generateRoomCode } from "../room";
import { seatIds, type SeatId, type WithMultiplayerIdentity } from "./types";

const DEFAULT_ROOM = "our-private-room-id";

function subscribeToHash(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}
const getRoomSnapshot = () => (typeof window !== "undefined" ? window.location.hash.slice(1) || DEFAULT_ROOM : DEFAULT_ROOM);

export interface MultiplayerSession<TState extends WithMultiplayerIdentity> {
  room: string;
  /** null while the store hasn't delivered a value yet ("Connecting to the room…"). */
  game: TState | null;
  gameStore: Store<TState>;
  /** Every seat this game has, claimed or not - e.g. ["p1","p2","p3"] for a 3-player game. */
  seats: SeatId[];
  /** null until this device has picked a seat in this room. */
  me: SeatId | null;
  /** Every seat other than `me`, claimed or not. */
  otherSeats: SeatId[];
  names: Partial<Record<SeatId, string>>;
  /** Seats with a name claimed. */
  joinedSeats: SeatId[];
  /** Seats with no name claimed yet - empty once the room is full. */
  unclaimedSeats: SeatId[];
  /** True once every seat has a name claimed. */
  allJoined: boolean;
  /** True if that seat has sent a heartbeat recently - another tab's "online" indicator. Always false for a seat nobody has picked yet. */
  online: Partial<Record<SeatId, boolean>>;
  /** Claims a seat + records a display name. */
  pickIdentity: (seat: SeatId, name: string) => void;
  /** Applies a pure state transition via the store's transaction; a thrown error (invalid move) becomes a safe no-op. */
  transact: (updater: (current: TState) => TState) => void;
  /** Unconditionally overwrites the room's state - for a hard reset. */
  setGame: (state: TState) => void;
  /** Leaves this room, clears this device's seat, and jumps to a brand new room. */
  newRoom: () => void;
}

/**
 * The N-player counterpart to the 1v1 session layer's `useGameSession` -
 * same game-agnostic mechanics (room resolution, the backend-agnostic store,
 * identity, presence), generalized from a fixed 2 seats to a caller-supplied
 * `maxPlayers`. Deliberately a separate module rather than a generalization
 * of `useGameSession` itself: every file under lib/session/ that FTW (and any
 * future 1v1 game) depends on stays untouched, so this has zero chance of
 * changing their behavior. No game is built on this yet - it exists so a
 * future 3+ player game has a backend ready to wire up.
 */
export function useMultiplayerSession<TState extends WithMultiplayerIdentity>(opts: {
  gameSlug: string;
  /** Fixed per game - how many seats this game has. */
  maxPlayers: number;
  createInitialState: () => TState;
}): MultiplayerSession<TState> {
  const { gameSlug, maxPlayers, createInitialState } = opts;
  const room = useSyncExternalStore(subscribeToHash, getRoomSnapshot, () => DEFAULT_ROOM);

  const seats = useMemo(() => seatIds(maxPlayers), [maxPlayers]);

  const gameStore = useMemo(() => createGameStore<TState>(room, gameSlug), [room, gameSlug]);
  const game = useSyncExternalStore(gameStore.subscribe, gameStore.getSnapshot, () => null);

  const meStore = useMemo(() => createLocalStore<SeatId | null>(`me:${gameSlug}:${room}`, { crossTab: false }), [room, gameSlug]);
  const me = useSyncExternalStore(meStore.subscribe, meStore.getSnapshot, () => null);

  // Same "presence" slug the 1v1 session layer uses - presence is per-room,
  // not per-game, so a player's online/offline status reads the same
  // regardless of which game is currently active in that room. SeatId is a
  // superset of Role's two values, so there's no shape conflict.
  const presenceStore = useMemo(() => createGameStore<MultiplayerPresence>(room, "presence"), [room]);
  const presence = useSyncExternalStore(presenceStore.subscribe, presenceStore.getSnapshot, () => null);

  useEffect(() => {
    if (!me) return;
    const beat = () => presenceStore.transaction((current) => ({ ...current, [me]: Date.now() }));
    beat();
    const id = setInterval(beat, HEARTBEAT_INTERVAL_MS);
    return () => {
      clearInterval(id);
      // Best-effort immediate "I left" signal for a clean navigation away -
      // if this write doesn't make it (closed tab, lost connection), the
      // heartbeat simply going stale covers it instead, just a few seconds
      // slower.
      presenceStore.transaction((current) => {
        if (!current) return undefined;
        const next = { ...current };
        delete next[me];
        return next;
      });
    };
  }, [me, presenceStore]);

  // Nothing pushes a new value when a seat's heartbeat merely goes stale (no
  // write happens, by definition) - this tick is what notices. Starts at
  // null (not Date.now()) and only ever reads the clock inside the effect
  // below, never during render - reading it during render is an unstable
  // value an SSR/prerender pass would otherwise capture, and setting state
  // synchronously in an effect body (rather than from a callback reacting to
  // an external timer) trips this project's react-hooks/set-state-in-effect
  // lint rule.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const kickoff = setTimeout(tick, 0);
    const id = setInterval(tick, HEARTBEAT_INTERVAL_MS);
    return () => {
      clearTimeout(kickoff);
      clearInterval(id);
    };
  }, []);

  const online: Partial<Record<SeatId, boolean>> = {};
  for (const seat of seats) online[seat] = isSeatOnline(presence, seat, now);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // A visitor with no #room in the URL at all gets their own fresh private
    // room instead of silently landing in the shared default. Bail before
    // touching gameStore (still bound to the DEFAULT_ROOM placeholder this
    // render) so we never read or write that shared room on the way to the
    // real one.
    if (!window.location.hash) {
      window.location.hash = generateRoomCode();
      return;
    }
    // The first client to open an empty (real) room creates it.
    if (game !== null) return;
    gameStore.transaction((current) => (current ? undefined : createInitialState()));
  }, [game, gameStore, createInitialState]);

  const names = game?.names ?? {};
  const joinedSeats = seats.filter((seat) => Boolean(names[seat]));
  const unclaimedSeats = seats.filter((seat) => !names[seat]);
  const allJoined = joinedSeats.length === seats.length;
  const otherSeats = seats.filter((seat) => seat !== me);

  const pickIdentity = (seat: SeatId, name: string) => {
    meStore.set(seat);
    gameStore.transaction((current) => {
      if (!current) return undefined;
      try {
        return setMultiplayerIdentityName(current, seat, name);
      } catch {
        return undefined;
      }
    });
  };

  const transact: MultiplayerSession<TState>["transact"] = (updater) => {
    gameStore.transaction((current) => {
      if (!current) return undefined;
      try {
        return updater(current);
      } catch {
        return undefined;
      }
    });
  };

  const newRoom = () => {
    meStore.set(null);
    window.location.hash = generateRoomCode();
  };

  return {
    room,
    game,
    gameStore,
    seats,
    me,
    otherSeats,
    names,
    joinedSeats,
    unclaimedSeats,
    allJoined,
    online,
    pickIdentity,
    transact,
    setGame: gameStore.set,
    newRoom,
  };
}
