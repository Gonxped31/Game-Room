/** The name shown in the UI and the browser tab (the slug stays `regions`). */
export const GAME_TITLE = "Rank & File";

/** Every chess piece a region can hold. */
export const PIECES = ["rook", "king", "knight", "bishop", "queen"] as const;
export type Piece = (typeof PIECES)[number];

/**
 * A puzzle's rule set: every region holds the same piece, except in "mix",
 * where each region shows its own. With one piece per row and column a queen
 * attacks exactly what a bishop does, so the single-piece diagonal level is
 * the queen and the bishop only appears in mix.
 */
export const VARIANTS = ["rook", "king", "knight", "queen", "mix"] as const;
export type Variant = (typeof VARIANTS)[number];

/** The pieces a mix puzzle draws its regions' pieces from. */
export const MIX_PIECES: readonly Piece[] = ["rook", "king", "knight", "bishop"];

/** Grid sizes (rows = columns = regions = pieces). */
export const MIN_SIZE = 5;
export const MAX_SIZE = 9;
