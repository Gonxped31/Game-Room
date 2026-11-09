"use client";

import { useEffect, useRef, useState } from "react";
import Countdown from "@/components/daily/Countdown";
import Leaderboard, { formatBoardTime } from "@/components/daily/Leaderboard";
import { dailyRequest, DailyRequestError, type Attempt, type BoardEntry, type DailyStatus, type StartResponse, type SubmitResponse } from "@/lib/daily/client";
import { MAX_NAME_LENGTH } from "@/lib/daily/service";
import { AREA_NAME } from "@/lib/games/borderrun/areas";
import { GAME_TITLE, PENALTY_MS } from "@/lib/games/borderrun/constants";
import { scheduleFor } from "@/lib/games/borderrun/daily";
import { addGuess, newPlay, replay, status, type Play } from "@/lib/games/borderrun/play";
import { closenessOf, type Route } from "@/lib/games/borderrun/route";
import { SHARE_SQUARE } from "@/lib/games/borderrun/theme";
import type { Lang } from "@/lib/i18n/lang";
import { dailyShareUrl } from "@/lib/share";
import { CapitalLine, formatTime, GuessInput, GuessList, PathLine, PlayMap, RouteHeader, Toolbar } from "./Controls";
import { DAILY_GUESSES_KEY, DAILY_KEY, isRoute, readJson, removeKey, writeJson, type SavedDailyGuesses } from "./storage";
import { TEXT } from "./text";

const SLUG = "borderrun";
/** Where the daily route lives (the solo page): what Share links to. */
const DAILY_PATH = "/borderrun/solo";

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
  | { kind: "done"; info: Info; result: Result; play: Play | null };

/** The guesses saved on this device, if they're `day`'s. */
function savedGuesses(day: string): SavedDailyGuesses | null {
  const saved = readJson(DAILY_GUESSES_KEY) as SavedDailyGuesses | null;
  return saved?.day === day && Array.isArray(saved.guesses) && isRoute(saved.route) ? saved : null;
}

/** The day's map in `lang` (the server's `label` is the English one, from the same schedule). */
const mapOf = (info: Info, lang: Lang) => AREA_NAME[scheduleFor(info.day).area][lang];

/**
 * The daily route: the same two countries and closed borders for everyone
 * today, timed by the server from Start to the guess that completes it, plus
 * 15 s per guess past the par, on a global board (lib/daily/service.ts).
 * The server records the finished game, so this page doesn't report it.
 */
export default function DailyGame({ lang }: { lang: Lang }) {
  const t = TEXT[lang];
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [name, setName] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const [shared, setShared] = useState<string | null>(null);
  // The latest game, for guesses that land before React re-renders.
  const latest = useRef<Play | null>(null);

  const updateName = (next: string) => {
    setName(next);
    writeJson(DAILY_KEY, { name: next });
  };

  const load = () => {
    setPhase({ kind: "loading" });
    dailyRequest<DailyStatus>(SLUG)
      .then((today) => {
        const info = { day: today.day, number: today.number, label: today.label };
        const { attempt } = today;
        if (attempt?.ms !== undefined) {
          setPhase({ kind: "done", info, result: { attempt, streak: today.streak, board: today.board, rank: today.rank, players: today.players }, play: null });
        } else if (attempt) {
          void begin(info, today);
        } else {
          setPhase({ kind: "ready", info, status: today, busy: false });
        }
        setName((current) => {
          if (current !== null) return current;
          const saved = readJson(DAILY_KEY) as { name?: unknown } | null;
          return today.name ?? (typeof saved?.name === "string" ? saved.name : "");
        });
      })
      .catch((error: unknown) => setPhase({ kind: "error", message: messageOf(error), retry: !(error instanceof DailyRequestError && error.status === 503) }));
  };

  /** Starts (or resumes, after a reload) today's attempt: the server's clock is the one that counts. */
  const begin = async (info: Info, today: DailyStatus) => {
    setPhase({ kind: "ready", info, status: today, busy: true });
    try {
      const sentAt = Date.now();
      const start = await dailyRequest<StartResponse<Route>>(SLUG, "start");
      const receivedAt = Date.now();
      // The server's clock minus ours, taken halfway through the request.
      const offset = start.serverNow - Math.round((sentAt + receivedAt) / 2);
      // After a reload, today's guesses come back from this device; the server kept the route and the clock.
      let play = newPlay(start.puzzle);
      const saved = savedGuesses(start.day);
      if (saved) {
        try {
          play = replay(start.puzzle, saved.guesses);
        } catch {
          removeKey(DAILY_GUESSES_KEY);
        }
      }
      latest.current = play;
      setNow(Date.now());
      const startInfo = { day: start.day, number: start.number, label: start.label };
      // Completed before the reload, but the result never reached the server: send it now.
      const doneAlready = status(play).complete;
      setPhase({ kind: "playing", info: startInfo, play, startedAt: start.attempt.startedAt, offset, submitting: doneAlready });
      if (doneAlready) void submit(startInfo, play);
    } catch (error) {
      setPhase({ kind: "error", message: messageOf(error), retry: true });
    }
  };

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, []);

  // Once finished, the guesses saved on this device (if they're today's) come back for the map and the share text.
  const doneDay = phase.kind === "done" && !phase.play ? phase.info.day : null;
  useEffect(() => {
    if (!doneDay) return;
    const timer = setTimeout(() => {
      setPhase((current) => {
        if (current.kind !== "done" || current.play) return current;
        const saved = savedGuesses(doneDay);
        if (!saved) return current;
        try {
          return { ...current, play: replay(saved.route, saved.guesses) };
        } catch {
          return current;
        }
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [doneDay]);

  const playing = phase.kind === "playing" && !phase.submitting;
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [playing]);

  // Today's guesses (and route, for the finished map) are saved on every guess, so a reload brings them back.
  const dayPlayed = phase.kind === "playing" ? phase.info.day : null;
  const playNow = phase.kind === "playing" ? phase.play : null;
  useEffect(() => {
    if (!dayPlayed || !playNow) return;
    writeJson(DAILY_GUESSES_KEY, { day: dayPlayed, route: playNow.route, guesses: playNow.guesses } satisfies SavedDailyGuesses);
  }, [dayPlayed, playNow]);

  const submit = async (info: Info, play: Play) => {
    try {
      const result = await dailyRequest<SubmitResponse>(SLUG, "submit", { day: info.day, moves: play.guesses, name: name ?? "" });
      setPhase({ kind: "done", info, result, play });
    } catch (error) {
      setPhase((current) => (current.kind === "playing" ? { ...current, submitting: false, error: messageOf(error) } : current));
    }
  };

  if (phase.kind === "loading" || name === null) {
    return phase.kind === "error" ? <ErrorCard lang={lang} message={phase.message} onRetry={phase.retry ? load : undefined} /> : <p className="br-status">{t.loadingDaily}</p>;
  }
  if (phase.kind === "error") return <ErrorCard lang={lang} message={phase.message} onRetry={phase.retry ? load : undefined} />;

  if (phase.kind === "ready") {
    const { info, status: today, busy } = phase;
    return (
      <>
        <section className="br-card" aria-labelledby="daily-title">
          <p className="br-kicker">{t.daily(info.number)}</p>
          <h2 id="daily-title" className="br-card-title">
            {mapOf(info, lang)}
          </h2>
          <p className="br-note">{t.dailyIntro(PENALTY_MS / 1000)}</p>
          <label className="br-field">
            <span>{t.boardName}</span>
            <input className="br-input" value={name} maxLength={MAX_NAME_LENGTH} placeholder={t.anonymous} autoComplete="nickname" onChange={(event) => updateName(event.target.value)} />
          </label>
          <button type="button" className="br-button br-button-primary br-button-wide" disabled={busy} onClick={() => void begin(info, today)}>
            {busy ? t.starting : t.start}
          </button>
          <p className="br-note">
            {t.dailyNote}
            {today.streak ? t.streakShort(today.streak) : ""}
          </p>
        </section>
        <section aria-label={t.todaysBoard}>
          <h3 className="br-section-title">{t.todaysBoard}</h3>
          <Leaderboard board={today.board} rank={today.rank} players={today.players} />
        </section>
      </>
    );
  }

  if (phase.kind === "playing") {
    const { info, play, startedAt, offset, submitting, error } = phase;
    const result = status(play);
    const elapsed = result.complete && play.guesses.length ? play.guesses[play.guesses.length - 1].t : Math.max(0, now + offset - startedAt);
    const onGuess = (code: string) => {
      const current = latest.current;
      if (!current || status(current).complete) return;
      const next = addGuess(current, code, Math.max(current.guesses.at(-1)?.t ?? 0, Math.round(Date.now() + offset - startedAt)));
      latest.current = next;
      const complete = status(next).complete;
      setPhase((p) => (p.kind === "playing" ? { ...p, play: next, ...(complete ? { submitting: true, error: undefined } : {}) } : p));
      if (complete) void submit(info, next);
    };
    return (
      <>
        <RouteHeader play={play} lang={lang} kicker={`${t.daily(info.number)} · ${mapOf(info, lang)} · `} />
        <div aria-live="polite">
          {result.complete ? (
            <div className="br-done">
              <div>
                <p className="br-done-title">{submitting ? t.checking : t.complete}</p>
                <p className="br-done-note">{error ? t.serverError(error) : formatTime(elapsed + result.penaltyMs)}</p>
              </div>
              {error ? (
                <button
                  type="button"
                  className="br-button br-button-primary"
                  onClick={() => {
                    setPhase((p) => (p.kind === "playing" ? { ...p, submitting: true, error: undefined } : p));
                    void submit(info, play);
                  }}
                >
                  {t.tryAgain}
                </button>
              ) : null}
            </div>
          ) : (
            <Toolbar play={play} elapsed={elapsed} />
          )}
        </div>
        <PlayMap play={play} lang={lang} />
        {result.complete ? null : <GuessInput play={play} lang={lang} onGuess={onGuess} />}
        <GuessList play={play} lang={lang} />
      </>
    );
  }

  const { info, result, play } = phase;
  const { attempt, streak, board, rank, players } = result;
  const squares = play ? play.guesses.map((guess) => SHARE_SQUARE[closenessOf(play.route, guess.code)]).join("") : "";
  const shareText = `${GAME_TITLE} #${info.number} · ${mapOf(info, lang)}\n${squares ? `${squares}\n` : ""}${formatBoardTime(attempt.ms ?? 0)}${rank ? t.shareRank(rank, players) : ""}${streak > 1 ? t.shareStreak(streak) : ""}`;
  const share = async () => {
    const url = dailyShareUrl(window.location.origin, SLUG, DAILY_PATH, lang);
    try {
      if (navigator.share) {
        await navigator.share({ text: shareText, url });
        return;
      }
      await navigator.clipboard.writeText(`${shareText}\n${url}`);
      setShared(t.copied);
    } catch {
      // Closing the share sheet rejects too: nothing to say.
    }
  };
  const path = play ? status(play).path : null;
  return (
    <>
      <section className="br-card" aria-live="polite">
        <p className="br-kicker">
          {t.daily(info.number)} · {mapOf(info, lang)}
        </p>
        <h2 className="br-card-title">{t.doneIn(formatBoardTime(attempt.ms ?? 0))}</h2>
        {attempt.penaltyMs ? <p className="br-note">{t.penaltyNote(formatBoardTime((attempt.ms ?? 0) - attempt.penaltyMs), attempt.penaltyMs / 1000)}</p> : null}
        <p className="br-place">{attempt.ranked && rank ? t.rankToday(rank, players) : t.unranked[attempt.unranked ?? "connection"]}</p>
        {streak ? <p className="br-note">{t.streak(streak)}</p> : null}
        <button type="button" className="br-button br-button-primary br-button-wide" onClick={() => void share()}>
          {t.share}
        </button>
        <p className="br-note" aria-live="polite">
          {shared}
        </p>
        <Countdown className="br-note" />
      </section>
      {play ? (
        <>
          <PlayMap play={play} lang={lang} />
          {path ? <PathLine path={path} lang={lang} /> : null}
          <CapitalLine play={play} lang={lang} />
        </>
      ) : null}
      <section aria-label={t.todaysBoard}>
        <h3 className="br-section-title">{t.todaysBoard}</h3>
        <Leaderboard board={board} rank={rank} players={players} />
      </section>
    </>
  );
}

function ErrorCard({ lang, message, onRetry }: { lang: Lang; message: string; onRetry?: () => void }) {
  const t = TEXT[lang];
  return (
    <div className="br-card" role="alert">
      <p className="br-place">{t.serverError(message)}</p>
      {onRetry ? (
        <button type="button" className="br-button" onClick={onRetry}>
          {t.tryAgain}
        </button>
      ) : null}
      <p className="br-note">{t.endlessStillWorks}</p>
    </div>
  );
}

/** The error's message, in English (TEXT's `serverError` gives it in the page's language). */
const messageOf = (error: unknown) => (error instanceof Error ? error.message : "Something went wrong. Try again.");
