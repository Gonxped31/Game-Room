export const GAME_SLUG = "lasthop";
export const GAME_TITLE = "Last Hop";

/** Track: one row. Grid: a square board where pieces also move down (A) or up (B). */
export const MODES = ["track", "grid"] as const;
export type Mode = (typeof MODES)[number];

export const MODE_LABELS: Record<Mode, { label: string; detail: string }> = {
  track: { label: "Track", detail: "Quick and sharp. One row, every move counts." },
  grid: { label: "Grid", detail: "Longer, more open. Pieces move two ways." },
};

/**
 * The pawns a player can pick (the user's list, 2026-10-30). Each player
 * picks their own in the lobby or between matches; the two must differ. The
 * colour stays the seat's (p1 tangerine, p2 mint).
 */
export const PAWNS = ["square", "circle", "frog", "bunny", "bear", "star", "heart", "ghost"] as const;
export type Pawn = (typeof PAWNS)[number];

export const PAWN_LABELS: Record<Pawn, string> = {
  square: "Square",
  circle: "Circle",
  frog: "Frog",
  bunny: "Bunny",
  bear: "Bear",
  star: "Star",
  heart: "Heart",
  ghost: "Ghost",
};

/** Each seat's pawn until its player picks another. */
export const DEFAULT_PAWNS = { p1: "square", p2: "circle" } as const satisfies Record<"p1" | "p2", Pawn>;

/** Each player's chess clock at the start of a round, and what each move adds back. */
export const CLOCKS: Record<Mode, { startMs: number; incrementMs: number }> = {
  track: { startMs: 60_000, incrementMs: 2_000 },
  grid: { startMs: 120_000, incrementMs: 3_000 },
};

/** A round's clock starts this long after the board shows, so both players see it first. */
export const START_DELAY_MS = 3_000;
/** The result of a round stays up this long before the next one starts. */
export const BETWEEN_MS = 6_000;

/** A match is at least this many rounds (two boards, each played from both sides). */
export const MIN_ROUNDS = 4;
/** Still tied after this many rounds: the match is a draw. */
export const MAX_ROUNDS = 10;

/** Board sizes the rules accept. */
export const MAX_WIDTH = 12;
export const MAX_HEIGHT = 5;
