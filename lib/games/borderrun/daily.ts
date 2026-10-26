import { weekdayOf } from "@/lib/daily/day";
import type { DailyGame } from "@/lib/daily/types";
import { AREA_NAME } from "./areas";
import { GAME_TITLE, type Area } from "./constants";
import { replay, status, type Guess } from "./play";
import { generateRoute, type Route } from "./route";

/** The week's maps, Monday first (the user's call, 2026-10-26: one continent a day, the world on Sunday). */
export const SCHEDULE: { area: Area; minPar: number; maxPar: number }[] = [
  { area: "europe", minPar: 3, maxPar: 5 },
  { area: "americas", minPar: 3, maxPar: 5 },
  { area: "africa", minPar: 3, maxPar: 5 },
  { area: "asia", minPar: 3, maxPar: 5 },
  { area: "europe", minPar: 4, maxPar: 6 },
  { area: "eurasia", minPar: 4, maxPar: 6 },
  { area: "world", minPar: 5, maxPar: 7 },
];

export const scheduleFor = (day: string) => SCHEDULE[weekdayOf(day)];

const MAX_GUESSES = 300;

/** Border Run's daily route, for the shared daily system (lib/daily/). */
export const borderrunDaily: DailyGame<Route> = {
  slug: "borderrun",
  title: GAME_TITLE,
  describe: (day) => AREA_NAME[scheduleFor(day).area].en,
  generate: (seed, day) => generateRoute(seed, scheduleFor(day)),
  verify(route, moves) {
    if (!Array.isArray(moves) || moves.length === 0 || moves.length > MAX_GUESSES) return { ok: false, reason: "No guesses." };
    const guesses: Guess[] = [];
    for (const move of moves as unknown[]) {
      const { code, t } = (move ?? {}) as Record<string, unknown>;
      if (typeof code !== "string" || typeof t !== "number") return { ok: false, reason: "Unreadable guesses." };
      guesses.push({ code, t });
    }
    try {
      const play = replay(route, guesses);
      const result = status(play);
      if (!result.complete) return { ok: false, reason: "That route isn't complete." };
      return { ok: true, moveTimes: guesses.map((guess) => guess.t), penaltyMs: result.penaltyMs };
    } catch {
      // replay throws on a guess the page refuses, including one after the route is complete.
      return { ok: false, reason: "Those guesses don't play." };
    }
  },
  // Typing a name and pressing Enter takes a person most of a second, even with autocomplete.
  minHumanMs: (route) => route.par * 800,
};
