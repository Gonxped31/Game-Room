"use client";

import { useCallback, useEffect } from "react";
import { useGameSession } from "@/lib/session/useGameSession";
import { CONNECTION_ERROR_MESSAGE } from "@/lib/session/shared/auth";
import { ROOM_MISSING_MESSAGE } from "@/lib/session/shared/roomActions";
import InAppBrowserBanner from "@/components/InAppBrowserBanner";
import { CONTAINER_MAX_WIDTH_CLASS, GAME_TITLE } from "@/lib/games/ftw/constants";
import {
  type CurrentRound,
  guesserOf,
  lockIn,
  masterOf,
  newGame,
  nextRound as advanceRound,
  setPrompt,
  submitGuess,
} from "@/lib/games/ftw/game";
import { randomRound } from "@/lib/games/ftw/prompts";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import RolePicker from "@/components/RolePicker";
import RoundBoard from "@/components/ftw/RoundBoard";
import RoleStickers from "@/components/RoleStickers";
import InviteLinkBanner from "@/components/InviteLinkBanner";
import SessionRecap from "@/components/ftw/SessionRecap";

export default function FirstToWorstPage() {
  const createInitialState = useCallback(() => newGame(randomRound()), []);
  const session = useGameSession({ gameSlug: "ftw", createInitialState });
  const { room, game, me, other, names, bothJoined, roomName, canRenameRoom, setRoomName, roomNameError, online, canTakeOver, pickIdentity, transact, setGame, newRoom } =
    session;

  const status = game?.current.status;
  const isMaster = game != null && me === masterOf(game.round);
  const placing = game != null && me != null && ((status === "RANKING" && isMaster) || (status === "GUESSING" && !isMaster));

  const masterName = (game && names[masterOf(game.round)]) || "Master";
  const guesserName = (game && names[guesserOf(game.round)]) || "Guesser";
  const myRoleLabel = me != null ? (isMaster ? "Master" : "Guesser") : undefined;
  const myName = me != null ? names[me] : undefined;

  useEffect(() => {
    document.title = placing || (status === "REVEALED" && me) ? `▶ Your turn! · ${GAME_TITLE}` : GAME_TITLE;
  }, [placing, status, me]);

  const handleLockIn = (order: string[]) => transact((current) => lockIn(current, order));
  const handleSubmitGuess = (order: string[]) => transact((current) => submitGuess(current, order));
  const handleChangePrompt = (round: CurrentRound) => transact((current) => setPrompt(current, round));
  const handleNextRound = () => transact((current) => advanceRound(current, randomRound(current.usedPrompts ?? [])));
  // Seats live at the room level, so a reset keeps both players seated -
  // only the game itself starts over.
  const handleResetGame = () => setGame(newGame(randomRound()));

  // RoundBoard's primary action renders in a bar fixed to the viewport
  // bottom while placing or revealed, which would otherwise cover the
  // Footer once scrolled all the way down (it's pinned to the screen, not
  // the page, so it sits over whatever is currently at the bottom - not
  // just RoundBoard's own last row). Reserve clearance for it here, after
  // the Footer, rather than inside RoundBoard itself.
  const hasFixedBar = bothJoined && (placing || status === "REVEALED");

  return (
    <main className={`mx-auto px-4 pt-3.5 ${CONTAINER_MAX_WIDTH_CLASS} ${hasFixedBar ? "pb-52" : "pb-7"}`}>
      <InAppBrowserBanner />
      <Header
        title={GAME_TITLE}
        round={me && game ? game.round : undefined}
        myScore={me && game ? game.totals[me] : undefined}
        theirScore={me && game && other ? game.totals[other] : undefined}
      />

      {session.connectionError || session.roomMissing || !game ? (
        <p role={session.connectionError || session.roomMissing ? "alert" : undefined} className="rounded-xl bg-white px-3.5 py-2.5 font-semibold text-black shadow-[0_3px_8px_rgba(0,0,0,.25)]">
          {session.connectionError ? CONNECTION_ERROR_MESSAGE : session.roomMissing ? ROOM_MISSING_MESSAGE : "Connecting to the room…"}
        </p>
      ) : !me ? (
        <RolePicker names={names} canTakeOver={canTakeOver} onPick={pickIdentity} />
      ) : !bothJoined ? (
        <InviteLinkBanner room={room} roomName={roomName} onRenameRoom={canRenameRoom ? setRoomName : undefined} nameError={roomNameError} />
      ) : (
        <>
          <RoleStickers
            roles={[
              { emoji: "👑", label: "Master", name: masterName, isYou: isMaster, online: online[masterOf(game.round)] },
              { emoji: "🔎", label: "Guesser", name: guesserName, isYou: !isMaster, online: online[guesserOf(game.round)] },
            ]}
          />
          <RoundBoard
            key={`${game.round}-${status}-${game.current.items.map((i) => i.id).join("|")}`}
            status={game.current.status}
            isMaster={isMaster}
            placing={placing}
            prompt={game.current.prompt}
            items={game.current.items}
            masterName={masterName}
            guesserName={guesserName}
            usedPrompts={game.usedPrompts ?? []}
            masterOrder={game.current.masterOrder ?? null}
            guessOrder={game.current.guessOrder ?? null}
            score={game.current.score ?? null}
            onLockIn={handleLockIn}
            onSubmitGuess={handleSubmitGuess}
            onNextRound={handleNextRound}
            onChangePrompt={handleChangePrompt}
          />
          <SessionRecap history={game.history ?? []} names={names} />
        </>
      )}

      <Footer
        room={room}
        roomName={roomName}
        identity={myRoleLabel ? (myName ? `${myName} · ${myRoleLabel}` : myRoleLabel) : undefined}
        onReset={handleResetGame}
        onNewRoom={newRoom}
      />
    </main>
  );
}
