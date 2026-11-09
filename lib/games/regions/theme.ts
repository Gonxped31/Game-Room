import { texts } from "@/lib/i18n/text";
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

/** Each piece's name, in each language (French: Roi, Dame, Tour, Fou, Cavalier). */
export const PIECE_NAME = texts<Record<Piece, string>>({
  en: { rook: "Rook", king: "King", knight: "Knight", bishop: "Bishop", queen: "Queen" },
  fr: { rook: "Tour", king: "Roi", knight: "Cavalier", bishop: "Fou", queen: "Dame" },
});

export const VARIANT_NAME = texts<Record<Variant, string>>({
  en: { rook: "Rook", king: "King", knight: "Knight", queen: "Queen", mix: "Mix" },
  fr: { rook: "Tour", king: "Roi", knight: "Cavalier", queen: "Dame", mix: "Mélange" },
});

/** The rule line under the controls. */
export const VARIANT_RULE = texts<Record<Variant, string>>({
  en: {
    rook: "One rook in every row, column and colour.",
    king: "One king in every row, column and colour. No two touch, not even at a corner.",
    knight: "One knight in every row, column and colour. No two a knight's move apart.",
    queen: "One queen in every row, column and colour. No two on the same diagonal.",
    mix: "One piece in every row, column and colour: the one its colour shows. No piece may attack another.",
  },
  fr: {
    rook: "Une tour par ligne, par colonne et par couleur.",
    king: "Un roi par ligne, par colonne et par couleur. Jamais deux qui se touchent, même par un coin.",
    knight: "Un cavalier par ligne, par colonne et par couleur. Jamais deux à un saut de cavalier l'un de l'autre.",
    queen: "Une dame par ligne, par colonne et par couleur. Jamais deux sur la même diagonale.",
    mix: "Une pièce par ligne, par colonne et par couleur : celle que montre sa couleur. Aucune pièce ne doit en attaquer une autre.",
  },
});
