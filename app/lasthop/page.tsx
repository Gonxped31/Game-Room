"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useGameSession } from "@/lib/session/useGameSession";
import { usePublicRoom } from "@/lib/session/usePublicRoom";
import { CONNECTION_ERROR_MESSAGE } from "@/lib/session/shared/auth";
import { findMatch } from "@/lib/session/shared/findMatch";
import { LEAVE_CONFIRM, leaveToHub, roomProblemMessage } from "@/lib/session/shared/roomActions";
import { secondsLeft } from "@/lib/session/shared/deadline";
import { useDeadline, useServerClock, useTicker } from "@/lib/session/shared/serverClock";
import type { Role } from "@/lib/session/types";
import { generateBoard, legalMoves } from "@/lib/games/lasthop/board";
import { GAME_SLUG, GAME_TITLE, type Mode, MODES } from "@/lib/games/lasthop/constants";
import { LASTHOP_MATCH } from "@/lib/games/matchGames";
import { roomHref } from "@/lib/games/registry";
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
  pawnOf,
  seatOf,
  setPawn,
  setMode,
  startMatch,
  vote,
} from "@/lib/games/lasthop/game";
import InAppBrowserBanner from "@/components/InAppBrowserBanner";
import InviteLinkBanner from "@/components/InviteLinkBanner";
import RolePicker from "@/components/RolePicker";
import Board from "@/components/lasthop/Board";
import RulesButton from "@/components/lasthop/Rules";
import { AskDialog, Footer, Header, Lobby, MatchLobby, MatchOver, Message, PawnPicker, PlayerBar, RoundBanner } from "@/components/lasthop/Screens";
import { FONT, THEME } from "@/components/lasthop/ui";
import "@/components/lasthop/lasthop.css";

const randomSeat = (): Role => (Math.random() < 0.5 ? "p1" : "p2");
const isMode = (value: unknown): value is Mode => MODES.includes(value as Mode);
/** The mode the hub's Start picked (`?mode=`), for a room created on this visit. */
const modeFromUrl = (): Mode => {
  const mode = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("mode");
  return isMode(mode) ? mode : "track";
};

/**
 * Last Hop: a 1v1 duel on a Track or a Grid (the `lasthop` skill). The whole
 * match lives in `games/{room}/lasthop`; a clock running out and the next
 * round are applied by whichever device sees the deadline pass first
 * (`useDeadline` + `flag` / `nextRound`). A matchmaking room (one queue
 * per mode) starts by itself once both players are online.
 */
export default function LastHopPage() {
  const createInitialState = useCallback(() => newGame(modeFromUrl()), []);
  const session = useGameSession<LastHopState>({ gameSlug: GAME_SLUG, createInitialState });
  const { room, me, other, names, bothJoined, roomName, canRenameRoom, setRoomName, roomNameError, online, canTakeOver, pickIdentity, transact, setGame, newRoom } = session;
  const raw = session.game;
  const game = useMemo(() => (raw ? normalize(raw) : null), [raw]);
  const serverNow = useServerClock();

  // Once the room exists, the shared link is just /lasthop#code.
  useEffect(() => {
    if (game && window.location.search) window.history.replaceState(window.history.state, "", window.location.pathname + window.location.hash);
  }, [game]);

  useDeadline(game ? dueAt(game) : undefined, serverNow, () =>
    transact((current) => {
      const s = normalize(current);
      if (s.phase === "playing") return flag(s, serverNow());
      // Only a new pair needs a board: skip generating one otherwise.
      const fresh = needsFreshBoard(s) ? generateBoard(s.mode, Math.random, s.start) : s.board!;
      return nextRound(s, fresh, serverNow());
    }),
  );

  const timed = game?.phase === "playing" || game?.phase === "roundOver";
  const now = useTicker(timed, serverNow, 100);

  const playing = game?.phase === "playing" && game.board != null;
  const myTurn = playing && me != null && moverOf(game) === me;
  // "Get ready" is only before a round's first move: after that, a device whose
  // server clock runs a little behind the mover's must not lock the board again.
  const started = playing && game.turnStartedAt != null && (game.moves > 0 || (now != null && now >= game.turnStartedAt));

  useEffect(() => {
    document.title = myTurn ? `▶ Your move · ${GAME_TITLE}` : GAME_TITLE;
  }, [myTurn]);

  const name = (seat: Role) => names[seat] || (seat === "p1" ? "Player 1" : "Player 2");

  const onMove = (from: number, to: number) => {
    if (me) transact((current) => move(current, me, from, to, serverNow()));
  };
  const onStart = () =>
    transact((current) => {
      const s = normalize(current);
      return startMatch(s, generateBoard(s.mode, Math.random, s.start), randomSeat(), serverNow());
    });
  // Reset keeps the mode and the pawns players picked.
  const onReset = () => setGame(newGame(game?.mode, game?.pawns));

  // A matchmaking room: its queue is its mode; no host, it starts by itself.
  const publicMode = isMode(session.publicLang) ? session.publicLang : null;
  const midMatch = game?.phase === "playing" || game?.phase === "roundOver";
  const publicRoom = usePublicRoom({
    session,
    game: LASTHOP_MATCH[publicMode ?? "track"],
    inLobby: game?.phase === "lobby",
    ready: session.onlineSeats.length >= 2,
    onStart,
    serverNow,
    leaveOnBack: game != null && !midMatch,
  });
  const isPublic = publicRoom.isPublic;
  const lobbyNow = useTicker(publicRoom.autoStartAt != null, serverNow, 250);
  // A private room's host (its creator; whoever is left, if the host has gone)
  // decides everything: the mode (in the lobby and between matches), Start,
  // Play again, Reset. The guest only plays. A matchmaking room has no host: its players vote.
  const isHost = !isPublic && me != null && (session.hostSeat == null || session.hostSeat === me);
  const hostName = session.hostSeat ? name(session.hostSeat) : "The host";

  // The other player left a matchmaking room: search again in the same mode.
  const [finding, setFinding] = useState<"idle" | "searching" | "offline">("idle");
  const findAnother = async () => {
    const myName = me ? names[me] : undefined;
    // The mode this room plays now: a vote may have changed it from its queue's.
    const mode = game?.mode ?? publicMode;
    if (!session.uid || !myName || !mode) return;
    setFinding("searching");
    try {
      await session.leave();
      const code = await findMatch({ uid: session.uid, name: myName, lang: mode, game: LASTHOP_MATCH[mode] });
      window.location.href = roomHref(GAME_SLUG, code);
    } catch {
      setFinding("offline");
    }
  };

  // Leaving mid-match ends it for the other player: ask first.
  const [askingLeave, setAskingLeave] = useState(false);
  const leaveNow = () => (isPublic ? publicRoom.leave() : leaveToHub(session.leave));
  const leave = () => (me && bothJoined && midMatch ? setAskingLeave(true) : void leaveNow());

  // Each player picks their own pawn (between matches): a personal choice, not the host's.
  const pawns = { p1: game ? pawnOf(game, "p1") : "square", p2: game ? pawnOf(game, "p2") : "circle" } as const;
  const pawnPicker =
    game && me && other && (game.phase === "lobby" || game.phase === "matchOver") ? (
      <PawnPicker me={me} mine={pawns[me]} theirs={pawns[other]} otherName={name(other)} onPick={(pawn) => transact((st) => setPawn(st, me, pawn))} />
    ) : null;

  const problem = roomProblemMessage(session);
  let screen;
  // The matchmaking screens (waiting, voting) have their own Leave room button: no footer under them.
  let footer = !(isPublic && game?.phase === "matchOver");
  if (problem) screen = <Message text={problem} alert home />;
  else if (!game) screen = <Message text="Connecting to the room…" />;
  else if (isPublic && me && publicMode && (!bothJoined || !other)) {
    // Alone in a matchmaking room: still waiting, or the other player left mid-match.
    footer = false;
    screen =
      game.phase === "lobby" ? (
        <MatchLobby mode={publicMode} myName={name(me)} status="Waiting for a player…" onLeave={leave} />
      ) : (
        <MatchLobby
          mode={publicMode}
          myName={name(me)}
          status={finding === "searching" ? "Looking for a player…" : finding === "offline" ? CONNECTION_ERROR_MESSAGE : "The other player left."}
          onFindAnother={finding === "searching" ? undefined : () => void findAnother()}
          onLeave={leave}
        />
      );
  } else if (isPublic && me && publicMode && other && game.phase === "lobby") {
    const secs = publicRoom.autoStartAt != null && lobbyNow != null ? Math.max(0, Math.ceil((publicRoom.autoStartAt - lobbyNow) / 1000)) : null;
    const status = secs != null ? (secs > 0 ? `Starting in ${secs} s` : "Starting…") : online[other] ? "Getting ready…" : `${name(other)} is offline.`;
    footer = false;
    screen = <MatchLobby mode={publicMode} myName={name(me)} otherName={name(other)} status={status} onLeave={leave} pawnPicker={pawnPicker} />;
  } else if (!me && !(bothJoined && game.phase !== "lobby")) {
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
    screen = (
      <Lobby
        mode={game.mode}
        onMode={isHost ? (mode) => transact((st) => setMode(st, mode)) : undefined}
        onStart={isHost ? onStart : undefined}
        hostName={hostName}
        rules={<RulesButton me={me} pawns={pawns} variant="link" />}
        pawnPicker={pawnPicker}
      />
    );
  } else if (game.phase === "matchOver") {
    screen = (
      <MatchOver
        score={game.score}
        history={game.history}
        winner={matchWinner(game)}
        name={name}
        me={me}
        pawnOf={(seat) => pawns[seat]}
        pawnPicker={pawnPicker}
        mode={game.mode}
        onMode={isHost ? (mode) => transact((st) => setMode(st, mode)) : undefined}
        hostName={!isPublic && me && !isHost ? hostName : undefined}
        onAgain={isHost ? onStart : undefined}
        voting={
          isPublic && me && other
            ? {
                mine: game.votes?.[me],
                theirs: game.votes?.[other],
                otherName: name(other),
                onVote: (choice) => transact((st) => vote(st, me, choice, (mode) => generateBoard(mode, Math.random, st.start), randomSeat(), serverNow())),
                onLeave: leave,
              }
            : undefined
        }
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
        pawn={pawns[seat]}
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
            pawnOf={(seat) => pawns[seat]}
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
        <Header round={game && game.phase !== "lobby" ? game.round : undefined} score={score} rules={<RulesButton me={me} pawns={pawns} />} />
        {/* The board takes the page's width; the other screens stay a readable column. */}
        {midMatch && bothJoined ? screen : <div className="mx-auto w-full max-w-[560px]">{screen}</div>}
        {footer ? (
          <Footer
            room={room}
            roomName={roomName}
            onReset={session.roomClosed || problem || !isHost ? undefined : onReset}
            onNewRoom={isPublic ? undefined : newRoom}
            onLeave={problem || !game ? undefined : leave}
          />
        ) : null}
        {askingLeave ? <AskDialog question={LEAVE_CONFIRM} onCancel={() => setAskingLeave(false)} onConfirm={leaveNow} /> : null}
      </main>
    </div>
  );
}
