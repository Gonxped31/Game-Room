import type { Piece, Variant } from "./constants";

/** The page's colors: a chess-club look, cream paper and dark green ink. */
export const INK = "#16261D";
export const INK_SOFT = "#4B5A50";
export const PAPER = "#F3EBDD";
/** Buttons and the selected chips: mint, with ink text (over 9:1). */
export const ACCENT = "#7FD1A6";
/** A clashing piece. */
export const CLASH = "#C62828";

/** One pastel per region; all nine differ, so neighbours never share one. */
export const REGION_COLORS = [
  "#F6C6B4",
  "#F9E0A0",
  "#C5E5B0",
  "#A9DCE3",
  "#C6C1F2",
  "#F3BCD9",
  "#E3CFA9",
  "#B9D3F0",
  "#DDE6A1",
] as const;

/** Chess glyphs, with U+FE0E so phones draw them as text, not emoji. */
export const GLYPH: Record<Piece, string> = {
  rook: "♜︎",
  king: "♚︎",
  knight: "♞︎",
  bishop: "♝︎",
  queen: "♛︎",
};

export const PIECE_NAME: Record<Piece, string> = {
  rook: "Rook",
  king: "King",
  knight: "Knight",
  bishop: "Bishop",
  queen: "Queen",
};

export const VARIANT_NAME: Record<Variant, string> = {
  rook: "Rook",
  king: "King",
  knight: "Knight",
  queen: "Queen",
  mix: "Mix",
};

/** The rule line under the controls. */
export const VARIANT_RULE: Record<Variant, string> = {
  rook: "One rook in every row, column and colour.",
  king: "One king in every row, column and colour. No two touch, not even at a corner.",
  knight: "One knight in every row, column and colour. No two a knight's move apart.",
  queen: "One queen in every row, column and colour. No two on the same diagonal.",
  mix: "One piece in every row, column and colour: the one its colour shows. No piece may attack another.",
};
