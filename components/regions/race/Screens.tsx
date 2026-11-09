"use client";

import type { ReactNode } from "react";
import { modeName } from "@/components/race/Screens";
import { GAME_TITLE } from "@/lib/games/regions/constants";
import { MODES, PLAYERS, ROUND_COUNTS, type Mode, type RoundCount } from "@/lib/games/race/race";
import { PIECE_CHOICES, type PieceChoice } from "@/lib/games/regions/race";
import { GLYPH, VARIANT_NAME } from "@/lib/games/regions/theme";
import type { Lang } from "@/lib/i18n/lang";
import { useLang } from "@/lib/i18n/useLang";
import { Segmented } from "../Controls";
import "../regions.css";
import RulesButton from "../Rules";
import { RACE_TEXT } from "../text";

/** Rank & File's parts of a race room; the rest is components/race/Screens.tsx. */

/** The line under the mode: who it's for and how it's won. */
export function modeLine(mode: Mode, lang: Lang): string {
  const { min, max } = PLAYERS[mode];
  return mode === "challenge" ? RACE_TEXT[lang].challengeLine(min, max) : RACE_TEXT[lang].survivalLine(min, max);
}

// "Mixed" goes through the pieces in turn; "mix" puts several on one board (its ✦, as in Endless).
const PIECE_ICON: Record<PieceChoice, string> = { mixed: "↻", rook: GLYPH.rook, king: GLYPH.king, knight: GLYPH.knight, queen: GLYPH.queen, mix: "✦" };

/** The room's page: the title, but no back link (a room's way out is Leave room). */
export function RaceShell({ children }: { children: ReactNode }) {
  return (
    <div className="cg-page cg-race">
      <main className="cg-main">
        <header className="cg-header">
          <h1 className="cg-title">{GAME_TITLE}</h1>
          <RulesButton />
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
  const lang = useLang();
  const t = RACE_TEXT[lang];
  if (!canEdit) {
    return (
      <>
        <p className="race-note">{modeLine(mode, lang)}</p>
        <p className="race-note">
          {t.piecesIs(pieces === "mixed" ? t.newEach : VARIANT_NAME[lang][pieces])}
          {mode === "challenge" ? t.nPuzzlesAfter(rounds) : ""}
        </p>
        <RulesButton variant="link" />
      </>
    );
  }
  return (
    <>
      <Segmented label={t.modeLabel} options={MODES} value={mode} onChange={onMode} render={(m) => modeName(m, lang)} />
      <p className="race-note">{modeLine(mode, lang)}</p>
      <p className="race-field-label">{t.pieces}</p>
      <Segmented
        label={t.pieces}
        options={PIECE_CHOICES}
        value={pieces}
        onChange={onPieces}
        render={(choice) => (
          <>
            <span aria-hidden="true" className="cg-seg-icon">
              {PIECE_ICON[choice]}
            </span>
            {choice === "mixed" ? t.mixed : VARIANT_NAME[lang][choice]}
          </>
        )}
      />
      {mode === "challenge" ? (
        <>
          <p className="race-field-label">{t.puzzles}</p>
          <Segmented label={t.puzzles} options={ROUND_COUNTS} value={rounds} onChange={onRounds} render={(n) => t.nPuzzles(n)} />
        </>
      ) : null}
      <RulesButton variant="link" />
    </>
  );
}
