"use client";

import { useCallback, useEffect } from "react";
import { useGameSession } from "@/lib/session/useGameSession";
import { LEAVE_CONFIRM, leaveToHub, roomProblemMessage } from "@/lib/session/shared/roomActions";
import type { Role } from "@/lib/session/types";
import InAppBrowserBanner from "@/components/InAppBrowserBanner";
import { GAME_TITLE } from "@/lib/games/ftw/constants";
import {
  type CurrentRound,
  lockIn,
  masterOf,
  newGame,
  nextRound as advanceRound,
  setPlaced,
  setPrompt,
  setTopics,
  submitGuess,
} from "@/lib/games/ftw/game";
import { randomRound, TOPICS } from "@/lib/games/ftw/prompts";
import Footer from "@/components/Footer";
import RolePicker from "@/components/RolePicker";
import InviteLinkBanner from "@/components/InviteLinkBanner";
import RoundBoard from "@/components/ftw/RoundBoard";
import { GameHeader, ScoreCard, type ScorePlayer } from "@/components/ftw/Scoreboard";
import SessionRecap from "@/components/ftw/SessionRecap";
import TopicPicker from "@/components/ftw/TopicPicker";
import { CREATOR_COLOR, PARTNER_COLOR, TEXT, THEME } from "@/components/ftw/ui";

/**
 * Same Page (formerly First to Worst): references/ftw/first-to-worst-game-design.md.
 * Its rooms keep the `ftw` slug; `/ftw` redirects here (next.config.ts).
 */
export default function SamePagePage() {
  const createInitialState = useCallback(() => newGame(randomRound()), []);
  const session = useGameSession({ gameSlug: "ftw", createInitialState });
  const { room, game, me, other, names, bothJoined, hostSeat, roomName, canRenameRoom, setRoomName, roomNameError, online, canTakeOver, pickIdentity, transact, setGame, newRoom } =
    session;

  const status = game?.current.status;
  const isRanker = game != null && me === masterOf(game.round);
  const placing = game != null && me != null && ((status === "RANKING" && isRanker) || (status === "GUESSING" && !isRanker));

  useEffect(() => {
    document.title = placing || (status === "REVEALED" && me) ? `▶ Your turn! · ${GAME_TITLE}` : GAME_TITLE;
  }, [placing, status, me]);

  const handleLockIn = (order: string[]) => transact((current) => lockIn(current, order));
  const handleSubmitGuess = (order: string[]) => transact((current) => submitGuess(current, order));
  const handleChangePrompt = (round: CurrentRound) => transact((current) => setPrompt(current, round));
  // Live placement progress for the other player. Tied to the phase it was
  // made in, so a late write can't land on the next player's turn.
  const handlePlacedChange = (placedIds: string[]) => {
    if (status === "RANKING" || status === "GUESSING") transact((current) => setPlaced(current, status, placedIds));
  };
  const handleNextRound = () => transact((current) => advanceRound(current, randomRound(current.usedPrompts ?? [], current.topics ?? [])));
  const handleTopicsChange = (topics: string[]) => {
    if (me) transact((current) => setTopics(current, me, topics, TOPICS));
  };
  // Seats live at the room level, so a reset keeps both players seated -
  // only the game itself starts over (with the same topics).
  // Only topics the bank still has (a renamed category drops out rather than blocking changes).
  const topics = (game?.topics ?? []).filter((t) => TOPICS.includes(t));
  const handleResetGame = () => setGame(newGame(randomRound([], topics), topics));

  // The room's creator is yellow, the other player pink (p1 is yellow if the creator holds no seat).
  const yellowSeat: Role = hostSeat ?? "p1";
  const colorOf = (seat: Role) => (seat === yellowSeat ? CREATOR_COLOR : PARTNER_COLOR);
  const partnerName = (other && names[other]) || "Your partner";
  const players: ScorePlayer[] | undefined =
    game && me && other && bothJoined
      ? [me, other].map((seat) => ({ name: names[seat] ?? "", score: game.totals[seat], color: colorOf(seat), isMe: seat === me }))
      : undefined;
  const myName = me != null ? names[me] : undefined;
  const myRole = me != null ? (isRanker ? "Ranking" : "Guessing") : undefined;

  const problem = roomProblemMessage(session);
  const notice = problem ?? (!game ? "Connecting to the room…" : null);
  // Asks first once both are playing: leaving ends the game for the partner.
  // Not offered under a notice: no room, or still connecting (the seat isn't known yet).
  const leave = () => void leaveToHub(session.leave, me && bothJoined ? LEAVE_CONFIRM : undefined);

  return (
    <div style={THEME} className={`${TEXT} min-h-screen bg-[var(--desk)] text-[var(--ink)]`}>
      <main className="mx-auto flex max-w-[560px] flex-col gap-3.5 px-4 pt-3.5 pb-6 min-[900px]:max-w-[1180px] min-[900px]:gap-8 min-[900px]:px-10 min-[900px]:pt-8 min-[900px]:pb-10">
        <InAppBrowserBanner />
        <GameHeader round={players ? game?.round : undefined} players={players} roomLabel={roomName || room} />

        {notice || !game ? (
          <p
            role={problem ? "alert" : undefined}
            className="m-0 rounded-2xl border-2 border-[var(--ink)] bg-white px-3.5 py-2.5 font-bold"
          >
            {notice}
          </p>
        ) : !me ? (
          <div className="min-[900px]:mx-auto min-[900px]:w-full min-[900px]:max-w-[480px]">
            <RolePicker names={names} canTakeOver={canTakeOver} onPick={pickIdentity} accentColor="#1D2240" accentShadowColor="#0A0C22" />
          </div>
        ) : !bothJoined ? (
          <div className="min-[900px]:mx-auto min-[900px]:w-full min-[900px]:max-w-[480px]">
            <InviteLinkBanner
              room={room}
              roomName={roomName}
              onRenameRoom={canRenameRoom ? setRoomName : undefined}
              nameError={roomNameError}
              accentColor="#1D2240"
              accentShadowColor="#0A0C22"
            />
          </div>
        ) : (
          <RoundBoard
            key={`${game.round}-${status}-${game.current.items.map((i) => i.id).join("|")}`}
            status={game.current.status}
            isRanker={isRanker}
            placing={placing}
            round={game.round}
            prompt={game.current.prompt}
            items={game.current.items}
            partnerName={partnerName}
            partnerColor={other ? colorOf(other) : PARTNER_COLOR}
            partnerOnline={other ? Boolean(online[other]) : false}
            usedPrompts={game.usedPrompts ?? []}
            topics={topics}
            masterOrder={game.current.masterOrder ?? null}
            guessOrder={game.current.guessOrder ?? null}
            score={game.current.score ?? null}
            placed={game.current.placed ?? []}
            onPlacedChange={handlePlacedChange}
            onLockIn={handleLockIn}
            onSubmitGuess={handleSubmitGuess}
            onNextRound={handleNextRound}
            onLeave={leave}
            onChangePrompt={handleChangePrompt}
            scoreCard={players ? <ScoreCard round={game.round} players={players} /> : null}
            extras={
              <>
                <TopicPicker topics={topics} onChange={isRanker ? handleTopicsChange : undefined} rankerName={(game && names[masterOf(game.round)]) || "The ranker"} />
                <SessionRecap history={game.history ?? []} names={names} />
              </>
            }
          />
        )}

        <Footer
          room={room}
          roomName={roomName}
          identity={myRole ? (myName ? `${myName} · ${myRole}` : myRole) : undefined}
          onReset={session.roomClosed ? undefined : handleResetGame}
          onNewRoom={newRoom}
          onLeave={notice ? undefined : leave}
        />
      </main>
    </div>
  );
}
