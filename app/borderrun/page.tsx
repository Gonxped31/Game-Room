"use client";

import { useEffect, useState } from "react";
import InAppBrowserBanner from "@/components/InAppBrowserBanner";
import { GuessInput, GuessList, PathLine, PlayMap, RouteHeader } from "@/components/borderrun/Controls";
import { RaceShell, Settings } from "@/components/borderrun/race/Screens";
import { LANG_KEY, loadLang, writeJson } from "@/components/borderrun/storage";
import { FinalView, formatTime, InviteCard, JoinScreen, Lobby, Message, MODE_NAME, plural, ResultsView, RoundView, type BoardRow, type MyStatus, type ResultRow } from "@/components/race/Screens";
import { useRace } from "@/components/race/useRace";
import { BORDERRUN_MATCH } from "@/lib/games/matchGames";
import { PENALTY_MS } from "@/lib/games/borderrun/constants";
import { shortestPath } from "@/lib/games/borderrun/route";
import { status } from "@/lib/games/borderrun/play";
import { newRace, normalizeRun, PLAYERS, playOf, race, scoreOf, setMap, startProblem, type Run } from "@/lib/games/borderrun/race";
import type { Lang } from "@/lib/games/shared/language";
import { secondsLeft } from "@/lib/session/shared/deadline";
import { roomProblemMessage } from "@/lib/session/shared/roomActions";
import { startingSeats } from "@/lib/session/usePublicRoom";

const { backToLobby, decided, ranking, setMode, setRounds, standings, total } = race;

/**
 * Border Run with others (lib/games/borderrun/race.ts, on the shared race
 * layer: lib/games/race/, components/race/): Challenge or Survival, in a
 * private room or a matchmade one. The room's state is
 * `games/{room}/borderrun`; each player's guesses go to `borderrunRuns/{seat}`.
 */
export default function BorderRunRoomPage() {
  const r = useRace({ gameSlug: "borderrun", race, newState: newRace, normalizeRun, match: BORDERRUN_MATCH });
  const { session, game, runs, myRun, now, publicRoom, leave, nameOf } = r;
  const { room, me, transact, joinedSeats, online } = session;
  const [selected, setSelected] = useState<string | null>(null);

  // The names' language, as on the solo page; read once mounted.
  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => {
    const id = setTimeout(() => setLang(loadLang()), 0);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    document.title = "Border Run";
  }, []);

  // My guesses go to my own run, timed on the server's clock from the round's start.
  const currentRun = (): Run => (game && myRun?.at === game.startsAt ? myRun : { at: game?.startsAt ?? 0, guesses: [], gaveUp: false });
  const onGuess = (code: string) => {
    if (!game) return;
    const run = currentRun();
    r.writeRun({ ...run, guesses: [...run.guesses, { code, t: r.roundTime(run.guesses.at(-1)?.t ?? 0) }] });
  };
  const onGiveUp = () => r.writeRun({ ...currentRun(), gaveUp: true });

  let screen;
  const problem = roomProblemMessage(session);
  if (problem) {
    screen = <Message text={problem} home />;
  } else if (!game) {
    screen = <Message text="Connecting to the room…" />;
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
        rules="Each route is the same for everyone. The time limit is 3 minutes; each guess past the par adds 15 s."
        players={players}
        isPublic={publicRoom.isPublic}
        canEdit={canEdit}
        hostName={session.hostSeat ? nameOf(session.hostSeat) : null}
        problem={startProblem(game.mode, joinedSeats.length)}
        autoStatus={
          publicRoom.autoStartAt != null && r.lobbyNow != null
            ? `Starting in ${Math.max(1, secondsLeft(publicRoom.autoStartAt, r.lobbyNow))} s`
            : r.onlineCount < PLAYERS[game.mode].min
              ? `Waiting for more players… (${PLAYERS[game.mode].min} needed)`
              : "Getting ready…"
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
    const t = now ?? game.startsAt;
    const playing = me != null && game.alive.includes(me);
    const play = playOf(route, playing ? myRun : undefined, game.startsAt);
    const mine = playing ? scoreOf(route, myRun, game.startsAt) : null;
    const myStatus: MyStatus = !me || !game.players.includes(me)
      ? { kind: "watching" }
      : !playing
        ? { kind: "out" }
        : mine?.done
          ? { kind: "done", text: `Done in ${formatTime(total(mine))}${mine.extra ? ` (${mine.extra} past the par)` : ""}.` }
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
        status: finish !== null ? `✓ ${formatTime(finish)}` : gaveUp ? "Gave up" : `${score.found} of ${route.par} found, ${guesses} ${guesses === 1 ? "guess" : "guesses"}`,
        done: finish !== null,
        online: Boolean(online[seat]),
        me: seat === me,
        finish,
        found: score.found,
      };
    });
    board.sort((a, b) => (a.finish ?? Infinity) - (b.finish ?? Infinity) || b.found - a.found);
    const roundLabel = game.mode === "challenge" ? `Route ${game.round + 1} of ${game.rounds}` : `Route ${game.round + 1}, ${game.alive.length} left`;
    const countdown = t < game.startsAt ? Math.max(1, secondsLeft(game.startsAt, t)) : null;
    screen = (
      <RoundView
        roundLabel={roundLabel}
        unit="route"
        countdown={countdown}
        timeLeft={Math.max(0, game.endsAt - Math.max(t, game.startsAt))}
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
        result: score.done ? formatTime(total(score)) : "Didn't finish",
        detail: score.done ? (score.extra ? `${score.extra} past the par, +${(score.extra * PENALTY_MS) / 1000} s` : "On par") : `${score.found} of ${game.route!.par} found`,
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
        title={game.mode === "challenge" ? `Route ${game.round + 1} of ${game.rounds}` : `Route ${game.round + 1}`}
        next={decided(game) ? `Final standings in ${left} s` : `Next route in ${left} s`}
        rows={rows}
        selected={pick}
        onSelect={setSelected}
        caption={shown ? `${shown.me ? "Your" : `${shown.name}'s`} guesses, and ${play.guesses.length && path.length ? "the route" : "a route"}:` : ""}
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
      value: game.mode === "challenge" ? formatTime(row.value) : row.outIn === null ? "Winner" : `Out on route ${row.outIn + 1}`,
      detail:
        game.mode === "challenge"
          ? `${game.results.filter((result) => result.scores[row.seat]?.done).length} of ${game.results.length} routes finished`
          : plural(row.outIn === null ? game.results.length : row.outIn + 1, "route") + " played",
      me: row.seat === me,
    }));
    screen = (
      <FinalView
        headline={winner ? `${winner.seat === me ? "You win" : `${nameOf(winner.seat)} wins`}!` : "Game over"}
        rows={rows}
        canPlayAgain={me != null}
        againProblem={startProblem(game.mode, startingSeats(session).length)}
        onPlayAgain={r.startGame}
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
