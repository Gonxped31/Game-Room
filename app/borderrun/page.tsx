"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import InAppBrowserBanner from "@/components/InAppBrowserBanner";
import { MODE_NAME, FinalView, InviteCard, JoinScreen, Lobby, Message, RaceShell, ResultsView, RoundView, type BoardRow, type MyStatus, type ResultRow } from "@/components/borderrun/race/Screens";
import { formatTime } from "@/components/borderrun/Controls";
import { LANG_KEY, loadLang, writeJson } from "@/components/borderrun/storage";
import { BORDERRUN_MATCH } from "@/lib/games/matchGames";
import { PENALTY_MS } from "@/lib/games/borderrun/constants";
import { shortestPath } from "@/lib/games/borderrun/route";
import { status } from "@/lib/games/borderrun/play";
import {
  backToLobby,
  decided,
  endRound,
  MODES,
  newRace,
  next,
  normalize,
  normalizeRun,
  PLAYERS,
  playOf,
  ranking,
  roundOver,
  scoreOf,
  setMap,
  setMode,
  setRounds,
  standings,
  start,
  startProblem,
  total,
  type Mode,
  type RaceState,
  type Run,
  type Runs,
  ROOM_SEATS,
} from "@/lib/games/borderrun/race";
import type { Lang } from "@/lib/games/shared/language";
import { secondsLeft } from "@/lib/session/shared/deadline";
import { leaveToHub, roomProblemMessage } from "@/lib/session/shared/roomActions";
import { useDeadline, useServerClock, useTicker } from "@/lib/session/shared/serverClock";
import { startingSeats, usePublicRoom } from "@/lib/session/usePublicRoom";
import { useSession } from "@/lib/session/useSession";
import { createPathStore } from "@/lib/store";

const isMode = (value: unknown): value is Mode => MODES.includes(value as Mode);
/** The mode the hub's Start picked (`?mode=`), for a room created on this visit. */
const modeFromUrl = (): Mode => {
  const mode = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("mode");
  return isMode(mode) ? mode : "challenge";
};
const newSeed = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()));
/** The name this browser last played under online (the hub's Matchmaking remembers it). */
const savedName = () => {
  try {
    return window.localStorage.getItem("gameRoom.onlineName") ?? "";
  } catch {
    return "";
  }
};
const noSubscribe = () => () => {};
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Border Run with others (lib/games/borderrun/race.ts): Challenge or
 * Survival, in a private room or a matchmade one. The room's state is
 * `games/{room}/borderrun`; each player's guesses go to
 * `borderrunRuns/{seat}`. Every timed step (a round's end, the next round)
 * is applied by whichever seated device sees it due.
 */
export default function BorderRunRoomPage() {
  const createInitialState = useCallback(() => newRace(modeFromUrl()), []);
  const session = useSession<RaceState>({ gameSlug: "borderrun", maxPlayers: ROOM_SEATS, minPlayers: PLAYERS.challenge.min, createInitialState });
  const { room, me, names, transact, joinedSeats, online } = session;
  const game = useMemo(() => (session.game ? normalize(session.game) : null), [session.game]);
  const serverNow = useServerClock();
  const [watching, setWatching] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const defaultName = useSyncExternalStore(noSubscribe, savedName, () => "");

  // The names' language, as on the solo page; read once mounted.
  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => {
    const id = setTimeout(() => setLang(loadLang()), 0);
    return () => clearTimeout(id);
  }, []);

  // Once the room exists, the shared link is just /borderrun#code.
  useEffect(() => {
    if (game && window.location.search) window.history.replaceState(window.history.state, "", window.location.pathname + window.location.hash);
  }, [game]);

  useEffect(() => {
    document.title = "Border Run";
  }, []);

  // Everyone's guesses this round.
  const loaded = game != null;
  const runsStore = useMemo(() => (loaded ? createPathStore<Runs>(`games/${room}/borderrunRuns`) : null), [loaded, room]);
  const subscribeRuns = useCallback((cb: () => void) => runsStore?.subscribe(cb) ?? (() => {}), [runsStore]);
  const rawRuns = useSyncExternalStore(subscribeRuns, () => runsStore?.getSnapshot() ?? null, () => null);
  const runs = useMemo(() => {
    const all: Runs = {};
    for (const [seat, run] of Object.entries(rawRuns ?? {})) all[seat] = normalizeRun(run);
    return all;
  }, [rawRuns]);

  const phase = game?.phase;
  const now = useTicker(phase === "round" || phase === "results", serverNow, 250);
  const present = useMemo(() => (game ? game.alive.filter((seat) => online[seat]) : []), [game, online]);
  const presentKey = present.join(",");
  const seated = me != null;

  // A round ends at its time limit, or once everyone still in (and here) is done.
  const finishRound = useCallback(() => {
    transact((s) => endRound(s, runs, serverNow(), present));
  }, [transact, runs, serverNow, present]);
  useDeadline(seated && phase === "round" ? game?.endsAt : undefined, serverNow, finishRound);
  useEffect(() => {
    if (seated && game && phase === "round" && now != null && roundOver(game, runs, now, present)) finishRound();
    // presentKey: a player leaving can end the round.
  }, [seated, game, phase, runs, now, present, presentKey, finishRound]);
  useDeadline(seated && phase === "results" ? game?.nextAt : undefined, serverNow, () => transact((s) => next(s, newSeed(), serverNow())));

  // The game starts with whoever is seated (in a public room, whoever is online).
  const startGame = useCallback(() => transact((s) => start(s, { seated: startingSeats(session), seed: newSeed(), now: serverNow() })), [transact, session, serverNow]);

  const publicMode = isMode(session.publicLang) ? session.publicLang : null;
  const onlineCount = session.onlineSeats.length;
  const publicRoom = usePublicRoom({
    session,
    game: BORDERRUN_MATCH[publicMode ?? "challenge"],
    inLobby: phase === "lobby",
    ready: publicMode != null && onlineCount >= PLAYERS[publicMode].min,
    onStart: startGame,
    serverNow,
    leaveOnBack: phase === "lobby" || phase === "over",
  });
  const lobbyNow = useTicker(publicRoom.autoStartAt != null, serverNow, 250);
  const leave = publicRoom.isPublic ? publicRoom.leave : () => void leaveToHub(session.leave);

  // My guesses go to my own run, timed on the server's clock from the round's start.
  const myRun = me ? runs[me] : undefined;
  const writeRun = useCallback((run: Run) => (me ? createPathStore<Run>(`games/${room}/borderrunRuns/${me}`).set(run) : undefined), [me, room]);
  const currentRun = (): Run => (game && myRun?.at === game.startsAt ? myRun : { at: game?.startsAt ?? 0, guesses: [], gaveUp: false });
  const onGuess = (code: string) => {
    if (!game) return;
    const run = currentRun();
    const t = Math.max(Math.round(serverNow() - game.startsAt), run.guesses.at(-1)?.t ?? 0, 0);
    void writeRun({ ...run, guesses: [...run.guesses, { code, t }] });
  };
  const onGiveUp = () => void writeRun({ ...currentRun(), gaveUp: true });

  const nameOf = (seat: string) => names[seat] ?? `Player ${seat.slice(1)}`;
  const capacity = game ? PLAYERS[game.mode].max : ROOM_SEATS;

  let screen;
  const problem = roomProblemMessage(session);
  if (problem) {
    screen = <Message text={problem} home />;
  } else if (!game) {
    screen = <Message text="Connecting to the room…" />;
  } else if (!me && !watching) {
    const free = session.seats.slice(0, capacity).find((seat) => session.unclaimedSeats.includes(seat) || session.canTakeOver[seat]);
    screen = (
      <JoinScreen
        mode={game.mode}
        defaultName={defaultName}
        full={free === undefined}
        underway={game.phase !== "lobby"}
        onJoin={(name) => {
          if (free) void session.pickIdentity(free, name);
        }}
        onWatch={() => setWatching(true)}
        onLeave={leave}
      />
    );
  } else if (game.phase === "lobby") {
    const players = joinedSeats.map((seat) => ({ seat, name: nameOf(seat), online: Boolean(online[seat]), host: !publicRoom.isPublic && seat === session.hostSeat, me: seat === me }));
    const canEdit = session.isHost && !publicRoom.isPublic;
    screen = (
      <Lobby
        mode={game.mode}
        map={game.map}
        rounds={game.rounds}
        players={players}
        isPublic={publicRoom.isPublic}
        canEdit={canEdit}
        hostName={session.hostSeat ? nameOf(session.hostSeat) : null}
        problem={startProblem(game.mode, joinedSeats.length)}
        autoStatus={
          publicRoom.autoStartAt != null && lobbyNow != null
            ? `Starting in ${Math.max(1, secondsLeft(publicRoom.autoStartAt, lobbyNow))} s`
            : onlineCount < PLAYERS[game.mode].min
              ? `Waiting for more players… (${PLAYERS[game.mode].min} needed)`
              : "Getting ready…"
        }
        invite={
          publicRoom.isPublic ? null : <InviteCard room={room} roomName={session.roomName} onRename={session.canRenameRoom ? session.setRoomName : undefined} nameError={session.roomNameError} />
        }
        onMode={(mode) => transact((s) => setMode(s, mode))}
        onMap={(map) => transact((s) => setMap(s, map))}
        onRounds={(n) => transact((s) => setRounds(s, n))}
        onStart={startGame}
        onLeave={leave}
      />
    );
  } else if (game.phase === "round" && game.route) {
    const t = now ?? game.startsAt;
    const playing = me != null && game.alive.includes(me);
    const play = playing ? playOf(game.route, myRun, game.startsAt) : playOf(game.route, undefined, game.startsAt);
    const mine = playing ? scoreOf(game.route, myRun, game.startsAt) : null;
    const myStatus: MyStatus = !me || !game.players.includes(me)
      ? { kind: "watching" }
      : !playing
        ? { kind: "out" }
        : mine?.done
          ? { kind: "done", finish: total(mine), extra: mine.extra }
          : myRun?.at === game.startsAt && myRun.gaveUp
            ? { kind: "gaveUp" }
            : { kind: "playing" };
    const board: BoardRow[] = game.alive.map((seat) => {
      const score = scoreOf(game.route!, runs[seat], game.startsAt);
      const run = runs[seat];
      return {
        seat,
        name: nameOf(seat),
        found: score.found,
        par: game.route!.par,
        guesses: run?.at === game.startsAt ? run.guesses.length : 0,
        finish: score.done ? total(score) : null,
        gaveUp: run?.at === game.startsAt && run.gaveUp && !score.done,
        online: Boolean(online[seat]),
        me: seat === me,
      };
    });
    board.sort((a, b) => (a.finish ?? Infinity) - (b.finish ?? Infinity) || b.found - a.found);
    const roundLabel = game.mode === "challenge" ? `Route ${game.round + 1} of ${game.rounds}` : `Route ${game.round + 1}, ${game.alive.length} left`;
    screen = (
      <RoundView
        roundLabel={roundLabel}
        countdown={t < game.startsAt ? Math.max(1, secondsLeft(game.startsAt, t)) : null}
        timeLeft={Math.max(0, game.endsAt - Math.max(t, game.startsAt))}
        play={play}
        lang={lang}
        me={myStatus}
        board={board}
        onGuess={onGuess}
        onGiveUp={onGiveUp}
        onLeave={myStatus.kind === "out" || myStatus.kind === "watching" ? leave : undefined}
      />
    );
  } else if (game.phase === "results" && game.route) {
    const result = game.results.at(-1)!;
    const seats = ranking(result.scores, game.players);
    const rows: ResultRow[] = seats.map((seat) => {
      const score = result.scores[seat]!;
      return {
        seat,
        name: nameOf(seat),
        result: score.done ? formatTime(total(score)) : "Didn't finish",
        detail: score.done ? (score.extra ? `${score.extra} past the par, +${(score.extra * PENALTY_MS) / 1000} s` : "On par") : `${score.found} of ${game.route!.par} found`,
        out: result.out.includes(seat),
        me: seat === me,
      };
    });
    const pick = selected && seats.includes(selected) ? selected : me && seats.includes(me) ? me : seats[0];
    const play = playOf(game.route, runs[pick], game.startsAt);
    const theirs = status(play).path;
    const t = now ?? game.nextAt;
    const left = Math.max(1, secondsLeft(game.nextAt, t));
    screen = (
      <ResultsView
        title={game.mode === "challenge" ? `Route ${game.round + 1} of ${game.rounds}` : `Route ${game.round + 1}`}
        next={decided(game) ? `Final standings in ${left} s` : `Next route in ${left} s`}
        rows={rows}
        selected={pick}
        onSelect={setSelected}
        play={play}
        path={theirs ?? shortestPath(game.route) ?? []}
        lang={lang}
        onLeave={!me || !game.alive.includes(me) ? leave : undefined}
      />
    );
  } else if (game.phase === "over") {
    const table = standings(game);
    const winner = table[0];
    const rows = table.map((row) => ({
      seat: row.seat,
      name: nameOf(row.seat),
      value: game.mode === "challenge" ? formatTime(row.value) : row.outIn === null ? "Winner" : `Out on route ${row.outIn + 1}`,
      detail:
        game.mode === "challenge"
          ? `${game.results.filter((r) => r.scores[row.seat]?.done).length} of ${game.results.length} routes finished`
          : plural(row.outIn === null ? game.results.length : row.outIn + 1, "route") + " played",
      me: row.seat === me,
    }));
    const againSeats = startingSeats(session);
    screen = (
      <FinalView
        headline={winner ? `${winner.seat === me ? "You win" : `${nameOf(winner.seat)} wins`}!` : "Game over"}
        rows={rows}
        canPlayAgain={me != null}
        againProblem={startProblem(game.mode, againSeats.length)}
        onPlayAgain={startGame}
        onSettings={session.isHost && !publicRoom.isPublic ? () => transact(backToLobby) : undefined}
        onLeave={leave}
      />
    );
  } else {
    screen = <Message text={`Loading the ${MODE_NAME[game.mode]}…`} />;
  }

  return (
    <>
      <InAppBrowserBanner />
      <RaceShell
        lang={lang}
        onLang={(next) => {
          setLang(next);
          writeJson(LANG_KEY, next);
        }}
      >
        {screen}
      </RaceShell>
    </>
  );
}
