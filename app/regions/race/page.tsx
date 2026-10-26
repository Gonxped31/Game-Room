"use client";

import { useMemo, useRef, useState } from "react";
import InAppBrowserBanner from "@/components/InAppBrowserBanner";
import { FinalView, formatTime, InviteCard, JoinScreen, Lobby, Message, MODE_NAME, plural, ResultsView, RoundView, type BoardRow, type MyStatus, type ResultRow } from "@/components/race/Screens";
import { useRace } from "@/components/race/useRace";
import Board from "@/components/regions/Board";
import { AutoMarkButton, useAutoMark } from "@/components/regions/Controls";
import { RaceShell, Settings } from "@/components/regions/race/Screens";
import { REGIONS_MATCH } from "@/lib/games/matchGames";
import { PLAYERS, startProblem } from "@/lib/games/race/race";
import { EMPTY, PIECE, status, type Mark } from "@/lib/games/regions/play";
import { MAX_MOVES, newRace, normalizeRun, playOf, puzzleOf, race, ROUND_MS, scoreOf, setPieces, type Run } from "@/lib/games/regions/race";
import { GLYPH, VARIANT_NAME, VARIANT_RULE } from "@/lib/games/regions/theme";
import { secondsLeft } from "@/lib/session/shared/deadline";
import { roomProblemMessage } from "@/lib/session/shared/roomActions";
import { startingSeats } from "@/lib/session/usePublicRoom";
import { updateRoot } from "@/lib/store";

const { backToLobby, decided, ranking, setMode, setRounds, standings, total } = race;
const AUTO_MARK_KEY = "checkmate-grid:auto-mark:race";
const NO_MOVES: never[] = [];

/**
 * Checkmate Grid with others (lib/games/regions/race.ts, on the shared race
 * layer: lib/games/race/, components/race/): Challenge or Survival, in a
 * private room or a matchmade one, at `/regions/race#room` (the solo game
 * keeps `/regions`). The room's state is `games/{room}/regions`; each
 * player's moves go to `regionsRuns/{seat}`, one database write per move.
 */
export default function CheckmateGridRacePage() {
  const r = useRace({ gameSlug: "regions", race, newState: newRace, normalizeRun, match: REGIONS_MATCH });
  const { session, game, runs, myRun, now, publicRoom, leave, nameOf } = r;
  const { room, me, transact, joinedSeats, online } = session;
  const [selected, setSelected] = useState<string | null>(null);

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
            pieces={game.pieces}
            rounds={game.rounds}
            canEdit={canEdit}
            onMode={(mode) => transact((s) => setMode(s, mode))}
            onPieces={(choice) => transact((s) => setPieces(s, choice))}
            onRounds={(n) => transact((s) => setRounds(s, n))}
          />
        }
        rules="Each puzzle is the same for everyone, and the grids grow as you go. The time limit is 3 minutes."
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
  } else if (game.phase === "round" && built && myPlay) {
    const { puzzle } = built;
    const t = now ?? game.startsAt;
    const countdown = t < game.startsAt ? Math.max(1, secondsLeft(game.startsAt, t)) : null;
    const mine = playing ? scoreOf(puzzle, run, at) : null;
    const myStatus: MyStatus = !me || !game.players.includes(me)
      ? { kind: "watching" }
      : !playing
        ? { kind: "out" }
        : mine?.done
          ? { kind: "done", text: `Solved in ${formatTime(total(mine))}.` }
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
        status: finish !== null ? `✓ ${formatTime(finish)}` : gaveUp ? "Gave up" : `${score.found} of ${puzzle.size} pieces`,
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
        roundLabel={game.mode === "challenge" ? `Puzzle ${game.round + 1} of ${game.rounds}` : `Puzzle ${game.round + 1}, ${game.alive.length} left`}
        unit="puzzle"
        countdown={countdown}
        timeLeft={Math.max(0, game.endsAt - Math.max(t, game.startsAt))}
        me={myStatus}
        board={board}
        header={
          <>
            <p className="cg-current-label">
              <span aria-hidden="true" className="cg-seg-icon">
                {puzzle.variant === "mix" ? "✦" : GLYPH[puzzle.variant]}
              </span>{" "}
              {VARIANT_NAME[puzzle.variant]} · {puzzle.size}×{puzzle.size}
            </p>
            <div className="cg-race-tools">
              <p className="cg-rule">{VARIANT_RULE[puzzle.variant]}</p>
              {myStatus.kind === "playing" ? (
                <span className="cg-actions">
                  <button type="button" className="cg-button" disabled={!live || undoable.at !== at || undoable.n === 0} onClick={undo}>
                    Undo
                  </button>
                  <button type="button" className="cg-button" disabled={!live || !myPlay.marks.some((mark) => mark !== EMPTY)} onClick={clear}>
                    Clear
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
        result: score.done ? formatTime(total(score)) : "Didn't solve it",
        detail: score.done ? "Solved" : `${score.found} of ${puzzle.size} pieces`,
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
        title={game.mode === "challenge" ? `Puzzle ${game.round + 1} of ${game.rounds}` : `Puzzle ${game.round + 1}`}
        next={decided(game) ? `Final standings in ${left} s` : `Next puzzle in ${left} s`}
        rows={rows}
        selected={shownSeat}
        onSelect={setSelected}
        caption={shown ? `${shown.me ? "Your" : `${shown.name}'s`} board${solved ? ":" : ", and the answer, faint:"}` : ""}
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
      value: game.mode === "challenge" ? formatTime(row.value) : row.outIn === null ? "Winner" : `Out on puzzle ${row.outIn + 1}`,
      detail:
        game.mode === "challenge"
          ? `${game.results.filter((result) => result.scores[row.seat]?.done).length} of ${game.results.length} puzzles solved`
          : plural(row.outIn === null ? game.results.length : row.outIn + 1, "puzzle") + " played",
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
    screen = <Message text={game.phase === "round" || game.phase === "results" ? "Shuffling the puzzle…" : `Loading the ${MODE_NAME[game.mode]}…`} />;
  }

  return (
    <>
      <InAppBrowserBanner />
      <RaceShell>{screen}</RaceShell>
    </>
  );
}
