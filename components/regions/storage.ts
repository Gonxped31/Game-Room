import type { Puzzle } from "@/lib/games/regions/board";
import { MAX_SIZE, MIN_SIZE, VARIANTS } from "@/lib/games/regions/constants";
import type { Move } from "@/lib/games/regions/play";

/**
 * What this device remembers for Checkmate Grid, so a reload doesn't lose
 * anything (the user's call, 2026-10-26): the tab, the Endless puzzle in
 * progress, and today's Daily moves. Every read and write is wrapped in
 * try/catch (storage can be blocked) and only ever runs in effects or
 * handlers, never during render.
 */
export const MODE_KEY = "checkmate-grid:mode";
export const ENDLESS_GAME_KEY = "checkmate-grid:endless-game:v1";
export const DAILY_MOVES_KEY = "checkmate-grid:daily-moves:v1";
/** When Auto ✕ was last pressed in each mode (ms, wall clock), so a reload doesn't reset its lock. */
export const AUTO_MARK_KEY = { daily: "checkmate-grid:auto-mark:daily", endless: "checkmate-grid:auto-mark:endless" } as const;

export function readJson(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Not saved: the game plays the same.
  }
}

export function removeKey(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing to do.
  }
}

/** An Endless puzzle in progress: the grid, the moves, and the time spent on it before the page closed. */
export interface SavedEndlessGame {
  puzzle: Puzzle;
  moves: Move[];
  elapsed: number;
}

/** Today's Daily moves (the server keeps the puzzle and the clock). */
export interface SavedDailyMoves {
  day: string;
  moves: Move[];
}

/** A stored puzzle that looks like one; `replay` then checks the moves against it. */
export function isPuzzle(value: unknown): value is Puzzle {
  const p = value as Puzzle | null;
  return (
    !!p &&
    Number.isInteger(p.size) &&
    p.size >= MIN_SIZE &&
    p.size <= MAX_SIZE &&
    VARIANTS.includes(p.variant) &&
    Array.isArray(p.regions) &&
    p.regions.length === p.size * p.size &&
    p.regions.every((r) => Number.isInteger(r) && r >= 0 && r < p.size) &&
    Array.isArray(p.pieces) &&
    p.pieces.length === p.size
  );
}
