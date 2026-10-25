"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useGameSession } from "@/lib/session/useGameSession";
import { usePublicRoom } from "@/lib/session/usePublicRoom";
import { CONNECTION_ERROR_MESSAGE } from "@/lib/session/shared/auth";
import { findMatch } from "@/lib/session/shared/findMatch";
import { ANY_LANG } from "@/lib/session/shared/matchmaking";
import { leaveToHub, ROOM_MISSING_MESSAGE } from "@/lib/session/shared/roomActions";
import InAppBrowserBanner from "@/components/InAppBrowserBanner";
import InviteLinkBanner from "@/components/InviteLinkBanner";
import Stage from "@/components/nighthighway/Stage";
import type { Engine } from "@/components/nighthighway/engine/engine";
import { GetReady, Lobby, MatchLinks, MatchLobby, Message, NameEntry, RoomLinks, WaitingForDriver, WaitingForResult } from "@/components/nighthighway/Screens";
import { NIGHTHIGHWAY_MATCH } from "@/lib/games/matchGames";
import { roomHref } from "@/lib/games/registry";
import { GAME_TITLE, START_LANE } from "@/lib/games/nighthighway/constants";
import { type GameState, giveUpOnMissingResults, newGame, normalizeGame, type RaceOptions, resultsOverdue, setOptions, setReady, startRace, submitResult } from "@/lib/games/nighthighway/game";
import { useLiveCars, useServerClock, useTicker } from "@/lib/games/nighthighway/useRace";

export default function NightHighwayPage() {
  const createInitialState = useCallback((): GameState => newGame(), []);
  const session = useGameSession<GameState>({ gameSlug: "nighthighway", createInitialState });
  const { room, me, other, names, bothJoined, roomName, canRenameRoom, setRoomName, roomNameError, online, canTakeOver, pickIdentity, transact, newRoom } = session;
  // Firebase drops empty objects/arrays (ready, results, history...), so read through the normalizer.
  const rawGame = session.game;
  const game = useMemo(() => (rawGame ? normalizeGame(rawGame) : null), [rawGame]);
  const [engine, setEngine] = useState<Engine | null>(null);
  const serverNow = useServerClock();
  const { send, track } = useLiveCars(room || null, me, other);

  const racing = game?.phase === "RACING";
  const race = game?.race ?? 0;
  const seed = game?.seed;
  const startAt = game?.startAt;
  const myResult = me && game ? game.results[me] : undefined;
  // The race's switches, as plain values so the effect below re-runs only when they change.
  const rain = game?.options.rain ?? false;
  const pickups = game?.options.pickups ?? true;
  const desert = game?.options.desert ?? false;
  // Ticks through a race (for "Get ready" before the countdown, and the overdue check after it).
  const now = useTicker(racing, serverNow);
  const beforeStart = racing && startAt !== undefined && now !== null && now < startAt;

  // A matchmaking room (docs/matchmaking.md): the first race starts by itself
  // once both drivers are online; after that it's Ready as usual.
  const inLobby = game?.phase === "LOBBY";
  const startPublicRace = useCallback(() => transact((current) => startRace(current, serverNow(), Math.floor(Math.random() * 2 ** 31))), [transact, serverNow]);
  // Back leaves wherever "Leave room" shows: the lobby and the results, not mid-race.
  const match = usePublicRoom({
    session,
    game: NIGHTHIGHWAY_MATCH,
    inLobby,
    ready: session.onlineSeats.length >= 2,
    onStart: startPublicRace,
    serverNow,
    leaveOnBack: game != null && game.phase !== "RACING",
  });
  const lobbyNow = useTicker(match.isPublic && inLobby, serverNow);
  // Leave room shows only off the road (never mid-race), so it never asks first.
  const leave = match.isPublic ? match.leave : () => void leaveToHub(session.leave);
  const leaveForSolo = () => match.leaveTo("/nighthighway/solo");
  const [finding, setFinding] = useState<"idle" | "searching" | "offline">("idle");
  const findAnother = async () => {
    const name = me ? names[me] : undefined;
    if (!session.uid || !name) return;
    setFinding("searching");
    try {
      await session.leave();
      const code = await findMatch({ uid: session.uid, name, lang: session.publicLang ?? ANY_LANG, game: NIGHTHIGHWAY_MATCH });
      window.location.href = roomHref(NIGHTHIGHWAY_MATCH.gameSlug, code);
    } catch {
      setFinding("offline");
    }
  };

  useEffect(() => {
    document.title = GAME_TITLE;
  }, []);

  // Drive this device's car in the current race - unless it already finished it.
  useEffect(() => {
    if (!engine || !me || !racing || seed === undefined || startAt === undefined || myResult) return;
    engine.startRace({
      race,
      seed,
      startAt,
      lane: START_LANE[me],
      options: { rain, pickups, desert },
      serverNow,
      onLive: send,
      onFinish: (result) => transact((current) => submitResult(current, me, result)),
    });
  }, [engine, me, racing, race, seed, startAt, myResult, rain, pickups, desert, serverNow, send, transact]);

  // Between races the road previews the next race's switches (rain falls in the lobby).
  useEffect(() => {
    engine?.setOptions({ rain, pickups, desert });
  }, [engine, rain, pickups, desert]);

  // The room left the race (e.g. "New room"): stop driving it.
  useEffect(() => {
    if (engine && !racing) engine.stopRace();
  }, [engine, racing]);

  // The other racer, as a ghost.
  const otherName = other ? names[other] : undefined;
  useEffect(() => {
    if (!engine) return;
    engine.setOpponent(other && otherName ? { name: otherName, sample: (t) => track.at(t, race), latest: () => track.latest() } : null);
  }, [engine, other, otherName, race, track]);

  // A result that never arrives (that player's tab closed mid-race) is given
  // up on after a grace period, so the room isn't stuck mid-race.
  const overdue = game !== null && now !== null && resultsOverdue(game, now);
  useEffect(() => {
    if (overdue) transact((current) => giveUpOnMissingResults(current, serverNow()));
  }, [overdue, transact, serverNow]);

  const handleReady = (ready: boolean) => {
    if (!me) return;
    // The seed is rolled by whichever press starts the race; an earlier press's is never used.
    const seedForRace = Math.floor(Math.random() * 2 ** 31);
    transact((current) => setReady(current, me, ready, serverNow(), seedForRace));
  };

  let screen: ReactNode = null;
  if (session.connectionError || session.roomMissing) {
    screen = <Message text={session.connectionError ? CONNECTION_ERROR_MESSAGE : ROOM_MISSING_MESSAGE} />;
  } else if (!game) {
    screen = null; // the stage's own "Warming up the engine…"
  } else if (!me) {
    screen = <NameEntry names={names} canTakeOver={canTakeOver} onPick={pickIdentity} onLeave={leave} />;
  } else if (match.isPublic && (!bothJoined || !other)) {
    const myName = names[me] ?? "You";
    screen = inLobby ? (
      <MatchLobby myName={myName} status="Waiting for a driver…" onLeave={match.leave} onSolo={leaveForSolo} />
    ) : (
      <MatchLobby
        myName={myName}
        left
        status={finding === "searching" ? "Looking for a driver…" : finding === "offline" ? CONNECTION_ERROR_MESSAGE : ""}
        onFindAnother={finding === "searching" ? undefined : () => void findAnother()}
        onLeave={match.leave}
        onSolo={leaveForSolo}
      />
    );
  } else if (match.isPublic && inLobby && other) {
    const otherName = names[other] ?? "the other driver";
    const secs = match.autoStartAt != null && lobbyNow != null ? Math.max(0, Math.ceil((match.autoStartAt - lobbyNow) / 1000)) : null;
    const status = secs != null ? (secs > 0 ? `Starting in ${secs} s` : "Starting…") : online[other] ? "Getting ready…" : `${otherName} is offline.`;
    screen = <MatchLobby myName={names[me] ?? "You"} otherName={otherName} status={status} onLeave={match.leave} onSolo={leaveForSolo} />;
  } else if (!bothJoined || !other) {
    screen = (
      <WaitingForDriver
        invite={
          <InviteLinkBanner
            room={room}
            roomName={roomName}
            onRenameRoom={canRenameRoom ? setRoomName : undefined}
            nameError={roomNameError}
            accentColor="#ff2b45"
            accentShadowColor="#04070f"
            accentTextColor="#ffffff"
          />
        }
        onLeave={leave}
      />
    );
  } else if (racing) {
    if (myResult) screen = <WaitingForResult result={myResult} otherName={names[other] ?? "the other driver"} />;
    else if (beforeStart) screen = <GetReady />;
  } else {
    screen = (
      <Lobby
        game={game}
        me={me}
        other={other}
        names={names}
        otherOnline={Boolean(online[other])}
        onReady={handleReady}
        onOptions={(change: Partial<RaceOptions>) => transact((current) => setOptions(current, change))}
        footer={match.isPublic ? <MatchLinks onLeave={match.leave} onSolo={leaveForSolo} /> : <RoomLinks room={room} roomName={roomName} onNewRoom={newRoom} onLeave={leave} />}
      />
    );
  }

  return (
    <>
      <Stage mode="race" onEngine={setEngine}>
        {screen}
      </Stage>
      <div className="fixed inset-x-0 top-0 z-40">
        <InAppBrowserBanner />
      </div>
    </>
  );
}
