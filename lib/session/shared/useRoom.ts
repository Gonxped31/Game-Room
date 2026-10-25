"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createGameStore, createPathStore, emptyStore, isLocalMode, serverTimestamp, type Store, updateRoot } from "@/lib/store";
import { type GuestAuth, useGuestAuth } from "./auth";
import { canTakeOver, isSeatOnline, type RoomPresence, startPresence } from "./presence";
import { createRoom, renameRoom } from "./roomActions";
import { useServerClock } from "./serverClock";
import {
  type ActiveMinutes,
  claimSeatUpdate,
  leaveRoomUpdate,
  nextActiveMinutes,
  room as roomPath,
  type RoomMeta,
  swapSeatsUpdate,
  switchSeatUpdate,
  takeOverSeatUpdate,
  visitDay,
  visitUpdate,
} from "./updates";

/** Placeholder room id while there's no #code yet - never subscribed to or written. */
export const DEFAULT_ROOM = "our-private-room-id";

/** localStorage: the last `${uid}:${yyyymmdd}:${room}` whose visit was marked, so it's written once a day per room and browser. */
const VISIT_KEY = "gameRoom.visitMarked";

/** How often `lastActive` is refreshed while a game is in progress - the hub's "Your rooms" sorts by it. */
const LAST_ACTIVE_INTERVAL_MS = 60_000;

/** Display names are capped at this length (the rules allow 1-24 characters). */
const MAX_NAME_LENGTH = 24;

/** How often the local clock is re-read - only drives whether an offline seat can be taken over yet. */
const CLOCK_TICK_MS = 15_000;

function subscribeToHash(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}
const getHash = () => (typeof window !== "undefined" ? window.location.hash.slice(1) : "");

function useStoreValue<T>(store: Store<T>): T | null {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, () => null);
}

export type SeatMap = Partial<Record<string, string>>;

export interface RoomCore<TState> {
  auth: GuestAuth;
  uid: string | null;
  room: string;
  /** Guest sign-in failed, or a fresh room couldn't be created - show the "Can't connect" message. */
  connectionError: boolean;
  /** The #code doesn't lead to a room of this game (and couldn't be created). */
  roomMissing: boolean;
  /** The room was closed from /admin: still readable, but the rules refuse every change. */
  roomClosed: boolean;
  meta: RoomMeta | null;
  seats: SeatMap;
  game: TState | null;
  gameStore: Store<TState>;
  mySeat: string | null;
  isCreator: boolean;
  /** Display names of the seats that are currently held. */
  names: Partial<Record<string, string>>;
  isOnline: (seat: string) => boolean;
  /** Whether a held seat's holder has been offline long enough to take it over. */
  canTakeOverSeat: (seat: string) => boolean;
  claimSeat: (seat: string, name: string) => Promise<boolean>;
  /** Trades seats with whoever holds `seat` (both must be seated), or moves there if it's empty. */
  moveOrSwapTo: (seat: string, nameIfEmpty: string) => Promise<boolean>;
  leave: () => Promise<void>;
  newRoom: () => Promise<void>;
  roomNameError: string | null;
  setRoomName: (name: string) => void;
  transact: (updater: (current: TState) => TState) => void;
}

/**
 * The room mechanics behind the session hook (useSession, and its 1v1
 * wrapper useGameSession): guest sign-in, room resolution and creation,
 * the separate live subscriptions (meta, seats, members, players, presence,
 * the game's own subtree - never the whole room, which would resend
 * everything to every device on each presence change), seat claiming via
 * multi-path updates, presence and `lastActive`. useSession maps this onto
 * its public API.
 */
export function useRoom<TState>(opts: {
  gameSlug: string;
  maxPlayers: number;
  /** The fewest seated players a game can run with; `lastActive` is kept fresh once this many are seated. */
  minPlayers: number;
  createInitialState: () => TState;
}): RoomCore<TState> {
  const { gameSlug, maxPlayers, minPlayers, createInitialState } = opts;
  const auth = useGuestAuth();
  const uid = auth.status === "ready" ? auth.uid : null;

  const hash = useSyncExternalStore(subscribeToHash, getHash, () => "");
  const room = hash || DEFAULT_ROOM;
  // Nothing is read or written until the guest is signed in (the rules deny
  // it, and a denied listener is cancelled for good) and there's a real room.
  const active = Boolean(uid && hash);

  const stores = useMemo(
    () =>
      active
        ? {
            meta: createPathStore<RoomMeta>(roomPath(room, "meta")),
            seats: createPathStore<SeatMap>(roomPath(room, "seats")),
            members: createPathStore<SeatMap>(roomPath(room, "members")),
            players: createPathStore<Partial<Record<string, { name: string }>>>(roomPath(room, "players")),
            presence: createPathStore<RoomPresence>(roomPath(room, "presence")),
            closedAt: createPathStore<number>(roomPath(room, "closedAt")),
            game: createGameStore<TState>(room, gameSlug),
          }
        : {
            meta: emptyStore<RoomMeta>(),
            seats: emptyStore<SeatMap>(),
            members: emptyStore<SeatMap>(),
            players: emptyStore<Partial<Record<string, { name: string }>>>(),
            presence: emptyStore<RoomPresence>(),
            closedAt: emptyStore<number>(),
            game: emptyStore<TState>(),
          },
    [active, room, gameSlug],
  );

  const meta = useStoreValue(stores.meta);
  const seatsValue = useStoreValue(stores.seats);
  const members = useStoreValue(stores.members);
  const players = useStoreValue(stores.players);
  const presence = useStoreValue(stores.presence);
  const closed = useStoreValue(stores.closedAt) != null;
  const game = useStoreValue(stores.game);
  const seats: SeatMap = useMemo(() => seatsValue ?? {}, [seatsValue]);

  const mySeat = uid ? (members?.[uid] ?? null) : null;
  const isCreator = Boolean(uid && meta?.createdBy === uid);

  // Room resolution. A bare visit (no #code) creates a fresh room and only
  // then puts its code in the URL; a #code whose room doesn't exist yet is
  // created at that code (or reported missing if it can't be).
  const [connectionFailed, setConnectionFailed] = useState(false);
  const [missingRoom, setMissingRoom] = useState<string | null>(null);
  const creatingRef = useRef(false);
  useEffect(() => {
    if (!uid || creatingRef.current) return;
    let cancelled = false;
    if (!hash) {
      creatingRef.current = true;
      createRoom({ uid, gameSlug, maxPlayers, initialState: createInitialState() })
        .then((code) => {
          window.location.hash = code;
        })
        .catch(() => setConnectionFailed(true))
        .finally(() => {
          creatingRef.current = false;
        });
      return;
    }
    stores.meta.readOnce().then(
      async (existing) => {
        if (cancelled) return;
        if (existing) {
          if (existing.gameSlug !== gameSlug) setMissingRoom(hash);
          return;
        }
        try {
          await createRoom({ uid, gameSlug, maxPlayers, initialState: createInitialState(), code: hash });
        } catch {
          if (!cancelled) setMissingRoom(hash);
        }
      },
      () => {
        if (!cancelled) setConnectionFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [uid, hash, gameSlug, maxPlayers, createInitialState, stores]);

  // Presence, only while holding a seat (the rules only accept a member's).
  // A closed room stops it: its cleanup marks this guest offline (the one
  // write a closed room still accepts), so the room stops counting as live.
  const seated = mySeat != null;
  useEffect(() => {
    if (!active || !uid || !seated || closed) return;
    return startPresence(room, uid);
  }, [active, room, uid, seated, closed]);

  // `lastActive`, at most once a minute, while a game is in progress (this
  // guest is seated and at least `minPlayers` seats are filled), and the
  // room's play time (`activeMinutes`): one count a minute, from whichever
  // seated device gets there first. Separate writes, so a refused count
  // never holds up `lastActive`.
  const seatedCount = Object.values(seats).filter(Boolean).length;
  const inProgress = active && seated && seatedCount >= minPlayers && !closed;
  const serverNow = useServerClock();
  useEffect(() => {
    if (!inProgress) return;
    const minutes = createPathStore<ActiveMinutes>(roomPath(room, "activeMinutes"));
    const touch = () => {
      updateRoot({ [roomPath(room, "lastActive")]: serverTimestamp() }).catch(() => {});
      void minutes.transaction((current) => nextActiveMinutes(current, serverNow(), serverTimestamp()));
    };
    touch();
    const id = setInterval(touch, LAST_ACTIVE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [inProgress, room, serverNow]);

  // A seated guest's visit to this room today (`users/{uid}/visits/{day}/{room}`):
  // the dashboard's lasting record of who played what, and when, since
  // "Leave room" clears the guest's room list.
  useEffect(() => {
    if (!active || !uid || !seated || closed) return;
    const day = visitDay(serverNow());
    const marked = `${uid}:${day}:${room}`;
    try {
      if (window.localStorage.getItem(VISIT_KEY) === marked) return;
    } catch {
      // No storage: mark it anyway; a repeat write the same day is harmless.
    }
    updateRoot(visitUpdate({ uid, code: room, gameSlug, day, ts: serverTimestamp() }))
      .then(() => {
        try {
          window.localStorage.setItem(VISIT_KEY, marked);
        } catch {}
      })
      .catch(() => {});
  }, [active, uid, seated, closed, room, gameSlug, serverNow]);

  // The clock is only read inside timer callbacks, never during render
  // (an unstable value a prerender would capture), and starts null.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const kickoff = setTimeout(tick, 0);
    const id = setInterval(tick, CLOCK_TICK_MS);
    return () => {
      clearTimeout(kickoff);
      clearInterval(id);
    };
  }, []);

  const names: Partial<Record<string, string>> = {};
  for (const [seat, holder] of Object.entries(seats)) {
    const name = holder ? players?.[seat]?.name : undefined;
    if (name) names[seat] = name;
  }

  const isOnline = (seat: string) => isSeatOnline(presence, seats, seat);
  const canTakeOverSeat = (seat: string) => {
    const holder = seats[seat];
    return Boolean(holder && holder !== uid && canTakeOver(presence, holder, now));
  };

  /** The seats as the database has them right now - local mode has no rules to refuse a stale write, so it re-reads first. */
  const freshSeats = async (): Promise<SeatMap> => (isLocalMode ? ((await stores.seats.readOnce()) ?? {}) : seats);

  const send = async (update: Record<string, unknown>) => {
    try {
      await updateRoot(update);
      return true;
    } catch {
      return false; // refused by the rules - e.g. someone else claimed the seat first
    }
  };

  // The room this page has left ("Leave room"): it never takes a seat there
  // again, or an auto-pick (Co-Counsel's joiner) would sit straight back down
  // before the hub loads. `newRoom` moves to another code, so it can claim.
  const leftRoom = useRef<string | null>(null);

  const claimSeat = async (seat: string, rawName: string): Promise<boolean> => {
    const name = rawName.trim().slice(0, MAX_NAME_LENGTH);
    if (!uid || !meta || !active || !name || leftRoom.current === room) return false;
    const current = await freshSeats();
    const holder = current[seat];
    if (holder === uid) {
      return send({ [roomPath(room, `players/${seat}`)]: { name } });
    }
    if (holder) {
      if (!canTakeOverSeat(seat)) return false;
      return send(takeOverSeatUpdate({ code: room, seat, uid, oldUid: holder, mySeat, name, meta, ts: serverTimestamp() }));
    }
    if (mySeat) {
      return send(switchSeatUpdate({ code: room, uid, from: mySeat, to: seat, name }));
    }
    return send(claimSeatUpdate({ code: room, seat, uid, name, meta, ts: serverTimestamp() }));
  };

  const moveOrSwapTo = async (seat: string, nameIfEmpty: string): Promise<boolean> => {
    if (!uid || !mySeat || !active || seat === mySeat) return false;
    const holder = (await freshSeats())[seat];
    const name = nameIfEmpty.trim().slice(0, MAX_NAME_LENGTH);
    if (!holder) return name ? send(switchSeatUpdate({ code: room, uid, from: mySeat, to: seat, name })) : false;
    return send(swapSeatsUpdate({ code: room, a: { uid, seat: mySeat }, b: { uid: holder, seat } }));
  };

  const leave = async () => {
    leftRoom.current = room;
    if (!uid || !mySeat || !active) return;
    await send(leaveRoomUpdate({ code: room, uid, seat: mySeat }));
  };

  const newRoom = async () => {
    await leave();
    if (!uid) return;
    try {
      const code = await createRoom({ uid, gameSlug, maxPlayers, initialState: createInitialState() });
      window.location.hash = code;
    } catch {
      setConnectionFailed(true);
    }
  };

  const [roomNameError, setRoomNameError] = useState<string | null>(null);
  const setRoomName = (name: string) => {
    if (!meta || !isCreator) return;
    setRoomNameError(null);
    void renameRoom(room, meta, name).then(setRoomNameError);
  };

  const transact = (updater: (current: TState) => TState) => {
    stores.game.transaction((current) => {
      if (!current) return undefined;
      try {
        return updater(current);
      } catch {
        return undefined;
      }
    });
  };

  return {
    auth,
    uid,
    room,
    connectionError: auth.status === "error" || connectionFailed,
    roomMissing: missingRoom != null && missingRoom === hash,
    roomClosed: closed,
    meta,
    seats,
    game,
    gameStore: stores.game,
    mySeat,
    isCreator,
    names,
    isOnline,
    canTakeOverSeat,
    claimSeat,
    moveOrSwapTo,
    leave,
    newRoom,
    roomNameError,
    setRoomName,
    transact,
  };
}
