"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AREA_NAME } from "@/lib/games/borderrun/areas";
import { AREAS, PAR_RANGE, PENALTY_MS, type Area } from "@/lib/games/borderrun/constants";
import { addGuess, newPlay, replay, status, type Play } from "@/lib/games/borderrun/play";
import { generateRoute, shortestPath } from "@/lib/games/borderrun/route";
import type { Lang } from "@/lib/i18n/lang";
import { useReportFinished } from "@/lib/tracking/useReportFinished";
import { CapitalLine, formatTime, GuessInput, GuessList, PathLine, PlayMap, RouteHeader, Segmented, Toolbar } from "./Controls";
import { ENDLESS_GAME_KEY, ENDLESS_KEY, isArea, isRoute, readJson, removeKey, writeJson, type SavedEndlessGame } from "./storage";
import { TEXT } from "./text";

/** This device's map and best scores (time plus penalty) per map. */
interface Saved {
  area: Area;
  best: Partial<Record<Area, number>>;
}
const DEFAULTS: Saved = { area: "europe", best: {} };

function loadSaved(): Saved {
  const raw = readJson(ENDLESS_KEY) as Partial<Saved> | null;
  if (!raw) return DEFAULTS;
  return { area: isArea(raw.area) ? raw.area : DEFAULTS.area, best: raw.best && typeof raw.best === "object" ? raw.best : {} };
}

/** A route's id for the "game finished" report: its seed's start and when it was dealt on this device (letters, digits, "-"; under 40 characters). */
const gameIdOf = (seed: string, at: number) => `${seed.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8)}-${at}`;
const isGameId = (value: unknown): value is string => typeof value === "string" && /^[a-zA-Z0-9-]{1,40}$/.test(value);

/**
 * Endless mode: pick a map, press Start, and link two countries, timed from
 * Start, with 15 s per guess past the par; the best score per map stays on
 * this device. New route keeps the map, Change goes back to the picker, and
 * Show a route gives up and draws one (no best for that one). A completed
 * route is reported as a finished solo game (lib/tracking/finished.ts).
 */
export default function EndlessGame({ lang }: { lang: Lang }) {
  const t = TEXT[lang];
  const [saved, setSaved] = useState<Saved | null>(null);
  const [play, setPlay] = useState<Play | null>(null);
  /** Given up: the route drawn for it. */
  const [reveal, setReveal] = useState<string[] | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);
  /** This route's id, made when it's dealt and kept with it through a reload. */
  const [gameId, setGameId] = useState<string | null>(null);
  // The latest game, for guesses that land before React re-renders.
  const latest = useRef<Play | null>(null);
  const commit = useCallback((next: Play | null) => {
    latest.current = next;
    setPlay(next);
  }, []);

  const update = (change: Partial<Saved>) =>
    setSaved((current) => {
      const next = { ...(current ?? DEFAULTS), ...change };
      writeJson(ENDLESS_KEY, next);
      return next;
    });

  // This device's map and bests, and the route in progress if the page was reloaded mid-game (after mount, never during render).
  useEffect(() => {
    const timer = setTimeout(() => {
      const prefs = loadSaved();
      const game = readJson(ENDLESS_GAME_KEY) as SavedEndlessGame | null;
      let resumed: Play | null = null;
      if (game && isRoute(game.route) && Array.isArray(game.guesses) && Number.isFinite(game.elapsed)) {
        try {
          const play = replay(game.route, game.guesses);
          if (!status(play).complete) resumed = play;
        } catch {
          // A saved game that doesn't replay is dropped below.
        }
      }
      if (!resumed) {
        removeKey(ENDLESS_GAME_KEY);
        setSaved(prefs);
        return;
      }
      // The clock picks up where it was; time with the page closed doesn't count.
      const start = performance.now() - Math.max(game!.elapsed, resumed.guesses.at(-1)?.t ?? 0);
      setSaved({ ...prefs, area: resumed.route.area });
      commit(resumed);
      setGameId(isGameId(game!.id) ? game!.id : gameIdOf("resumed", Date.now()));
      setStartedAt(start);
      setNow(performance.now());
    }, 0);
    return () => clearTimeout(timer);
  }, [commit]);

  /** A new route on `area`: generated at once (a few ms), timed from now. */
  const deal = (area: Area) => {
    const seed = crypto.randomUUID();
    const route = generateRoute(seed, { area, ...PAR_RANGE[area] });
    const start = performance.now();
    setReveal(null);
    commit(newPlay(route));
    setGameId(gameIdOf(seed, Date.now()));
    setStartedAt(start);
    setNow(start);
  };

  const change = () => {
    commit(null);
    setReveal(null);
    removeKey(ENDLESS_GAME_KEY);
  };

  const result = play ? status(play) : null;
  const over = !!result?.complete || reveal !== null;
  useEffect(() => {
    if (!play || over) return;
    const timer = setInterval(() => setNow(performance.now()), 250);
    return () => clearInterval(timer);
  }, [play, over]);

  // A linked route is a finished game (not one given up with Show a route).
  useReportFinished(result?.complete && gameId ? { slug: "borderrun", mode: "solo", id: gameId, players: 1, lang } : null);

  // The route in progress is saved on every guess, every second and when the page goes away; a finished one is forgotten.
  useEffect(() => {
    if (!play) return;
    if (over) {
      removeKey(ENDLESS_GAME_KEY);
      return;
    }
    const persist = () => {
      const game: SavedEndlessGame = {
        route: play.route,
        guesses: play.guesses,
        elapsed: Math.max(play.guesses.at(-1)?.t ?? 0, Math.round(performance.now() - startedAt)),
        ...(gameId ? { id: gameId } : {}),
      };
      writeJson(ENDLESS_GAME_KEY, game);
    };
    persist();
    const timer = setInterval(persist, 1000);
    window.addEventListener("pagehide", persist);
    return () => {
      clearInterval(timer);
      window.removeEventListener("pagehide", persist);
    };
  }, [play, over, startedAt, gameId]);

  const onGuess = (code: string) => {
    const current = latest.current;
    if (!current || status(current).complete) return;
    const at = Math.round(performance.now() - startedAt);
    const next = addGuess(current, code, at);
    commit(next);
    const done = status(next);
    // The score is the last guess's time plus the penalty; keep it if it beats this map's best.
    if (done.complete && saved) {
      const score = at + done.penaltyMs;
      const area = next.route.area;
      if (!((saved.best[area] ?? Infinity) <= score)) update({ best: { ...saved.best, [area]: score } });
    }
  };

  if (!saved) return <p className="br-status">{t.loading}</p>;

  if (!play) {
    const best = saved.best[saved.area];
    return (
      <section className="br-card" aria-labelledby="endless-title">
        <h2 id="endless-title" className="br-card-title">
          {t.endless}
        </h2>
        <p className="br-note">{t.endlessIntro}</p>
        <Segmented label={t.map} options={AREAS} value={saved.area} onChange={(area) => update({ area })} render={(area) => AREA_NAME[area][lang]} wrap />
        <p className="br-note">{best !== undefined ? t.yourBest(saved.area, AREA_NAME[saved.area][lang], formatTime(best)) : t.noBest}</p>
        <button type="button" className="br-button br-button-primary br-button-wide" onClick={() => deal(saved.area)}>
          {t.start}
        </button>
      </section>
    );
  }

  const elapsed = (result!.complete ? play.guesses[play.guesses.length - 1].t : now - startedAt) || 0;
  const best = saved.best[play.route.area];
  const score = elapsed + result!.penaltyMs;

  return (
    <>
      <div className="br-current">
        <p className="br-current-label">{AREA_NAME[play.route.area][lang]}</p>
        <button type="button" className="br-button" onClick={change}>
          {t.change}
        </button>
      </div>
      <RouteHeader play={play} lang={lang} />
      <div aria-live="polite">
        {result!.complete ? (
          <div className="br-done">
            <div>
              <p className="br-done-title">{t.routeComplete(formatTime(score))}</p>
              <p className="br-done-note">
                {result!.extra ? t.pastPar(formatTime(elapsed), (result!.extra * PENALTY_MS) / 1000, result!.extra) : t.onPar}
                {best === score ? t.newBest : best !== undefined ? t.bestWas(formatTime(best)) : null}
              </p>
            </div>
            <button type="button" className="br-button br-button-primary" onClick={() => deal(play.route.area)}>
              {t.nextRoute}
            </button>
          </div>
        ) : reveal ? (
          <div className="br-done">
            <div>
              <p className="br-done-title">{t.oneWay}</p>
              <PathLine path={reveal} lang={lang} />
            </div>
            <button type="button" className="br-button br-button-primary" onClick={() => deal(play.route.area)}>
              {t.nextRoute}
            </button>
          </div>
        ) : (
          <Toolbar play={play} elapsed={elapsed} best={best} />
        )}
      </div>
      <PlayMap play={play} lang={lang} reveal={reveal} />
      {result!.complete && result!.path ? <PathLine path={result!.path} lang={lang} /> : null}
      {over ? <CapitalLine play={play} lang={lang} /> : null}
      {/* Keyed by the route, so a new one starts with an empty box. */}
      {over ? null : <GuessInput key={startedAt} play={play} lang={lang} onGuess={onGuess} />}
      <GuessList play={play} lang={lang} />
      <div className="br-footer">
        {over ? null : (
          <button type="button" className="br-button" onClick={() => setReveal(shortestPath(play.route))}>
            {t.showRoute}
          </button>
        )}
        <button type="button" className="br-button" onClick={() => deal(play.route.area)}>
          {t.newRoute}
        </button>
      </div>
    </>
  );
}
