"use client";

import type { ReactNode } from "react";
import { MODE_NAME } from "@/components/race/Screens";
import { GAME_TITLE } from "@/lib/games/regions/constants";
import { MODES, PLAYERS, ROUND_COUNTS, type Mode, type RoundCount } from "@/lib/games/race/race";
import { PIECE_CHOICES, type PieceChoice } from "@/lib/games/regions/race";
import { GLYPH, VARIANT_NAME } from "@/lib/games/regions/theme";
import { Segmented } from "../Controls";
import "../regions.css";

/** Checkmate Grid's parts of a race room; the rest is components/race/Screens.tsx. */

export const MODE_LINE: Record<Mode, string> = {
  challenge: `${PLAYERS.challenge.min}–${PLAYERS.challenge.max} players. The lowest total time wins.`,
  survival: `${PLAYERS.survival.min}–${PLAYERS.survival.max} players. The slowest are out after each puzzle.`,
};

// "Mixed" goes through the pieces in turn; "mix" puts several on one board (its ✦, as in Endless).
const PIECE_ICON: Record<PieceChoice, string> = { mixed: "↻", rook: GLYPH.rook, king: GLYPH.king, knight: GLYPH.knight, queen: GLYPH.queen, mix: "✦" };

/** The room's page: the title, but no back link (a room's way out is Leave room). */
export function RaceShell({ children }: { children: ReactNode }) {
  return (
    <div className="cg-page cg-race">
      <main className="cg-main">
        <header className="cg-header">
          <h1 className="cg-title">{GAME_TITLE}</h1>
        </header>
        {children}
      </main>
    </div>
  );
}

/** The lobby's settings: the host's switches, or what was picked. */
export function Settings({
  mode,
  pieces,
  rounds,
  canEdit,
  onMode,
  onPieces,
  onRounds,
}: {
  mode: Mode;
  pieces: PieceChoice;
  rounds: RoundCount;
  canEdit: boolean;
  onMode: (mode: Mode) => void;
  onPieces: (pieces: PieceChoice) => void;
  onRounds: (rounds: RoundCount) => void;
}) {
  if (!canEdit) {
    return (
      <>
        <p className="race-note">{MODE_LINE[mode]}</p>
        <p className="race-note">
          Pieces: {pieces === "mixed" ? "a new one each puzzle" : VARIANT_NAME[pieces]}
          {mode === "challenge" ? `, ${rounds} puzzles` : ""}
        </p>
      </>
    );
  }
  return (
    <>
      <Segmented label="Mode" options={MODES} value={mode} onChange={onMode} render={(m) => MODE_NAME[m]} />
      <p className="race-note">{MODE_LINE[mode]}</p>
      <p className="race-field-label">Pieces</p>
      <Segmented
        label="Pieces"
        options={PIECE_CHOICES}
        value={pieces}
        onChange={onPieces}
        render={(choice) => (
          <>
            <span aria-hidden="true" className="cg-seg-icon">
              {PIECE_ICON[choice]}
            </span>
            {choice === "mixed" ? "Mixed" : VARIANT_NAME[choice]}
          </>
        )}
      />
      {mode === "challenge" ? (
        <>
          <p className="race-field-label">Puzzles</p>
          <Segmented label="Puzzles" options={ROUND_COUNTS} value={rounds} onChange={onRounds} render={(n) => `${n} puzzles`} />
        </>
      ) : null}
    </>
  );
}
