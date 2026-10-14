"use client";

import { useCallback, useEffect } from "react";
import { useGameSession } from "@/lib/session/useGameSession";
import { GAME_TITLE } from "@/lib/games/ecard/constants";
import {
  continueRound,
  ecRoleOfSeat,
  emperorSeatOf,
  isGameComplete,
  newGame,
  nextRound as advanceRound,
  nextToPlace,
  placeCard,
  slaveSeatOf,
} from "@/lib/games/ecard/game";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import RolePicker from "@/components/RolePicker";
import RoleStickers from "@/components/RoleStickers";
import InviteLinkBanner from "@/components/InviteLinkBanner";
import RoundBoard from "@/components/ecard/RoundBoard";

export default function ECardPage() {
  const createInitialState = useCallback(() => newGame(), []);
  const session = useGameSession({ gameSlug: "ecard", createInitialState });
  const { room, game, me, other, names, bothJoined, pickIdentity, transact, setGame, newRoom } = session;

  const myEcRole = game && me ? ecRoleOfSeat(game.round, me) : null;
  const isEmperor = myEcRole === "emperor";

  const emperorName = (game && names[emperorSeatOf(game.round)]) || "Emperor";
  const slaveName = (game && names[slaveSeatOf(game.round)]) || "Slave";
  const myRoleLabel = myEcRole != null ? (myEcRole === "emperor" ? "Emperor" : "Slave") : undefined;
  const myName = me != null ? names[me] : undefined;

  const canPlaceNow = game != null && myEcRole != null && nextToPlace(game.current) === myEcRole;
  const myTurn = canPlaceNow || (game != null && game.current.status === "REVEALED");

  useEffect(() => {
    document.title = myTurn ? `▶ Your turn! · ${GAME_TITLE}` : GAME_TITLE;
  }, [myTurn]);

  const handlePlay = (cardId: string) => {
    if (!myEcRole) return;
    const role = myEcRole;
    transact((current) => placeCard(current, role, cardId));
  };
  const handleContinue = () => transact((current) => continueRound(current));
  const handleNextRound = () => transact((current) => advanceRound(current));
  const handleResetGame = () => setGame(newGame());

  // Same reasoning as First to Worst: RoundBoard's primary action renders in
  // a bar fixed to the viewport bottom, which also covers the Footer once
  // scrolled all the way down - so the clearance padding lives here, on
  // <main>, not inside RoundBoard.
  const hasFixedBar = bothJoined && game != null && (canPlaceNow || game.current.status === "REVEALED");

  return (
    <main className={`mx-auto max-w-[520px] px-4 pt-3.5 ${hasFixedBar ? "pb-44" : "pb-7"}`}>
      <Header
        title={GAME_TITLE}
        round={me && game ? game.round : undefined}
        myScore={me && game ? game.totals[me] : undefined}
        theirScore={me && game && other ? game.totals[other] : undefined}
      />

      {!game ? (
        <p className="rounded-xl bg-white px-3.5 py-2.5 font-semibold text-black shadow-[0_3px_8px_rgba(0,0,0,.25)]">
          Connecting to the room…
        </p>
      ) : !me ? (
        <RolePicker names={names} onPick={pickIdentity} />
      ) : !bothJoined ? (
        <InviteLinkBanner />
      ) : (
        <>
          <RoleStickers
            roles={[
              { emoji: "👑", label: "Emperor", name: emperorName, isYou: isEmperor },
              { emoji: "🃏", label: "Slave", name: slaveName, isYou: !isEmperor },
            ]}
          />
          <RoundBoard
            round={game.current}
            myRole={myEcRole!}
            emperorName={emperorName}
            slaveName={slaveName}
            isComplete={isGameComplete(game)}
            onPlay={handlePlay}
            onContinue={handleContinue}
            onNextRound={handleNextRound}
          />
        </>
      )}

      <Footer
        room={room}
        identity={myRoleLabel ? (myName ? `${myName} · ${myRoleLabel}` : myRoleLabel) : undefined}
        onReset={handleResetGame}
        onNewRoom={newRoom}
      />
    </main>
  );
}
