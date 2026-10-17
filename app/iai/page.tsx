"use client";

import Link from "next/link";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useGameSession } from "@/lib/session/useGameSession";
import { CONNECTION_ERROR_MESSAGE } from "@/lib/session/shared/auth";
import { ROOM_MISSING_MESSAGE } from "@/lib/session/shared/roomActions";
import { useServerClock, useTicker } from "@/lib/session/shared/serverClock";
import { createPathStore } from "@/lib/store";
import InAppBrowserBanner from "@/components/InAppBrowserBanner";
import InviteLinkBanner from "@/components/InviteLinkBanner";
import Stage from "@/components/iai/Stage";
import type { Engine } from "@/components/iai/engine/engine";
import { GetReady, HostLeft, Lobby, Message, NameEntry, RoomLinks, WaitingForPartner } from "@/components/iai/Screens";
import { abandonRun, finishRun, type GameState, newGame, normalizeGame, setReady } from "@/lib/games/iai/coop";
import { GAME_TITLE } from "@/lib/games/iai/rules";

/** A live message on `games/{room}/iaiLive/{seat}`: the run it belongs to, and the engine's own payload. */
interface LiveMessage {
  run: number;
  d: string;
}

/**
 * Iaï co-op: two samurai on one field. The room's first seat (p1) hosts - its
 * engine runs the fight - and each seat streams its messages to its own live
 * node for the other screen.
 */
export default function IaiCoopPage() {
  const createInitialState = useCallback((): GameState => newGame(), []);
  const session = useGameSession<GameState>({ gameSlug: "iai", createInitialState });
  const { room, me, other, names, bothJoined, roomName, canRenameRoom, setRoomName, roomNameError, online, canTakeOver, pickIdentity, transact, newRoom } = session;
  const rawGame = session.game;
  // Firebase drops empty objects (ready), so read through the normalizer.
  const game = useMemo(() => (rawGame ? normalizeGame(rawGame) : null), [rawGame]);
  const [engine, setEngine] = useState<Engine | null>(null);
  const serverNow = useServerClock();

  const running = game?.phase === "RUNNING";
  const run = game?.run ?? 0;
  const startAt = game?.startAt;
  const isHost = me === "p1";
  const now = useTicker(running, serverNow);
  const beforeStart = running && startAt !== undefined && now !== null && now < startAt;
  // The host's screen runs the fight: if it's gone mid-run, the partner can only go back to the lobby.
  const hostGone = running && !isHost && me !== null && !online.p1;

  useEffect(() => {
    document.title = GAME_TITLE;
  }, []);

  // This seat's live node, and the other seat's messages fed to the engine.
  const mine = useMemo(() => (room && me ? createPathStore<LiveMessage>(`games/${room}/iaiLive/${me}`) : null), [room, me]);
  useEffect(() => {
    if (!room || !other || !engine) return;
    const theirs = createPathStore<LiveMessage>(`games/${room}/iaiLive/${other}`);
    return theirs.subscribe(() => {
      const m = theirs.getSnapshot();
      if (m && m.run === run) engine.receive(m.d);
    });
  }, [room, other, engine, run]);

  // Join the current run (the engine starts it at startAt on the server's clock).
  useEffect(() => {
    if (!engine || !me || !running || startAt === undefined || !bothJoined) return;
    engine.startCoop({
      role: isHost ? "host" : "guest",
      run,
      startAt,
      serverNow,
      send: (d) => mine?.set({ run, d }),
      onFinish: (result) => transact((current) => finishRun(current, run, result)),
    });
  }, [engine, me, running, run, startAt, bothJoined, isHost, serverNow, mine, transact]);

  // The other samurai wears their name.
  const otherName = other ? names[other] : undefined;
  useEffect(() => {
    engine?.setPartnerName(otherName ?? "");
  }, [engine, otherName]);

  // The room left the run: stop.
  useEffect(() => {
    if (engine && !running) engine.stopCoop();
  }, [engine, running]);

  const handleReady = (ready: boolean) => {
    if (me) transact((current) => setReady(current, me, ready, serverNow()));
  };

  let screen: ReactNode = null;
  if (session.connectionError || session.roomMissing) {
    screen = <Message text={session.connectionError ? CONNECTION_ERROR_MESSAGE : ROOM_MISSING_MESSAGE} />;
  } else if (!game) {
    screen = null; // the stage's own loading screen
  } else if (!me) {
    screen = <NameEntry names={names} canTakeOver={canTakeOver} onPick={pickIdentity} />;
  } else if (!bothJoined || !other) {
    screen = (
      <WaitingForPartner
        invite={
          <InviteLinkBanner
            room={room}
            roomName={roomName}
            onRenameRoom={canRenameRoom ? setRoomName : undefined}
            nameError={roomNameError}
            accentColor="#b21e26"
            accentShadowColor="#0c0d1c"
            accentTextColor="#fff6ea"
          />
        }
      />
    );
  } else if (running) {
    if (hostGone) screen = <HostLeft hostName={names.p1 ?? "Your partner"} onBack={() => transact((current) => abandonRun(current))} />;
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
        footer={<RoomLinks room={room} roomName={roomName} onNewRoom={newRoom} />}
      />
    );
  }

  return (
    <>
      <Stage mode="coop" onEngine={setEngine}>
        {screen}
        {!running ? (
          <Link href="/" className="iai-back" aria-label="Back to all games">
            ←
          </Link>
        ) : null}
      </Stage>
      <div className="fixed inset-x-0 top-0 z-40">
        <InAppBrowserBanner />
      </div>
    </>
  );
}
