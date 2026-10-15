"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createGameStore, type Store } from "@/lib/store";
import { createLocalStore } from "@/lib/store/localStore";
import { setIdentityName } from "./identity";
import { HEARTBEAT_INTERVAL_MS, isOnline, type Presence } from "./presence";
import { generateRoomCode } from "./room";
import { roomNameIndexStore, type RoomMeta } from "./roomMeta";
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
  /** User-chosen room name, or undefined if nobody's set one - callers should fall back to showing `room` itself. */
  roomName: string | undefined;
  /** Sets (or, given an empty/whitespace-only string, clears) the room's name. */
  setRoomName: (name: string) => void;
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

  // Which game this room code belongs to, plus an optional display name -
  // see lib/session/roomMeta.ts. A sibling store path to presence/the game's
  // own state, for the same "changes independently, don't make every reader
  // merge-and-preserve it" reasoning.
  const metaStore = useMemo(() => createGameStore<RoomMeta>(room, "meta"), [room]);
  const meta = useSyncExternalStore(metaStore.subscribe, metaStore.getSnapshot, () => null);

  // Bootstraps `gameSlug` into a fresh room's meta (or backfills it into an
  // existing room that predates this feature) - independent of `game`'s own
  // churn (every lock-in, etc.), unlike the game-state-creation effect below,
  // since this only needs to run once per room, not every time `game` changes.
  useEffect(() => {
    if (typeof window === "undefined" || !window.location.hash) return;
    metaStore.transaction((current) => (current ? undefined : { gameSlug }));
  }, [metaStore, gameSlug]);

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

  // Self-heals a device whose claimed seat no longer has a name in the
  // shared state - the signature of a game resetting itself in place (e.g.
  // "Reset game"/"Rematch", which both wipe `names` back to `{}` as part of
  // `createInitialState()`). `me` is a separate, local-only store that
  // doesn't get touched by that reset, on EITHER device - without this,
  // whichever device(s) still have `me` set would never re-show RolePicker
  // (so `names` never gets repopulated) while `bothJoined` reads false,
  // stranding them on an InviteLinkBanner they can never get past.
  //
  // `hadNameRef` distinguishes "my name was wiped out from under me" (clear
  // `me`) from "I only just claimed this seat and the write hasn't landed
  // yet" (do nothing) - `pickIdentity` sets `me` locally/synchronously but
  // writes the shared name through `gameStore.transaction`, which can take a
  // real round-trip on Firebase, so `names[me]` is legitimately still falsy
  // for a moment right after picking - only a true true->false transition
  // (not false the whole time) means an actual reset happened.
  const hadNameRef = useRef(false);
  const myName = me ? names[me] : undefined;
  useEffect(() => {
    if (!me) {
      hadNameRef.current = false;
      return;
    }
    if (myName) {
      hadNameRef.current = true;
      return;
    }
    if (hadNameRef.current) {
      hadNameRef.current = false;
      meStore.set(null);
    }
  }, [me, myName, meStore]);

  // Only claims this device's own local seat (meStore) AFTER the shared
  // write actually lands - NOT optimistically beforehand. Two devices
  // racing to claim the same still-open seat (near-simultaneous taps) can
  // both reach this function before either has seen the other's write;
  // `setIdentityName` throws for whichever one's transaction updater gets
  // re-invoked with the now-already-claimed seat (Firebase's normal
  // optimistic-concurrency retry, or localStorage's synchronous re-read),
  // so only the winner's transaction actually commits. Setting `meStore`
  // unconditionally used to mean the loser of that race would believe it
  // held a seat someone else actually has - unable to ever submit as the
  // seat nobody now holds, since both devices would locally be "the same
  // seat". Awaiting first (an async function is still assignable to this
  // interface's `(role, name) => void` - callers that don't await it simply
  // don't wait, which is fine) closes that gap.
  const pickIdentity = async (role: Role, name: string) => {
    const result = await gameStore.transaction((current) => {
      if (!current) return undefined;
      try {
        return setIdentityName(current, role, name);
      } catch {
        return undefined;
      }
    });
    if (result) {
      meStore.set(role);
    }
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

  const roomName = meta?.name;
  const setRoomName = (name: string) => {
    const trimmed = name.trim();
    const previousName = meta?.name;
    metaStore.transaction((current) => {
      // Build a fresh object rather than spreading `current` and setting
      // `name: undefined` to clear it - Firebase rejects an explicit
      // own-property-with-undefined-value on write (see Store design notes).
      const base: RoomMeta = { gameSlug: current?.gameSlug ?? gameSlug };
      return trimmed ? { ...base, name: trimmed } : base;
    });
    // Keep the room-name -> room-code index (lib/session/roomMeta.ts) roughly
    // in sync, for "join a room by name" - best-effort, not atomic with the
    // meta write above (a different store/path entirely), which is fine:
    // findRoomsByName validates every candidate against its live meta, so a
    // stale or momentarily-missing index entry here can't produce a wrong
    // join, only a temporarily-incomplete one.
    if (previousName && previousName.trim().toLowerCase() !== trimmed.toLowerCase()) {
      roomNameIndexStore(previousName).transaction((current) => {
        if (!current?.[room]) return undefined;
        const next = { ...current };
        delete next[room];
        return next;
      });
    }
    if (trimmed) {
      roomNameIndexStore(trimmed).transaction((current) => ({ ...current, [room]: true }));
    }
  };

  return {
    room,
    game,
    gameStore,
    me,
    other,
    names,
    bothJoined,
    roomName,
    setRoomName,
    online,
    pickIdentity,
    transact,
    setGame: gameStore.set,
    newRoom,
  };
}
