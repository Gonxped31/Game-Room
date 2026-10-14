"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createGameStore, type Store } from "@/lib/store";
import { createLocalStore } from "@/lib/store/localStore";
import { setIdentityName } from "./identity";
import { HEARTBEAT_INTERVAL_MS, isOnline, type Presence } from "./presence";
import { generateRoomCode } from "./room";
import type { Role, WithIdentity } from "./types";

const DEFAULT_ROOM = "our-private-room-id";

function subscribeToHash(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}
const getRoomSnapshot = () => (typeof window !== "undefined" ? window.location.hash.slice(1) || DEFAULT_ROOM : DEFAULT_ROOM);

export interface GameSession<TState extends WithIdentity> {
  room: string;
  /** null while the store hasn't delivered a value yet ("Connecting to the room…"). */
  game: TState | null;
  gameStore: Store<TState>;
  /** null until this device has picked a seat in this room. */
  me: Role | null;
  /** The other seat, or null if `me` isn't set yet. */
  other: Role | null;
  names: Partial<Record<Role, string>>;
  bothJoined: boolean;
  /** True if that seat has sent a heartbeat recently - the other tab's "online" indicator. Always false for a seat nobody has picked yet. */
  online: Partial<Record<Role, boolean>>;
  /** Claims a seat + records a display name - the RolePicker's onPick target. */
  pickIdentity: (role: Role, name: string) => void;
  /** Applies a pure state transition via the store's transaction; a thrown error (invalid move) becomes a safe no-op. */
  transact: (updater: (current: TState) => TState) => void;
  /** Unconditionally overwrites the room's state - for a hard reset. */
  setGame: (state: TState) => void;
  /** Leaves this room, clears this device's seat, and jumps to a brand new room. */
  newRoom: () => void;
}

/**
 * All the game-agnostic 2-player session mechanics shared by every game on
 * this platform: room resolution (including auto-generating a fresh room for
 * a bare visit), the backend-agnostic store, and "who am I / has my partner
 * joined" identity. A game's page calls this once with its own state type and
 * a factory for a fresh game, then only has to deal with its own rules.
 */
export function useGameSession<TState extends WithIdentity>(opts: {
  gameSlug: string;
  createInitialState: () => TState;
}): GameSession<TState> {
  const { gameSlug, createInitialState } = opts;
  const room = useSyncExternalStore(subscribeToHash, getRoomSnapshot, () => DEFAULT_ROOM);

  const gameStore = useMemo(() => createGameStore<TState>(room, gameSlug), [room, gameSlug]);
  const game = useSyncExternalStore(gameStore.subscribe, gameStore.getSnapshot, () => null);

  const meStore = useMemo(() => createLocalStore<Role | null>(`me:${gameSlug}:${room}`, { crossTab: false }), [room, gameSlug]);
  const me = useSyncExternalStore(meStore.subscribe, meStore.getSnapshot, () => null);

  // Presence lives in its own store path, not the game's own state - it
  // changes on a timer unrelated to gameplay, and mixing it into the game
  // object would mean every heartbeat write has to merge-and-preserve
  // whatever the current game state happens to be instead of just "I'm
  // here". One presence store per room (not per game), so a player shows as
  // online/offline the same way regardless of which game they're in.
  const presenceStore = useMemo(() => createGameStore<Presence>(room, "presence"), [room]);
  const presence = useSyncExternalStore(presenceStore.subscribe, presenceStore.getSnapshot, () => null);

  useEffect(() => {
    if (!me) return;
    const beat = () => presenceStore.transaction((current) => ({ ...current, [me]: Date.now() }));
    beat();
    const id = setInterval(beat, HEARTBEAT_INTERVAL_MS);
    return () => {
      clearInterval(id);
      // Best-effort immediate "I left" signal for a clean navigation away
      // (e.g. the back-to-games button) - if this write doesn't make it
      // (closed tab, lost connection), the heartbeat simply going stale
      // covers it instead, just a few seconds slower.
      presenceStore.transaction((current) => {
        if (!current) return undefined;
        const next = { ...current };
        delete next[me];
        return next;
      });
    };
  }, [me, presenceStore]);

  // Nothing pushes a new value when a partner's heartbeat merely goes
  // stale (no write happens, by definition) - this tick is what notices.
  // Starts at null (not Date.now()) and only ever reads the clock inside
  // the effect below, never during render - reading it during render is
  // an unstable value an SSR/prerender pass would otherwise capture.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    // setTimeout(tick, 0), not a direct tick() call, so the first setState
    // happens inside a callback (an external timer firing) rather than
    // synchronously in the effect body itself.
    const kickoff = setTimeout(tick, 0);
    const id = setInterval(tick, HEARTBEAT_INTERVAL_MS);
    return () => {
      clearTimeout(kickoff);
      clearInterval(id);
    };
  }, []);

  const online: Partial<Record<Role, boolean>> = {
    p1: isOnline(presence, "p1", now),
    p2: isOnline(presence, "p2", now),
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    // A visitor with no #room in the URL at all gets their own fresh private
    // room instead of silently landing in the shared default - important
    // since multiple pairs (and multiple games) can be active at once. Bail
    // before touching gameStore (still bound to the DEFAULT_ROOM placeholder
    // this render) so we never read or write that shared room on the way to
    // the real one.
    if (!window.location.hash) {
      window.location.hash = generateRoomCode();
      return;
    }
    // The first client to open an empty (real) room creates it.
    if (game !== null) return;
    gameStore.transaction((current) => (current ? undefined : createInitialState()));
  }, [game, gameStore, createInitialState]);

  const names = game?.names ?? {};
  const bothJoined = Boolean(names.p1 && names.p2);
  const other: Role | null = me === "p1" ? "p2" : me === "p2" ? "p1" : null;

  const pickIdentity = (role: Role, name: string) => {
    meStore.set(role);
    gameStore.transaction((current) => {
      if (!current) return undefined;
      try {
        return setIdentityName(current, role, name);
      } catch {
        return undefined;
      }
    });
  };

  const transact: GameSession<TState>["transact"] = (updater) => {
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
    me,
    other,
    names,
    bothJoined,
    online,
    pickIdentity,
    transact,
    setGame: gameStore.set,
    newRoom,
  };
}
