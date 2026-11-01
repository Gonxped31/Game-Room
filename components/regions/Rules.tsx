"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import HowToPlay, { type HowToPlayLook } from "@/components/HowToPlay";
import { MAX_SIZE, MIN_SIZE, type Piece } from "@/lib/games/regions/constants";
import { COUNTDOWN_MS, DNF_EXTRA_MS, MAX_ROUNDS, PLAYERS, RESULTS_MS, ROUND_COUNTS } from "@/lib/games/race/race";
import { ROUND_MS } from "@/lib/games/regions/race";
import { GLYPH } from "@/lib/games/regions/theme";

/** "Got it": the game's green primary button, full width. */
function DoneButton({ className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={`cg-button cg-button-primary w-full ${className}`} {...rest} />;
}

const FOCUS = "focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--cg-ink)]";

/**
 * Checkmate Grid's look for the shared dialog: the cream card, Fraunces
 * headings, the mint Got it. Its classes are Tailwind utilities, which the
 * offline download doesn't compile: so How to play is only ever placed by
 * the site's pages (Stage's `rules`, the race shell), never inside the
 * exported Stage itself.
 */
const LOOK: HowToPlayLook = {
  iconClassName: `${FOCUS} ml-auto flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border-2 border-[var(--cg-ink)] bg-[var(--cg-card)] text-[20px] font-bold text-[var(--cg-ink)] shadow-[0_3px_0_var(--cg-ink)]`,
  linkClassName: `${FOCUS} cursor-pointer self-start border-0 bg-transparent p-0 text-[15px] font-bold text-[var(--cg-ink)] underline`,
  panelClassName: "bg-[var(--cg-card)] text-[var(--cg-ink)] font-[family-name:var(--font-dm-sans)]",
  headerClassName: "border-b-2 border-[var(--cg-paper)]",
  titleClassName: "font-[family-name:var(--font-fraunces)] text-[24px] font-extrabold",
  closeClassName: `${FOCUS} flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border-2 border-[var(--cg-ink)] bg-[var(--cg-card)] text-[20px] text-[var(--cg-ink)]`,
  DoneButton,
};

const seconds = (ms: number) => ms / 1000;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-2">
      <h3 className="m-0 font-[family-name:var(--font-fraunces)] text-[19px] font-extrabold">{title}</h3>
      {children}
    </section>
  );
}

const P = "m-0 text-[15px] leading-snug text-[var(--cg-ink-soft)] [&_b]:text-[var(--cg-ink)]";
const LIST = `${P} grid gap-1.5 pl-5 [&:is(ol)]:list-decimal [&:is(ul)]:list-disc`;

/** The squares a piece in the middle of a 5×5 board attacks, besides its row and column (which every puzzle rules out anyway). */
function attacked(piece: Piece, r: number, c: number): boolean {
  const dr = Math.abs(r - 2);
  const dc = Math.abs(c - 2);
  if (dr === 0 && dc === 0) return false;
  if (piece === "king") return dr <= 1 && dc <= 1;
  if (piece === "knight") return (dr === 1 && dc === 2) || (dr === 2 && dc === 1);
  if (piece === "bishop" || piece === "queen") return dr === dc;
  return false;
}

/** A 5×5 board: the piece in the middle, its row and column shaded, and a dot on every other square it attacks. */
function PieceBoard({ piece, label }: { piece: Piece; label: string }) {
  const cell = 18;
  return (
    <figure className="m-0 grid justify-items-center gap-1">
      <svg aria-hidden="true" viewBox={`0 0 ${cell * 5} ${cell * 5}`} className="h-[90px] w-[90px]">
        {Array.from({ length: 25 }, (_, i) => {
          const r = Math.floor(i / 5);
          const c = i % 5;
          const line = r === 2 || c === 2;
          return (
            <g key={i}>
              <rect x={c * cell} y={r * cell} width={cell} height={cell} fill={line ? "#d9ecdf" : (r + c) % 2 ? "#f3ebdd" : "#fffaf0"} stroke="#d8ccb6" strokeWidth={0.6} />
              {attacked(piece, r, c) ? <circle cx={c * cell + cell / 2} cy={r * cell + cell / 2} r={3.6} fill="#c62828" /> : null}
            </g>
          );
        })}
        <text x={2.5 * cell} y={2.5 * cell + 6} textAnchor="middle" fontSize={16} fill="#16261d">
          {GLYPH[piece]}
        </text>
      </svg>
      <figcaption className="text-[13px] font-bold">{label}</figcaption>
    </figure>
  );
}

function RulesContent() {
  return (
    <div className="grid gap-5">
      <Section title="The goal">
        <p className={P}>
          <b>Place one piece in every row, every column and every colour</b>, so that no piece attacks another by its chess moves. Fill the board without a clash and
          it&apos;s solved.
        </p>
      </Section>

      <Section title="Ways to play">
        <ul className={LIST}>
          <li>
            <b>Daily puzzle</b>: the same grid for everyone today, one try, your time on the day&apos;s leaderboard. A new one at midnight (Toronto time).
          </li>
          <li>
            <b>Endless</b>: pick a piece and a size ({MIN_SIZE}×{MIN_SIZE} to {MAX_SIZE}×{MAX_SIZE}), then Start. Your best time for each is kept on this device.
          </li>
          <li>
            <b>With others</b> (from the hub): everyone gets the same puzzles at the same time, in Challenge or Survival (below).
          </li>
        </ul>
      </Section>

      <Section title="Placing pieces">
        <ul className={LIST}>
          <li>
            <b>Tap a square</b> once for a ✕ (your note: no piece here), twice for a piece, a third time to clear it.
          </li>
          <li>Drag from an empty square to put a ✕ on every square you cross. On a keyboard: the arrows move, Enter or Space taps.</li>
          <li>Pieces that clash turn red. Undo takes back your last tap, Clear empties the board.</li>
          <li>
            <b>Auto ✕</b> shows a faint ✕ for a few seconds on every square your pieces already rule out. Then it rests for 30 seconds.
          </li>
        </ul>
      </Section>

      <Section title="The pieces">
        <div className="grid grid-cols-2 gap-3 rounded-xl bg-[var(--cg-paper)] p-3 min-[520px]:grid-cols-4">
          <PieceBoard piece="king" label="King" />
          <PieceBoard piece="knight" label="Knight" />
          <PieceBoard piece="queen" label="Queen" />
          <PieceBoard piece="bishop" label="Bishop" />
        </div>
        <ul className={LIST}>
          <li>Every piece already rules out its row and column (shaded). The dots are what it adds.</li>
          <li>
            <b>{GLYPH.rook} Rook</b>: nothing more, the easy level. <b>{GLYPH.king} King</b>: no two touching, not even at a corner. <b>{GLYPH.knight} Knight</b>: no
            two a knight&apos;s move apart. <b>{GLYPH.queen} Queen</b>: no two on the same diagonal, however far.
          </li>
          <li>
            <b>✦ Mix</b>: each colour shows its own piece (rook, king, knight or {GLYPH.bishop} bishop). The piece you place there must not attack another, nor be
            attacked.
          </li>
        </ul>
      </Section>

      <Section title="Racing others">
        <ul className={LIST}>
          <li>
            <b>Challenge</b>, {PLAYERS.challenge.min} to {PLAYERS.challenge.max} players: {ROUND_COUNTS.join(" or ")} puzzles, and the lowest total time wins. An unfinished
            puzzle counts as the slowest finish plus {seconds(DNF_EXTRA_MS)} s.
          </li>
          <li>
            <b>Survival</b>, {PLAYERS.survival.min} to {PLAYERS.survival.max} players: after each puzzle the slowest are out (two while more than 4 are left, then one),
            until one is left. At most {MAX_ROUNDS} puzzles.
          </li>
          <li>
            The host picks the mode and the pieces: one kind all game, or a new one each puzzle. The grid grows as you go, up to {MAX_SIZE}×{MAX_SIZE}. Matchmaking
            starts by itself.
          </li>
          <li>While you play, you see how many pieces the others have placed, never where.</li>
        </ul>
      </Section>

      <Section title="Time">
        <ul className={LIST}>
          <li>Solo: the clock runs from Start until you solve it.</li>
          <li>
            Races: a {seconds(COUNTDOWN_MS)}-second countdown, then {seconds(ROUND_MS) / 60} minutes per puzzle, and {seconds(RESULTS_MS)} seconds of results in between.
          </li>
        </ul>
      </Section>

      <Section title="Tips">
        <ul className={LIST}>
          <li>Start with the smallest colour: it has the fewest places to go.</li>
          <li>Placed a piece? ✕ its row, column and colour, and every square it attacks.</li>
          <li>If two colours fit only in the same two rows, no other colour can use those rows.</li>
        </ul>
      </Section>
    </div>
  );
}

/**
 * Checkmate Grid's How to play (docs/how-to-play.md, on the shared
 * components/HowToPlay.tsx): `variant` "icon" is the ? at the right of the
 * header (solo page and race rooms), "link" the race lobby's "How to play".
 */
export default function RulesButton({ variant = "icon" }: { variant?: "icon" | "link" }) {
  return (
    <HowToPlay look={LOOK} variant={variant}>
      <RulesContent />
    </HowToPlay>
  );
}
