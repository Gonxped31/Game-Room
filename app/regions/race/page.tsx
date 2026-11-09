"use client";

import { useMemo, useRef, useState } from "react";
import InAppBrowserBanner from "@/components/InAppBrowserBanner";
import { FinalView, formatTime, InviteCard, JoinScreen, Lobby, Message, modeName, raceStartProblem, ResultsView, RoundView, type BoardRow, type MyStatus, type ResultRow } from "@/components/race/Screens";
import { useRace } from "@/components/race/useRace";
import Board from "@/components/regions/Board";
import { AutoMarkButton, useAutoMark } from "@/components/regions/Controls";
import { RaceShell, Settings } from "@/components/regions/race/Screens";
import { RACE_TEXT } from "@/components/regions/text";
import { REGIONS_MATCH } from "@/lib/games/matchGames";
import { PLAYERS } from "@/lib/games/race/race";
import { EMPTY, PIECE, status, type Mark } from "@/lib/games/regions/play";
import { MAX_MOVES, newRace, normalizeRun, playOf, puzzleOf, race, ROUND_MS, scoreOf, setPieces, type Run } from "@/lib/games/regions/race";
import { GLYPH, VARIANT_NAME, VARIANT_RULE } from "@/lib/games/regions/theme";
import { useLang } from "@/lib/i18n/useLang";
import { secondsLeft } from "@/lib/session/shared/deadline";
import { roomProblemMessage } from "@/lib/session/shared/roomActions";
import { startingSeats } from "@/lib/session/usePublicRoom";
import { updateRoot } from "@/lib/store";
import { useReportFinished } from "@/lib/tracking/useReportFinished";

const { backToLobby, decided, ranking, setMode, setRounds, standings, total } = race;
const AUTO_MARK_KEY = "checkmate-grid:auto-mark:race";
const NO_MOVES: never[] = [];

/**
 * Rank & File with others (lib/games/regions/race.ts, on the shared race
 * layer: lib/games/race/, components/race/): Challenge or Survival, in a
 * private room or a matchmade one, at `/regions/race#room` (the solo game
 * keeps `/regions`). The room's state is `games/{room}/regions`; each
 * player's moves go to `regionsRuns/{seat}`, one database write per move.
 */
export default function CheckmateGridRacePage() {
  const lang = useLang();
  const t = RACE_TEXT[lang];
  const r = useRace({ gameSlug: "regions", race, newState: newRace, normalizeRun, match: REGIONS_MATCH });
  const { session, game, runs, myRun, now, publicRoom, leave, nameOf } = r;
  const { room, me, transact, joinedSeats, online } = session;
  const [selected, setSelected] = useState<string | null>(null);

  // The race's real end is its final standings ("over"). Its last round's start (server ms) is the same on every
  // device and new in every game, rematches included. Only those who raced report it.
  const over = game?.phase === "over" && me != null && game.players.includes(me);
  useReportFinished(
    over && game ? { slug: "regions", mode: game.mode, id: String(game.startsAt), room, players: game.players.length, lang, ...(publicRoom.isPublic ? { matchmade: true } : {}) } : null,
  );

  // The round's puzzle, built from its seed on this device.
  const seed = game?.seed ?? "";
  const round = game?.round ?? 0;
  const pieces = game?.pieces ?? "mixed";
  const built = useMemo(() => (seed ? puzzleOf({ seed, round, pieces }) : null), [seed, round, pieces]);

  // My moves this round: kept here as I play (a drag sets several cells before React re-renders), and
  // taken from the database after a reload. Each move is appended there on its own.
  const at = game?.phase === "round" ? game.startsAt : 0;
  const saved = myRun && myRun.at === at ? myRun : null;
  const [local, setLocal] = useState<Run | null>(null);
  const latest = useRef<Run | null>(null);
  const undos = useRef<{ at: number; list: { cell: number; from: Mark }[] }>({ at: 0, list: [] });
  // How many moves Undo can take back, for the button (the list itself is a ref: a Clear pushes many at once).
  const [undoable, setUndoable] = useState({ at: 0, n: 0 });
  const pick = (mine: Run | null): Run => (mine && mine.at === at && (!saved || saved.moves.length <= mine.moves.length) ? mine : (saved ?? { at, moves: NO_MOVES, gaveUp: false }));
  const run = pick(local);
  const playing = me != null && game != null && game.phase === "round" && game.alive.includes(me);
  const myPlay = built ? playOf(built.puzzle, playing ? run : undefined, at) : null;

  const commit = (next: Run) => {
    latest.current = next;
    setLocal(next);
  };
  const set = (cell: number, to: Mark, record = true) => {
    if (!built || !playing || !r.runPath) return;
    const base = pick(latest.current);
    const play = playOf(built.puzzle, base, at);
    if (base.gaveUp || status(play).solved || play.marks[cell] === to || base.moves.length >= MAX_MOVES) return;
    const move = { cell, to, t: r.roundTime(base.moves.at(-1)?.t ?? 0) };
    if (move.t > ROUND_MS) return;
    const next = { ...base, moves: [...base.moves, move] };
    commit(next);
    if (undos.current.at !== at) undos.current = { at, list: [] };
    if (record) undos.current.list.push({ cell, from: play.marks[cell] });
    setUndoable({ at, n: undos.current.list.length });
    if (base.moves.length === 0) r.writeRun(next);
    else void updateRoot({ [`${r.runPath}/moves/${base.moves.length}`]: move });
  };
  const undo = () => {
    const last = undos.current.at === at ? undos.current.list.pop() : undefined;
    if (last) set(last.cell, last.from, false);
    setUndoable({ at, n: undos.current.list.length });
  };
  const clear = () => {
    myPlay?.marks.forEach((mark, cell) => {
      if (mark !== EMPTY) set(cell, EMPTY);
    });
  };
  const giveUp = () => {
    const next = { ...pick(latest.current), gaveUp: true };
    commit(next);
    r.writeRun(next);
  };

  const auto = useAutoMark(AUTO_MARK_KEY, at ? `${room}:${at}` : null);

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
            pieces={game.pieces}
            rounds={game.rounds}
            canEdit={canEdit}
            onMode={(mode) => transact((s) => setMode(s, mode))}
            onPieces={(choice) => transact((s) => setPieces(s, choice))}
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
              ? t.waitingPlayers(PLAYERS[game.mode].min)
              : t.gettingReady
        }
        invite={
          publicRoom.isPublic ? null : <InviteCard room={room} roomName={session.roomName} onRename={session.canRenameRoom ? session.setRoomName : undefined} nameError={session.roomNameError} />
        }
        onStart={r.startGame}
        onLeave={leave}
      />
    );
  } else if (game.phase === "round" && built && myPlay) {
    const { puzzle } = built;
    const clock = now ?? game.startsAt;
    const countdown = clock < game.startsAt ? Math.max(1, secondsLeft(game.startsAt, clock)) : null;
    const mine = playing ? scoreOf(puzzle, run, at) : null;
    const myStatus: MyStatus = !me || !game.players.includes(me)
      ? { kind: "watching" }
      : !playing
        ? { kind: "out" }
        : mine?.done
          ? { kind: "done", text: t.solvedIn(formatTime(total(mine))) }
          : run.gaveUp
            ? { kind: "gaveUp" }
            : { kind: "playing" };
    const board: (BoardRow & { finish: number | null; found: number })[] = game.alive.map((seat) => {
      // My own row follows my moves as I make them; the others', the database.
      const score = seat === me ? scoreOf(puzzle, run, at) : scoreOf(puzzle, runs[seat], at);
      const gaveUp = !score.done && (seat === me ? run.gaveUp : runs[seat]?.at === at && runs[seat]!.gaveUp);
      const finish = score.done ? total(score) : null;
      return {
        seat,
        name: nameOf(seat),
        progress: finish !== null ? 1 : score.found / puzzle.size,
        status: finish !== null ? `✓ ${formatTime(finish)}` : gaveUp ? t.gaveUp : t.found(score.found, puzzle.size),
        done: finish !== null,
        online: Boolean(online[seat]),
        me: seat === me,
        finish,
        found: score.found,
      };
    });
    board.sort((a, b) => (a.finish ?? Infinity) - (b.finish ?? Infinity) || b.found - a.found);
    const live = myStatus.kind === "playing" && countdown === null;
    screen = (
      <RoundView
        roundLabel={game.mode === "challenge" ? t.roundOf(game.round + 1, game.rounds) : t.roundLeft(game.round + 1, game.alive.length)}
        unit={t.unit}
        countdown={countdown}
        timeLeft={Math.max(0, game.endsAt - Math.max(clock, game.startsAt))}
        me={myStatus}
        board={board}
        header={
          <>
            <p className="cg-current-label">
              <span aria-hidden="true" className="cg-seg-icon">
                {puzzle.variant === "mix" ? "✦" : GLYPH[puzzle.variant]}
              </span>{" "}
              {VARIANT_NAME[lang][puzzle.variant]} · {puzzle.size}×{puzzle.size}
            </p>
            <div className="cg-race-tools">
              <p className="cg-rule">{VARIANT_RULE[lang][puzzle.variant]}</p>
              {myStatus.kind === "playing" ? (
                <span className="cg-actions">
                  <button type="button" className="cg-button" disabled={!live || undoable.at !== at || undoable.n === 0} onClick={undo}>
                    {t.undo}
                  </button>
                  <button type="button" className="cg-button" disabled={!live || !myPlay.marks.some((mark) => mark !== EMPTY)} onClick={clear}>
                    {t.clear}
                  </button>
                </span>
              ) : null}
            </div>
          </>
        }
        stage={<Board key={at} play={myPlay} hint={live ? auto.hint : "off"} locked={!live} onSet={set} />}
        actions={<AutoMarkButton auto={auto} usable={live && myPlay.marks.includes(PIECE)} />}
        onGiveUp={giveUp}
        onLeave={myStatus.kind === "out" || myStatus.kind === "watching" ? leave : undefined}
      />
    );
  } else if (game.phase === "results" && built) {
    const { puzzle, solution } = built;
    const result = game.results.at(-1)!;
    const seats = ranking(result.scores, game.players);
    const rows: ResultRow[] = seats.map((seat) => {
      const score = result.scores[seat]!;
      return {
        seat,
        name: nameOf(seat),
        result: score.done ? formatTime(total(score)) : t.didntSolve,
        detail: score.done ? t.solved : t.found(score.found, puzzle.size),
        out: result.out.includes(seat),
        me: seat === me,
      };
    });
    const shownSeat = selected && seats.includes(selected) ? selected : me && seats.includes(me) ? me : seats[0];
    const play = playOf(puzzle, runs[shownSeat], game.startsAt);
    const solved = status(play).solved;
    const shown = rows.find((row) => row.seat === shownSeat);
    const left = Math.max(1, secondsLeft(game.nextAt, now ?? game.nextAt));
    screen = (
      <ResultsView
        title={game.mode === "challenge" ? t.roundOf(game.round + 1, game.rounds) : t.round(game.round + 1)}
        next={decided(game) ? t.finalIn(left) : t.nextIn(left)}
        rows={rows}
        selected={shownSeat}
        onSelect={setSelected}
        caption={shown ? t.caption(shown.me ? null : shown.name, solved) : ""}
        onLeave={!me || !game.alive.includes(me) ? leave : undefined}
      >
        <Board key={`${game.startsAt}-${shownSeat}`} play={play} hint="off" locked onSet={() => {}} answer={solved ? undefined : solution} />
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
          ? t.solvedOf(game.results.filter((result) => result.scores[row.seat]?.done).length, game.results.length)
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
    screen = <Message text={game.phase === "round" || game.phase === "results" ? t.shuffling : t.loadingMode(modeName(game.mode, lang))} />;
  }

  return (
    <>
      <InAppBrowserBanner />
      <RaceShell>{screen}</RaceShell>
    </>
  );
}
