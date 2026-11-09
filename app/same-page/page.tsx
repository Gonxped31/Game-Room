"use client";

import { useCallback, useEffect, useState } from "react";
import { useGameSession } from "@/lib/session/useGameSession";
import { leaveToHub, ROOM_TEXT, roomProblemMessage } from "@/lib/session/shared/roomActions";
import type { Role } from "@/lib/session/types";
import type { Lang } from "@/lib/games/shared/language";
import { useLang, useText } from "@/lib/i18n/useLang";
import { useReportFinished } from "@/lib/tracking/useReportFinished";
import InAppBrowserBanner from "@/components/InAppBrowserBanner";
import { GAME_TITLE } from "@/lib/games/ftw/constants";
import {
  contentLang,
  type CurrentRound,
  lockIn,
  masterOf,
  newGame,
  nextRound as advanceRound,
  revealedRoundId,
  setLang,
  setPlaced,
  setPrompt,
  setTopics,
  submitGuess,
} from "@/lib/games/ftw/game";
import { randomRound, TOPICS } from "@/lib/games/ftw/prompts";
import Footer from "@/components/Footer";
import AskDialog from "@/components/ftw/AskDialog";
import RolePicker from "@/components/RolePicker";
import InviteLinkBanner from "@/components/InviteLinkBanner";
import RoundBoard from "@/components/ftw/RoundBoard";
import { GameHeader, ScoreCard, type ScorePlayer } from "@/components/ftw/Scoreboard";
import SessionRecap from "@/components/ftw/SessionRecap";
import TopicPicker from "@/components/ftw/TopicPicker";
import { FTW_TEXT } from "@/components/ftw/text";
import { CREATOR_COLOR, PARTNER_COLOR, TEXT, THEME } from "@/components/ftw/ui";
import RulesButton from "@/components/ftw/Rules";

/**
 * Same Page (formerly First to Worst): references/ftw/first-to-worst-game-design.md.
 * Its rooms keep the `ftw` slug; `/ftw` redirects here (next.config.ts).
 */
export default function SamePagePage() {
  const lang = useLang();
  const t = useText(FTW_TEXT);
  // A new room's prompts start in its creator's interface language.
  const createInitialState = useCallback(() => newGame(randomRound([], [], lang), [], lang), [lang]);
  const session = useGameSession({ gameSlug: "ftw", createInitialState });
  const { room, game, me, other, names, bothJoined, hostSeat, roomName, canRenameRoom, setRoomName, roomNameError, online, canTakeOver, pickIdentity, transact, setGame, newRoom } =
    session;

  const status = game?.current.status;
  const isRanker = game != null && me === masterOf(game.round);
  const placing = game != null && me != null && ((status === "RANKING" && isRanker) || (status === "GUESSING" && !isRanker));
  // The room's content language: the bank prompts are drawn from (English for rooms made before it).
  const roomLang: Lang = game ? contentLang(game) : lang;

  useEffect(() => {
    document.title = placing || (status === "REVEALED" && me) ? t.yourTurnTitle(GAME_TITLE) : GAME_TITLE;
  }, [placing, status, me, t]);

  // Same Page has no final result (rounds go on as long as the players like),
  // so each revealed round is reported as a finished game, by both seated players.
  const roundId = game && me && bothJoined ? revealedRoundId(game) : null;
  useReportFinished(roundId ? { slug: "ftw", mode: "room", id: roundId, room, players: 2, lang: roomLang } : null);

  const handleLockIn = (order: string[]) => transact((current) => lockIn(current, order));
  const handleSubmitGuess = (order: string[]) => transact((current) => submitGuess(current, order));
  const handleChangePrompt = (round: CurrentRound) => transact((current) => setPrompt(current, round));
  // Live placement progress for the other player. Tied to the phase it was
  // made in, so a late write can't land on the next player's turn.
  const handlePlacedChange = (placedIds: string[]) => {
    if (status === "RANKING" || status === "GUESSING") transact((current) => setPlaced(current, status, placedIds));
  };
  const handleNextRound = () => transact((current) => advanceRound(current, randomRound(current.usedPrompts ?? [], current.topics ?? [], contentLang(current))));
  const handleTopicsChange = (topics: string[]) => {
    if (me) transact((current) => setTopics(current, me, topics, TOPICS));
  };
  const handleLangChange = (next: Lang) => {
    if (me) transact((current) => setLang(current, me, next));
  };
  // Seats live at the room level, so a reset keeps both players seated -
  // only the game itself starts over (with the same topics and language).
  // Only topics the bank still has (a renamed category drops out rather than blocking changes).
  const topics = (game?.topics ?? []).filter((topic) => TOPICS.includes(topic));
  const handleResetGame = () => setGame(newGame(randomRound([], topics, roomLang), topics, roomLang));

  // The room's creator is yellow, the other player pink (p1 is yellow if the creator holds no seat).
  const yellowSeat: Role = hostSeat ?? "p1";
  const colorOf = (seat: Role) => (seat === yellowSeat ? CREATOR_COLOR : PARTNER_COLOR);
  const partnerName = (other && names[other]) || t.yourPartner;
  const players: ScorePlayer[] | undefined =
    game && me && other && bothJoined
      ? [me, other].map((seat) => ({ name: names[seat] ?? "", score: game.totals[seat], color: colorOf(seat), isMe: seat === me }))
      : undefined;
  const myName = me != null ? names[me] : undefined;
  const myRole = me != null ? (isRanker ? t.roleRanking : t.roleGuessing) : undefined;

  const problem = roomProblemMessage(session, lang);
  const notice = problem ?? (!game ? t.connecting : null);
  // Asks first once both are playing: leaving ends the game for the partner.
  // Not offered under a notice: no room, or still connecting (the seat isn't known yet).
  const [askingLeave, setAskingLeave] = useState(false);
  const leaveNow = () => leaveToHub(session.leave);
  const leave = () => (me && bothJoined ? setAskingLeave(true) : void leaveNow());

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
            <div className="mt-3 flex justify-center">
              <RulesButton variant="link" />
            </div>
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
            contentLang={roomLang}
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
                <TopicPicker
                  topics={topics}
                  onChange={isRanker ? handleTopicsChange : undefined}
                  lang={roomLang}
                  onLangChange={isRanker ? handleLangChange : undefined}
                  rankerName={(game && names[masterOf(game.round)]) || t.theRanker}
                />
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
        {askingLeave && <AskDialog question={ROOM_TEXT[lang].leaveConfirm} onCancel={() => setAskingLeave(false)} onConfirm={leaveNow} />}
      </main>
    </div>
  );
}
