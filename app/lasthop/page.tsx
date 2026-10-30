"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useGameSession } from "@/lib/session/useGameSession";
import { LEAVE_CONFIRM, leaveToHub, roomProblemMessage } from "@/lib/session/shared/roomActions";
import { secondsLeft } from "@/lib/session/shared/deadline";
import { useDeadline, useServerClock, useTicker } from "@/lib/session/shared/serverClock";
import type { Role } from "@/lib/session/types";
import { generateBoard, legalMoves } from "@/lib/games/lasthop/board";
import { GAME_SLUG, GAME_TITLE } from "@/lib/games/lasthop/constants";
import {
  clockLeft,
  colourOf,
  dueAt,
  flag,
  type LastHopState,
  matchWinner,
  move,
  moverOf,
  needsFreshBoard,
  newGame,
  nextRound,
  normalize,
  seatOf,
  setMode,
  startMatch,
  toLobby,
} from "@/lib/games/lasthop/game";
import InAppBrowserBanner from "@/components/InAppBrowserBanner";
import InviteLinkBanner from "@/components/InviteLinkBanner";
import RolePicker from "@/components/RolePicker";
import Board from "@/components/lasthop/Board";
import { AskDialog, Footer, Header, Lobby, MatchOver, Message, PlayerBar, RoundBanner } from "@/components/lasthop/Screens";
import { FONT, THEME } from "@/components/lasthop/ui";
import "@/components/lasthop/lasthop.css";

const randomSeat = (): Role => (Math.random() < 0.5 ? "p1" : "p2");

/**
 * Last Hop: a 1v1 duel on a Track or a Grid (the `lasthop` skill). The whole
 * match lives in `games/{room}/lasthop`; a clock running out and the next
 * round are applied by whichever device sees the deadline pass first
 * (`useDeadline` + `flag` / `nextRound`).
 */
export default function LastHopPage() {
  const createInitialState = useCallback(() => newGame(), []);
  const session = useGameSession<LastHopState>({ gameSlug: GAME_SLUG, createInitialState });
  const { room, me, other, names, bothJoined, roomName, canRenameRoom, setRoomName, roomNameError, online, canTakeOver, pickIdentity, transact, setGame, newRoom } = session;
  const raw = session.game;
  const game = useMemo(() => (raw ? normalize(raw) : null), [raw]);
  const serverNow = useServerClock();

  useDeadline(game ? dueAt(game) : undefined, serverNow, () =>
    transact((current) => {
      const s = normalize(current);
      if (s.phase === "playing") return flag(s, serverNow());
      // Only a new pair needs a board: skip generating one otherwise.
      const fresh = needsFreshBoard(s) ? generateBoard(s.mode, Math.random) : s.board!;
      return nextRound(s, fresh, serverNow());
    }),
  );

  const timed = game?.phase === "playing" || game?.phase === "roundOver";
  const now = useTicker(timed, serverNow, 100);

  const playing = game?.phase === "playing" && game.board != null;
  const myTurn = playing && me != null && moverOf(game) === me;
  const started = playing && now != null && game.turnStartedAt != null && now >= game.turnStartedAt;

  useEffect(() => {
    document.title = myTurn ? `▶ Your move · ${GAME_TITLE}` : GAME_TITLE;
  }, [myTurn]);

  const name = (seat: Role) => names[seat] || (seat === "p1" ? "Player 1" : "Player 2");

  const onMove = (from: number, to: number) => {
    if (me) transact((current) => move(current, me, from, to, serverNow()));
  };
  const onStart = () => transact((current) => startMatch(current, generateBoard(normalize(current).mode, Math.random), randomSeat(), serverNow()));
  const onReset = () => setGame(newGame(game?.mode));

  // Leaving mid-match ends it for the other player: ask first.
  const [askingLeave, setAskingLeave] = useState(false);
  const leaveNow = () => leaveToHub(session.leave);
  const midMatch = game?.phase === "playing" || game?.phase === "roundOver";
  const leave = () => (me && bothJoined && midMatch ? setAskingLeave(true) : void leaveNow());

  const problem = roomProblemMessage(session);
  let screen;
  if (problem) screen = <Message text={problem} alert home />;
  else if (!game) screen = <Message text="Connecting to the room…" />;
  else if (!me && !(bothJoined && game.phase !== "lobby")) {
    screen = <RolePicker names={names} canTakeOver={canTakeOver} onPick={pickIdentity} accentColor="#FF8A4C" accentShadowColor="#B4511E" />;
  } else if (!bothJoined) {
    screen = (
      <InviteLinkBanner
        room={room}
        roomName={roomName}
        onRenameRoom={canRenameRoom ? setRoomName : undefined}
        nameError={roomNameError}
        accentColor="#FF8A4C"
        accentShadowColor="#B4511E"
        accentTextColor="#1E1733"
      />
    );
  } else if (game.phase === "lobby") {
    screen = <Lobby mode={game.mode} onMode={(mode) => transact((s) => setMode(s, mode))} onStart={onStart} />;
  } else if (game.phase === "matchOver") {
    screen = (
      <MatchOver
        score={game.score}
        history={game.history}
        winner={matchWinner(game)}
        name={name}
        me={me}
        onAgain={me ? onStart : undefined}
        onLobby={me ? () => transact(toLobby) : undefined}
      />
    );
  } else if (game.board) {
    const board = game.board;
    // The viewer's own pieces start at the bottom (or right): whoever plays A sees the board turned.
    const rotated = me != null && colourOf(game, me) === "A";
    const bottom = rotated ? seatOf(game, "A") : seatOf(game, "B");
    const top = bottom === "p1" ? "p2" : "p1";
    const t = now ?? game.turnStartedAt ?? 0;
    const bar = (seat: Role) => (
      <PlayerBar
        seat={seat}
        name={name(seat)}
        isMe={seat === me}
        clockMs={clockLeft(game, seat, t)}
        running={playing && moverOf(game) === seat && started}
        moves={legalMoves(board, colourOf(game, seat)).length}
        online={Boolean(online[seat])}
        wins={game.score[seat]}
      />
    );
    const result = game.phase === "roundOver" ? game.history.at(-1) : undefined;
    const status = !playing
      ? null
      : !started
        ? `Get ready… ${game.turnStartedAt != null && now != null ? secondsLeft(game.turnStartedAt, now) : ""}`
        : myTurn
          ? "Your move"
          : `${name(moverOf(game))} to move`;
    screen = (
      <div className="grid gap-3">
        {bar(top)}
        {result ? (
          <RoundBanner
            result={result}
            name={name}
            me={me}
            nextIn={game.nextAt != null && now != null ? secondsLeft(game.nextAt, now) : null}
            sameBoard={(game.round + 1) % 2 === 0}
          />
        ) : null}
        <div className="py-1">
          <Board
            board={board}
            seatOf={(colour) => seatOf(game, colour)}
            rotated={rotated}
            moving={myTurn && started ? colourOf(game, me!) : null}
            last={game.last}
            moveKey={game.moves}
            onMove={onMove}
            nameOf={name}
          />
        </div>
        {bar(bottom)}
        {status ? (
          <p aria-live="polite" className={`${FONT} m-0 text-center text-[18px] font-bold ${myTurn && started ? "text-[var(--target)]" : "text-[var(--muted)]"}`}>
            {status}
          </p>
        ) : null}
      </div>
    );
  }

  const score = game && game.phase !== "lobby" && other ? `${game.score.p1}–${game.score.p2}` : undefined;
  return (
    <div style={THEME} className={`${FONT} min-h-screen bg-[var(--stage)] font-medium text-[var(--text)]`}>
      <main className="mx-auto flex max-w-[560px] flex-col gap-3 px-4 pt-3 pb-6 min-[640px]:max-w-[840px] min-[640px]:gap-4 min-[640px]:pt-6">
        <InAppBrowserBanner />
        <Header round={game && game.phase !== "lobby" ? game.round : undefined} score={score} />
        {/* The board takes the page's width; the other screens stay a readable column. */}
        {midMatch && bothJoined ? screen : <div className="mx-auto w-full max-w-[560px]">{screen}</div>}
        <Footer room={room} roomName={roomName} onReset={session.roomClosed || problem ? undefined : onReset} onNewRoom={newRoom} onLeave={problem || !game ? undefined : leave} />
        {askingLeave ? <AskDialog question={LEAVE_CONFIRM} onCancel={() => setAskingLeave(false)} onConfirm={leaveNow} /> : null}
      </main>
    </div>
  );
}
