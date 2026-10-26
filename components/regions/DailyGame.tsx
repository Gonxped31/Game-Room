"use client";

import { useEffect, useRef, useState } from "react";
import Countdown from "@/components/daily/Countdown";
import Leaderboard, { formatBoardTime } from "@/components/daily/Leaderboard";
import { dailyRequest, DailyRequestError, type Attempt, type BoardEntry, type DailyStatus, type StartResponse, type SubmitResponse } from "@/lib/daily/client";
import { MAX_NAME_LENGTH } from "@/lib/daily/service";
import type { Puzzle } from "@/lib/games/regions/board";
import { GAME_TITLE } from "@/lib/games/regions/constants";
import { scheduleFor } from "@/lib/games/regions/daily";
import { clearAll, newPlay, PIECE, replay, setMark, status, undo, type Mark, type Play } from "@/lib/games/regions/play";
import { VARIANT_RULE } from "@/lib/games/regions/theme";
import Board from "./Board";
import { AutoMarkButton, formatTime, Toolbar, useAutoMark } from "./Controls";
import { DAILY_MOVES_KEY, readJson, removeKey, writeJson, type SavedDailyMoves } from "./storage";

const SLUG = "regions";
/** The name typed last time, on this device (try/catch: storage can be blocked). */
const STORAGE_KEY = "checkmate-grid:daily:v1";
interface Prefs {
  name: string;
}

function loadPrefs(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as { name?: unknown } | null;
    return { name: typeof raw?.name === "string" ? raw.name : "" };
  } catch {
    return { name: "" };
  }
}
function savePrefs(prefs: Prefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Not saved: the game plays the same.
  }
}

interface Info {
  day: string;
  number: number;
  label: string;
}
interface Result {
  attempt: Attempt;
  streak: number;
  board: BoardEntry[];
  rank: number | null;
  players: number;
}

type Phase =
  | { kind: "loading" }
  | { kind: "error"; message: string; retry: boolean }
  | { kind: "ready"; info: Info; status: DailyStatus; busy: boolean }
  | { kind: "playing"; info: Info; play: Play; startedAt: number; offset: number; submitting: boolean; error?: string }
  | { kind: "done"; info: Info; result: Result };

const UNRANKED: Record<string, string> = {
  connection: "Not ranked: someone on this connection already played today's ranked puzzle.",
  "too-fast": "Not ranked: that solve was faster than a person can play.",
  regular: "Not ranked: those moves didn't look like a person playing.",
};

/**
 * The daily puzzle: the same grid for everyone today, timed by the server
 * from Start to the last piece, with a global board (lib/daily/service.ts).
 */
export default function DailyGame() {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [now, setNow] = useState(0);
  const [shared, setShared] = useState<string | null>(null);
  const auto = useAutoMark();
  // The latest game, for a drag that paints several cells before React re-renders.
  const latest = useRef<Play | null>(null);

  const updatePrefs = (change: Partial<Prefs>) =>
    setPrefs((current) => {
      const next = { ...(current ?? { name: "" }), ...change };
      savePrefs(next);
      return next;
    });

  const load = () => {
    setPhase({ kind: "loading" });
    dailyRequest<DailyStatus>(SLUG)
      .then((status) => {
        const info = { day: status.day, number: status.number, label: status.label };
        const { attempt } = status;
        if (attempt?.ms !== undefined) {
          setPhase({ kind: "done", info, result: { attempt, streak: status.streak, board: status.board, rank: status.rank, players: status.players } });
        } else if (attempt) {
          void begin(info, status);
        } else {
          setPhase({ kind: "ready", info, status, busy: false });
        }
        setPrefs((current) => current ?? { ...loadPrefs(), ...(status.name ? { name: status.name } : {}) });
      })
      .catch((error: unknown) => setPhase({ kind: "error", message: messageOf(error), retry: !(error instanceof DailyRequestError && error.status === 503) }));
  };

  /** Starts (or resumes, after a reload) today's attempt: the server's clock is the one that counts. */
  const begin = async (info: Info, today: DailyStatus) => {
    setPhase({ kind: "ready", info, status: today, busy: true });
    try {
      const sentAt = Date.now();
      const start = await dailyRequest<StartResponse<Puzzle>>(SLUG, "start");
      const receivedAt = Date.now();
      // The server's clock minus ours, taken halfway through the request.
      const offset = start.serverNow - Math.round((sentAt + receivedAt) / 2);
      // After a reload, today's moves come back from this device; the server kept the puzzle and the clock.
      let play = newPlay(start.puzzle);
      const saved = readJson(DAILY_MOVES_KEY) as SavedDailyMoves | null;
      if (saved?.day === start.day && Array.isArray(saved.moves)) {
        try {
          play = replay(start.puzzle, saved.moves);
        } catch {
          removeKey(DAILY_MOVES_KEY);
        }
      }
      latest.current = play;
      setNow(Date.now());
      const startInfo = { day: start.day, number: start.number, label: start.label };
      // Solved before the reload, but the result never reached the server: send it now.
      const solvedAlready = status(play).solved;
      setPhase({ kind: "playing", info: startInfo, play, startedAt: start.attempt.startedAt, offset, submitting: solvedAlready });
      if (solvedAlready) void submit(startInfo, play);
    } catch (error) {
      setPhase({ kind: "error", message: messageOf(error), retry: true });
    }
  };

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, []);

  const playing = phase.kind === "playing" && !phase.submitting;
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [playing]);

  // Today's moves are saved on every change, so a reload brings the board back; a finished attempt forgets them.
  const dayPlayed = phase.kind === "playing" ? phase.info.day : null;
  const movesPlayed = phase.kind === "playing" ? phase.play.moves : null;
  useEffect(() => {
    if (phase.kind === "done") removeKey(DAILY_MOVES_KEY);
    else if (dayPlayed && movesPlayed) writeJson(DAILY_MOVES_KEY, { day: dayPlayed, moves: movesPlayed } satisfies SavedDailyMoves);
  }, [phase.kind, dayPlayed, movesPlayed]);

  const submit = async (info: Info, play: Play) => {
    try {
      const result = await dailyRequest<SubmitResponse>(SLUG, "submit", { day: info.day, moves: play.moves, name: prefs?.name ?? "" });
      setPhase({ kind: "done", info, result });
    } catch (error) {
      setPhase((current) => (current.kind === "playing" ? { ...current, submitting: false, error: messageOf(error) } : current));
    }
  };

  if (phase.kind === "loading" || !prefs) {
    return phase.kind === "error" ? <ErrorCard message={phase.message} onRetry={phase.retry ? load : undefined} /> : <p className="cg-status">Loading today&apos;s puzzle…</p>;
  }
  if (phase.kind === "error") return <ErrorCard message={phase.message} onRetry={phase.retry ? load : undefined} />;

  if (phase.kind === "ready") {
    const { info, status, busy } = phase;
    const { variant } = scheduleFor(info.day);
    return (
      <>
        <section className="cg-daily-card" aria-labelledby="daily-title">
          <p className="cg-daily-kicker">Daily #{info.number}</p>
          <h2 id="daily-title" className="cg-daily-title">
            {info.label}
          </h2>
          <p className="cg-rule">{VARIANT_RULE[variant]}</p>
          <label className="cg-field">
            <span>Your name on the board</span>
            <input
              className="cg-input"
              value={prefs.name}
              maxLength={MAX_NAME_LENGTH}
              placeholder="Anonymous"
              autoComplete="nickname"
              onChange={(event) => updatePrefs({ name: event.target.value })}
            />
          </label>
          <button type="button" className="cg-button cg-button-primary cg-button-wide" disabled={busy} onClick={() => void begin(info, status)}>
            {busy ? "Starting…" : "Start"}
          </button>
          <p className="cg-daily-note">The clock starts when you press Start. One try a day.{status.streak ? ` Streak: ${status.streak} 🔥` : ""}</p>
        </section>
        <section aria-label="Today's board">
          <h3 className="cg-section-title">Today&apos;s board</h3>
          <Leaderboard board={status.board} rank={status.rank} players={status.players} />
        </section>
      </>
    );
  }

  if (phase.kind === "playing") {
    const { info, play, startedAt, offset, submitting, error } = phase;
    const solved = status(play).solved;
    const elapsed = solved && play.moves.length ? play.moves[play.moves.length - 1].t : Math.max(0, now + offset - startedAt);
    const moveTime = () => Math.max(0, Math.round(Date.now() + offset - startedAt));
    const commit = (next: Play) => {
      latest.current = next;
      setPhase((current) => (current.kind === "playing" ? { ...current, play: next } : current));
    };
    const onSet = (cell: number, to: Mark) => {
      const current = latest.current;
      if (!current || status(current).solved) return;
      const next = setMark(current, cell, to, moveTime());
      commit(next);
      if (status(next).solved) {
        setPhase((p) => (p.kind === "playing" ? { ...p, play: next, submitting: true, error: undefined } : p));
        void submit(info, next);
      }
    };
    return (
      <>
        <p className="cg-rule">
          <strong>Daily #{info.number}</strong> · {VARIANT_RULE[play.puzzle.variant]}
        </p>
        {solved ? (
          <div className="cg-solved" aria-live="polite">
            <div>
              <p className="cg-solved-title">{submitting ? "Checking…" : "Solved"}</p>
              <p className="cg-solved-note">{error ?? formatTime(elapsed)}</p>
            </div>
            {error ? (
              <button type="button" className="cg-button cg-button-primary" onClick={() => {
                setPhase((p) => (p.kind === "playing" ? { ...p, submitting: true, error: undefined } : p));
                void submit(info, play);
              }}>
                Try again
              </button>
            ) : null}
          </div>
        ) : (
          <Toolbar
            elapsed={elapsed}
            canUndo={play.moves.length > 0}
            canClear={play.marks.some((mark) => mark !== 0)}
            onUndo={() => commit(undo(play))}
            onClear={() => commit(clearAll(play, moveTime()))}
          />
        )}
        <Board play={play} hint={auto.hint} locked={solved} onSet={onSet} />
        <div className="cg-footer">
          <AutoMarkButton auto={auto} usable={!solved && play.marks.includes(PIECE)} />
        </div>
      </>
    );
  }

  const { info, result } = phase;
  const { attempt, streak, board, rank, players } = result;
  const shareText = `${GAME_TITLE} #${info.number} · ${info.label}\n${formatBoardTime(attempt.ms ?? 0)}${rank ? ` · #${rank} of ${players}` : ""}${streak > 1 ? ` · ${streak} days 🔥` : ""}`;
  const share = async () => {
    const url = `${window.location.origin}/regions`;
    try {
      if (navigator.share) {
        await navigator.share({ text: shareText, url });
        return;
      }
      await navigator.clipboard.writeText(`${shareText}\n${url}`);
      setShared("Copied. Paste it anywhere.");
    } catch {
      // Closing the share sheet rejects too: nothing to say.
    }
  };
  return (
    <>
      <section className="cg-daily-card" aria-live="polite">
        <p className="cg-daily-kicker">
          Daily #{info.number} · {info.label}
        </p>
        <h2 className="cg-daily-title">Solved in {formatBoardTime(attempt.ms ?? 0)}</h2>
        <p className="cg-daily-place">{attempt.ranked && rank ? `#${rank} of ${players} today` : UNRANKED[attempt.unranked ?? "connection"]}</p>
        {streak ? <p className="cg-daily-note">Streak: {streak} {streak === 1 ? "day" : "days"} 🔥</p> : null}
        <button type="button" className="cg-button cg-button-primary cg-button-wide" onClick={() => void share()}>
          Share
        </button>
        <p className="cg-daily-note" aria-live="polite">
          {shared}
        </p>
        <Countdown className="cg-daily-note" />
      </section>
      <section aria-label="Today's board">
        <h3 className="cg-section-title">Today&apos;s board</h3>
        <Leaderboard board={board} rank={rank} players={players} />
      </section>
    </>
  );
}

function ErrorCard({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="cg-daily-card" role="alert">
      <p className="cg-daily-place">{message}</p>
      {onRetry ? (
        <button type="button" className="cg-button" onClick={onRetry}>
          Try again
        </button>
      ) : null}
      <p className="cg-daily-note">Endless puzzles still work: switch to Endless above.</p>
    </div>
  );
}

const messageOf = (error: unknown) => (error instanceof Error ? error.message : "Something went wrong. Try again.");
