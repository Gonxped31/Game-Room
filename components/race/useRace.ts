"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { MODES, PLAYERS, ROOM_SEATS, type Mode, type Race, type RaceCore, type RunCore, type Runs } from "@/lib/games/race/race";
import type { MatchGame } from "@/lib/session/shared/findMatch";
import { leaveToHub } from "@/lib/session/shared/roomActions";
import { useDeadline, useServerClock, useTicker } from "@/lib/session/shared/serverClock";
import { startingSeats, usePublicRoom } from "@/lib/session/usePublicRoom";
import { useSession } from "@/lib/session/useSession";
import { createPathStore } from "@/lib/store";

export const isMode = (value: unknown): value is Mode => MODES.includes(value as Mode);
/** The mode the hub's Start picked (`?mode=`), for a room created on this visit. */
export const modeFromUrl = (): Mode => {
  const mode = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("mode");
  return isMode(mode) ? mode : "challenge";
};
export const newSeed = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()));
/** The name this browser last played under online (the hub's Matchmaking remembers it). */
const savedName = () => {
  try {
    return window.localStorage.getItem("gameRoom.onlineName") ?? "";
  } catch {
    return "";
  }
};
const noSubscribe = () => () => {};

interface Options<S extends RaceCore, R extends RunCore> {
  gameSlug: string;
  race: Race<S, R>;
  /** A fresh lobby in this mode. */
  newState: (mode: Mode) => S;
  /** Puts back a run's fields the Realtime Database dropped. */
  normalizeRun: (run: Partial<R> | null | undefined) => R;
  /** Each mode's matchmaking queue (`matchGames.ts`). */
  match: Record<Mode, MatchGame>;
}

/**
 * A race room's session (lib/games/race/race.ts), shared by every game that
 * races: the room's state at `games/{room}/{slug}`, everyone's runs at
 * `{slug}Runs`, the round's end and the next round on the server clock
 * (applied by whichever seated device sees them due), Start, and
 * matchmaking's auto-start. The page draws the screens.
 */
export function useRace<S extends RaceCore, R extends RunCore>({ gameSlug, race, newState, normalizeRun, match }: Options<S, R>) {
  const createInitialState = useCallback(() => newState(modeFromUrl()), [newState]);
  const session = useSession<S>({ gameSlug, maxPlayers: ROOM_SEATS, minPlayers: PLAYERS.challenge.min, createInitialState });
  const { room, me, transact, online, names } = session;
  const { normalize, endRound, roundOver, next, start } = race;
  const game = useMemo(() => (session.game ? normalize(session.game) : null), [session.game, normalize]);
  const serverNow = useServerClock();
  const [watching, setWatching] = useState(false);
  const defaultName = useSyncExternalStore(noSubscribe, savedName, () => "");

  // Once the room exists, the shared link is just /<game>#code.
  useEffect(() => {
    if (game && window.location.search) window.history.replaceState(window.history.state, "", window.location.pathname + window.location.hash);
  }, [game]);

  // Everyone's runs this round.
  const loaded = game != null;
  const runsPath = `games/${room}/${gameSlug}Runs`;
  const runsStore = useMemo(() => (loaded ? createPathStore<Runs<R>>(runsPath) : null), [loaded, runsPath]);
  const subscribeRuns = useCallback((cb: () => void) => runsStore?.subscribe(cb) ?? (() => {}), [runsStore]);
  const rawRuns = useSyncExternalStore(subscribeRuns, () => runsStore?.getSnapshot() ?? null, () => null);
  const runs = useMemo(() => {
    const all: Runs<R> = {};
    for (const [seat, run] of Object.entries(rawRuns ?? {})) all[seat] = normalizeRun(run);
    return all;
  }, [rawRuns, normalizeRun]);

  const phase = game?.phase;
  const now = useTicker(phase === "round" || phase === "results", serverNow, 250);
  const present = useMemo(() => (game ? game.alive.filter((seat) => online[seat]) : []), [game, online]);
  const presentKey = present.join(",");
  const seated = me != null;

  // A round ends at its time limit, or once everyone still in (and here) is done.
  const finishRound = useCallback(() => {
    transact((s) => endRound(s, runs, serverNow(), present));
  }, [transact, runs, serverNow, present, endRound]);
  useDeadline(seated && phase === "round" ? game?.endsAt : undefined, serverNow, finishRound);
  useEffect(() => {
    if (seated && game && phase === "round" && now != null && roundOver(game, runs, now, present)) finishRound();
    // presentKey: a player leaving can end the round.
  }, [seated, game, phase, runs, now, present, presentKey, finishRound, roundOver]);
  useDeadline(seated && phase === "results" ? game?.nextAt : undefined, serverNow, () => transact((s) => next(s, newSeed(), serverNow())));

  // The game starts with whoever is seated (in a public room, whoever is online).
  const startGame = useCallback(() => transact((s) => start(s, { seated: startingSeats(session), seed: newSeed(), now: serverNow() })), [transact, session, serverNow, start]);

  const publicMode = isMode(session.publicLang) ? session.publicLang : null;
  const onlineCount = session.onlineSeats.length;
  const publicRoom = usePublicRoom({
    session,
    game: match[publicMode ?? "challenge"],
    inLobby: phase === "lobby",
    ready: publicMode != null && onlineCount >= PLAYERS[publicMode].min,
    onStart: startGame,
    serverNow,
    leaveOnBack: phase === "lobby" || phase === "over",
  });
  const lobbyNow = useTicker(publicRoom.autoStartAt != null, serverNow, 250);
  const leave = publicRoom.isPublic ? publicRoom.leave : () => void leaveToHub(session.leave);

  // My run: this round's, or a fresh one.
  const myRun = me ? runs[me] : undefined;
  const runPath = me ? `${runsPath}/${me}` : null;
  const runStore = useMemo(() => (runPath ? createPathStore<R>(runPath) : null), [runPath]);
  const writeRun = useCallback((run: R) => void runStore?.set(run), [runStore]);
  /** Ms since the round started, on the server's clock, never before `after`. */
  const roundTime = useCallback((after = 0) => Math.max(Math.round(serverNow() - (game?.startsAt ?? 0)), after, 0), [serverNow, game?.startsAt]);

  const nameOf = useCallback((seat: string) => names[seat] ?? `Player ${seat.slice(1)}`, [names]);
  const capacity = game ? PLAYERS[game.mode].max : ROOM_SEATS;
  /** A free seat for a newcomer (within the mode's player count), if any. */
  const freeSeat = session.seats.slice(0, capacity).find((seat) => session.unclaimedSeats.includes(seat) || session.canTakeOver[seat]);

  return {
    session,
    game,
    runs,
    myRun,
    writeRun,
    /** My run's database path, for a game that appends to it (`updateRoot`) rather than rewriting it. */
    runPath,
    roundTime,
    now,
    lobbyNow,
    serverNow,
    startGame,
    publicRoom,
    leave,
    watching,
    watch: () => setWatching(true),
    defaultName,
    nameOf,
    freeSeat,
    onlineCount,
  };
}
