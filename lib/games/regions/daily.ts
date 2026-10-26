import { weekdayOf } from "@/lib/daily/day";
import type { DailyGame } from "@/lib/daily/types";
import type { Puzzle } from "./board";
import { GAME_TITLE, type Variant } from "./constants";
import { generate } from "./generate";
import { EMPTY, MARK, PIECE, replay, status, type Move } from "./play";
import { VARIANT_NAME } from "./theme";

/** The week's puzzles, Monday first: easy rooks, then each piece, the mix at the weekend. */
export const SCHEDULE: { variant: Variant; size: number; minLevel: number }[] = [
  { variant: "rook", size: 6, minLevel: 1 },
  { variant: "king", size: 7, minLevel: 2 },
  { variant: "knight", size: 7, minLevel: 2 },
  { variant: "queen", size: 7, minLevel: 2 },
  { variant: "king", size: 8, minLevel: 3 },
  { variant: "mix", size: 8, minLevel: 2 },
  { variant: "mix", size: 9, minLevel: 3 },
];

export const scheduleFor = (day: string) => SCHEDULE[weekdayOf(day)];

const MAX_MOVES = 5000;

/** Checkmate Grid's daily puzzle, for the shared daily system (lib/daily/). */
export const regionsDaily: DailyGame<Puzzle> = {
  slug: "regions",
  title: GAME_TITLE,
  describe(day) {
    const { variant, size } = scheduleFor(day);
    return `${VARIANT_NAME[variant]} · ${size}×${size}`;
  },
  generate(seed, day) {
    const { variant, size, minLevel } = scheduleFor(day);
    return generate(seed, { variant, size, minLevel }).puzzle;
  },
  verify(puzzle, moves) {
    if (!Array.isArray(moves) || moves.length === 0 || moves.length > MAX_MOVES) return { ok: false, reason: "No moves." };
    const parsed: Move[] = [];
    for (const move of moves as unknown[]) {
      const { cell, to, t } = (move ?? {}) as Record<string, unknown>;
      if (typeof cell !== "number" || typeof t !== "number" || (to !== EMPTY && to !== MARK && to !== PIECE)) return { ok: false, reason: "Unreadable moves." };
      parsed.push({ cell, to, t });
    }
    try {
      const play = replay(puzzle, parsed);
      if (!status(play).solved) return { ok: false, reason: "That isn't solved." };
      return { ok: true, moveTimes: parsed.map((m) => m.t) };
    } catch {
      // replay throws on a move a player couldn't make, including one after the solve.
      return { ok: false, reason: "Those moves don't play." };
    }
  },
  // Two taps per piece at the very least; no person places a 7×7's seven pieces in under 4 s.
  minHumanMs: (puzzle) => puzzle.size * 600,
};
