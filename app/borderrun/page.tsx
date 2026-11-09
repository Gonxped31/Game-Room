"use client";

import { useEffect, useState } from "react";
import InAppBrowserBanner from "@/components/InAppBrowserBanner";
import { GuessInput, GuessList, PathLine, PlayMap, RouteHeader } from "@/components/borderrun/Controls";
import { RaceShell, Settings } from "@/components/borderrun/race/Screens";
import { RACE_TEXT } from "@/components/borderrun/text";
import { FinalView, formatTime, InviteCard, JoinScreen, Lobby, Message, modeName, raceStartProblem, ResultsView, RoundView, type BoardRow, type MyStatus, type ResultRow } from "@/components/race/Screens";
import { useRace } from "@/components/race/useRace";
import { BORDERRUN_MATCH } from "@/lib/games/matchGames";
import { PENALTY_MS } from "@/lib/games/borderrun/constants";
import { shortestPath } from "@/lib/games/borderrun/route";
import { status } from "@/lib/games/borderrun/play";
import { newRace, normalizeRun, PLAYERS, playOf, race, scoreOf, setMap, type Run } from "@/lib/games/borderrun/race";
import { useLang } from "@/lib/i18n/useLang";
import { secondsLeft } from "@/lib/session/shared/deadline";
import { roomProblemMessage } from "@/lib/session/shared/roomActions";
import { startingSeats } from "@/lib/session/usePublicRoom";
import { useReportFinished } from "@/lib/tracking/useReportFinished";

const { backToLobby, decided, ranking, setMode, setRounds, standings, total } = race;

/**
 * Detour with others (lib/games/borderrun/race.ts, on the shared race
 * layer: lib/games/race/, components/race/): Challenge or Survival, in a
 * private room or a matchmade one. The room's state is
 * `games/{room}/borderrun`; each player's guesses go to `borderrunRuns/{seat}`.
 * Words and country names follow the page's language (/fr/borderrun is French).
 */
export default function BorderRunRoomPage() {
  const r = useRace({ gameSlug: "borderrun", race, newState: newRace, normalizeRun, match: BORDERRUN_MATCH });
  const { session, game, runs, myRun, now, publicRoom, leave, nameOf } = r;
  const { room, me, transact, joinedSeats, online } = session;
  const [selected, setSelected] = useState<string | null>(null);
  const lang = useLang();
  const t = RACE_TEXT[lang];

  useEffect(() => {
    document.title = "Detour";
  }, []);

  // The race's final standings are a finished game, reported by every player in it. The last round's start
  // (server ms) is the same on every device, and a rematch's first round has a new one.
  const finished = game?.phase === "over" && me != null && game.players.includes(me);
  useReportFinished(
    finished && game
      ? { slug: "borderrun", mode: game.mode, id: String(Math.round(game.startsAt)), room, players: game.players.length, lang, matchmade: publicRoom.isPublic }
      : null,
  );

  // My guesses go to my own run, timed on the server's clock from the round's start.
  const currentRun = (): Run => (game && myRun?.at === game.startsAt ? myRun : { at: game?.startsAt ?? 0, guesses: [], gaveUp: false });
  const onGuess = (code: string) => {
    if (!game) return;
    const run = currentRun();
    r.writeRun({ ...run, guesses: [...run.guesses, { code, t: r.roundTime(run.guesses.at(-1)?.t ?? 0) }] });
  };
  const onGiveUp = () => r.writeRun({ ...currentRun(), gaveUp: true });

  let screen;
  const problem = roomProblemMessage(session, lang);
  if (problem) {
    screen = <Message text={problem} home />;
  } else if (!game) {
    screen = <Message text={t.connecting} />;
  } else if (!me && !r.watching) {
    const free = r.freeSeat;
    screen = (
      <JoinScreen
        mode={game.mode}
        defaultName={r.defaultName}
        full={free === undefined}
        underway={game.phase !== "lobby"}
        onJoin={(name) => {
          if (free) void session.pickIdentity(free, name);
        }}
        onWatch={r.watch}
        onLeave={leave}
      />
    );
  } else if (game.phase === "lobby") {
    const players = joinedSeats.map((seat) => ({ seat, name: nameOf(seat), online: Boolean(online[seat]), host: !publicRoom.isPublic && seat === session.hostSeat, me: seat === me }));
    const canEdit = session.isHost && !publicRoom.isPublic;
    screen = (
      <Lobby
        mode={game.mode}
        settings={
          <Settings
            mode={game.mode}
            map={game.map}
            rounds={game.rounds}
            canEdit={canEdit}
            onMode={(mode) => transact((s) => setMode(s, mode))}
            onMap={(map) => transact((s) => setMap(s, map))}
            onRounds={(n) => transact((s) => setRounds(s, n))}
          />
        }
        rules={t.lobbyRules}
        players={players}
        isPublic={publicRoom.isPublic}
        canEdit={canEdit}
        hostName={session.hostSeat ? nameOf(session.hostSeat) : null}
        problem={raceStartProblem(game.mode, joinedSeats.length, lang)}
        autoStatus={
          publicRoom.autoStartAt != null && r.lobbyNow != null
            ? t.startingIn(Math.max(1, secondsLeft(publicRoom.autoStartAt, r.lobbyNow)))
            : r.onlineCount < PLAYERS[game.mode].min
              ? t.waiting(PLAYERS[game.mode].min)
              : t.gettingReady
        }
        invite={
          publicRoom.isPublic ? null : <InviteCard room={room} roomName={session.roomName} onRename={session.canRenameRoom ? session.setRoomName : undefined} nameError={session.roomNameError} />
        }
        onStart={r.startGame}
        onLeave={leave}
      />
    );
  } else if (game.phase === "round" && game.route) {
    const route = game.route;
    const clock = now ?? game.startsAt;
    const playing = me != null && game.alive.includes(me);
    const play = playOf(route, playing ? myRun : undefined, game.startsAt);
    const mine = playing ? scoreOf(route, myRun, game.startsAt) : null;
    const myStatus: MyStatus = !me || !game.players.includes(me)
      ? { kind: "watching" }
      : !playing
        ? { kind: "out" }
        : mine?.done
          ? { kind: "done", text: t.doneIn(formatTime(total(mine)), mine.extra) }
          : myRun?.at === game.startsAt && myRun.gaveUp
            ? { kind: "gaveUp" }
            : { kind: "playing" };
    const board: (BoardRow & { finish: number | null; found: number })[] = game.alive.map((seat) => {
      const score = scoreOf(route, runs[seat], game.startsAt);
      const run = runs[seat];
      const guesses = run?.at === game.startsAt ? run.guesses.length : 0;
      const gaveUp = run?.at === game.startsAt && run.gaveUp && !score.done;
      const finish = score.done ? total(score) : null;
      return {
        seat,
        name: nameOf(seat),
        progress: finish !== null ? 1 : score.found / Math.max(1, route.par),
        status: finish !== null ? `✓ ${formatTime(finish)}` : gaveUp ? t.gaveUp : t.progress(score.found, route.par, guesses),
        done: finish !== null,
        online: Boolean(online[seat]),
        me: seat === me,
        finish,
        found: score.found,
      };
    });
    board.sort((a, b) => (a.finish ?? Infinity) - (b.finish ?? Infinity) || b.found - a.found);
    const roundLabel = game.mode === "challenge" ? t.routeOf(game.round + 1, game.rounds) : t.routeLeft(game.round + 1, game.alive.length);
    const countdown = clock < game.startsAt ? Math.max(1, secondsLeft(game.startsAt, clock)) : null;
    screen = (
      <RoundView
        roundLabel={roundLabel}
        unit={t.unit}
        countdown={countdown}
        timeLeft={Math.max(0, game.endsAt - Math.max(clock, game.startsAt))}
        me={myStatus}
        board={board}
        header={<RouteHeader play={play} lang={lang} />}
        stage={<PlayMap play={play} lang={lang} />}
        afterStage={<GuessInput key={roundLabel} play={play} lang={lang} onGuess={onGuess} disabled={countdown !== null} />}
        below={myStatus.kind === "playing" || myStatus.kind === "done" || myStatus.kind === "gaveUp" ? <GuessList play={play} lang={lang} /> : null}
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
        result: score.done ? formatTime(total(score)) : t.didntFinish,
        detail: score.done ? (score.extra ? t.pastPar(score.extra, (score.extra * PENALTY_MS) / 1000) : t.onPar) : t.found(score.found, game.route!.par),
        out: result.out.includes(seat),
        me: seat === me,
      };
    });
    const pick = selected && seats.includes(selected) ? selected : me && seats.includes(me) ? me : seats[0];
    const play = playOf(game.route, runs[pick], game.startsAt);
    const path = status(play).path ?? shortestPath(game.route) ?? [];
    const shown = rows.find((row) => row.seat === pick);
    const left = Math.max(1, secondsLeft(game.nextAt, now ?? game.nextAt));
    screen = (
      <ResultsView
        title={game.mode === "challenge" ? t.routeOf(game.round + 1, game.rounds) : t.route(game.round + 1)}
        next={decided(game) ? t.finalIn(left) : t.nextIn(left)}
        rows={rows}
        selected={pick}
        onSelect={setSelected}
        caption={shown ? t.caption(shown.me ? null : shown.name, play.guesses.length > 0 && path.length > 0) : ""}
        onLeave={!me || !game.alive.includes(me) ? leave : undefined}
      >
        <PlayMap play={play} lang={lang} reveal={path} />
        <PathLine path={path} lang={lang} />
      </ResultsView>
    );
  } else if (game.phase === "over") {
    const table = standings(game);
    const winner = table[0];
    const rows = table.map((row) => ({
      seat: row.seat,
      name: nameOf(row.seat),
      value: game.mode === "challenge" ? formatTime(row.value) : row.outIn === null ? t.winner : t.outOn(row.outIn + 1),
      detail:
        game.mode === "challenge"
          ? t.finished(game.results.filter((result) => result.scores[row.seat]?.done).length, game.results.length)
          : t.played(row.outIn === null ? game.results.length : row.outIn + 1),
      me: row.seat === me,
    }));
    screen = (
      <FinalView
        headline={winner ? (winner.seat === me ? t.youWin : t.wins(nameOf(winner.seat))) : t.gameOver}
        rows={rows}
        canPlayAgain={me != null}
        againProblem={raceStartProblem(game.mode, startingSeats(session).length, lang)}
        onPlayAgain={r.startGame}
        onSettings={session.isHost && !publicRoom.isPublic ? () => transact(backToLobby) : undefined}
        onLeave={leave}
      />
    );
  } else {
    screen = <Message text={t.loadingMode(modeName(game.mode, lang))} />;
  }

  return (
    <>
      <InAppBrowserBanner />
      <RaceShell>{screen}</RaceShell>
    </>
  );
}
