"use client";

import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import type { Role } from "@/lib/session/types";
import { CLOCKS } from "@/lib/games/lasthop/constants";
import type { Pawn } from "@/lib/games/lasthop/constants";
import { PawnShape } from "./pawns";
import { FOCUS, FONT, PrimaryButton, seatColor } from "./ui";

type Cell = "me" | "them" | "";

/** A game piece in the drawings: the viewer's pawn and colour for "me", the other player's for "them". */
function Piece({ x, y, size, seat, pawns }: { x: number; y: number; size: number; seat: Role; pawns: Record<Role, Pawn> }) {
  const s = size * 0.74;
  return (
    <svg x={x - s / 2} y={y - s / 2} width={s} height={s} viewBox="0 0 100 100" overflow="visible">
      <PawnShape pawn={pawns[seat]} fill={seatColor(seat)} />
    </svg>
  );
}

const CELL = 36;
const GAP = 6;
const PITCH = CELL + GAP;
const centre = (i: number) => i * PITCH + CELL / 2;

/**
 * One row of wells, as on the Track, with an arrow (or an arc, for a jump)
 * from the moving piece to where it lands, or a cross where it can't move.
 */
function Row({ cells, me, pawns, from, to, blocked }: { cells: Cell[]; me: Role; pawns: Record<Role, Pawn>; from?: number; to?: number; blocked?: number }) {
  const them: Role = me === "p1" ? "p2" : "p1";
  const w = cells.length * PITCH - GAP;
  const y = 30;
  const jump = from != null && to != null && Math.abs(from - to) === 2;
  return (
    <svg aria-hidden="true" viewBox={`0 0 ${w} 52`} className="h-[52px] max-w-full" style={{ width: w }}>
      {cells.map((c, i) => (
        <g key={i}>
          <rect x={i * PITCH} y={y - CELL / 2} width={CELL} height={CELL} rx={CELL * 0.3} fill="var(--well)" stroke={i === to ? "var(--target)" : "var(--well-rim)"} strokeWidth={2} strokeDasharray={i === to ? "4 3" : undefined} />
          {c ? <Piece x={centre(i)} y={y} size={CELL} seat={c === "me" ? me : them} pawns={pawns} /> : null}
        </g>
      ))}
      {from != null && to != null ? (
        jump ? (
          <path d={`M${centre(from)} ${y - 16} Q${(centre(from) + centre(to)) / 2} -6 ${centre(to)} ${y - 16}`} fill="none" stroke="var(--target)" strokeWidth={2.5} strokeLinecap="round" markerEnd="url(#lh-arrow)" />
        ) : (
          <path d={`M${centre(from) - 14} ${y} H${centre(to) + 8}`} fill="none" stroke="var(--target)" strokeWidth={2.5} strokeLinecap="round" markerEnd="url(#lh-arrow)" />
        )
      ) : null}
      {blocked != null ? <path d={`M${centre(blocked) - 9} ${y - 25} l8 8 m0 -8 l-8 8`} transform="translate(5 0)" stroke="var(--danger)" strokeWidth={3} strokeLinecap="round" /> : null}
    </svg>
  );
}

/** The Grid: your piece in the middle can go up or left. */
function GridPicture({ me, pawns }: { me: Role; pawns: Record<Role, Pawn> }) {
  const size = 3;
  const w = size * PITCH - GAP;
  return (
    <svg aria-hidden="true" viewBox={`-4 -4 ${w + 8} ${w + 8}`} className="h-[136px] w-[136px] shrink-0">
      {Array.from({ length: size * size }, (_, i) => {
        const x = (i % size) * PITCH;
        const y = Math.floor(i / size) * PITCH;
        const target = i === 1 || i === 3;
        return <rect key={i} x={x} y={y} width={CELL} height={CELL} rx={CELL * 0.3} fill="var(--well)" stroke={target ? "var(--target)" : "var(--well-rim)"} strokeWidth={2} strokeDasharray={target ? "4 3" : undefined} />;
      })}
      <Piece x={centre(1)} y={centre(1)} size={CELL} seat={me} pawns={pawns} />
      <path d={`M${centre(1)} ${centre(1) - 15} V${centre(0) + 8}`} stroke="var(--target)" strokeWidth={2.5} strokeLinecap="round" markerEnd="url(#lh-arrow)" />
      <path d={`M${centre(1) - 15} ${centre(1)} H${centre(0) + 8}`} stroke="var(--target)" strokeWidth={2.5} strokeLinecap="round" markerEnd="url(#lh-arrow)" />
    </svg>
  );
}

function Example({ title, children, picture }: { title: string; children: ReactNode; picture: ReactNode }) {
  return (
    <div className="grid gap-1.5 rounded-xl bg-[var(--surface-2)] p-3">
      <div className="flex justify-center">{picture}</div>
      <p className="m-0 text-[15px] leading-snug">
        <b>{title}</b> {children}
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-2">
      <h3 className={`${FONT} m-0 text-[18px] font-bold`}>{title}</h3>
      {children}
    </section>
  );
}

const LIST = "m-0 grid gap-1.5 pl-5 text-[15px] leading-snug text-[var(--muted)] [&_b]:text-[var(--text)]";

/** The rules, in full, with drawings in the viewer's own shape and colour. */
function RulesContent({ me, pawns }: { me: Role; pawns: Record<Role, Pawn> }) {
  return (
    <div className="grid gap-5">
      <Section title="The goal: make the last move">
        <p className="m-0 text-[15px] leading-snug text-[var(--muted)]">
          You take turns moving one of your pieces. <b className="text-[var(--text)]">If it&apos;s your turn and none of your pieces can move, you lose the round.</b> Getting across the
          board scores nothing: what counts is having a move left when your opponent doesn&apos;t.
        </p>
      </Section>

      <Section title="How pieces move">
        <p className="m-0 text-[15px] leading-snug text-[var(--muted)]">
          Pieces only go <b className="text-[var(--text)]">forward</b>, toward the other side. On your screen yours always start at the bottom (or right) and move up (or left).
        </p>
        <div className="grid gap-2 min-[560px]:grid-cols-3">
          <Example title="Slide." picture={<Row cells={["", "me"]} me={me} pawns={pawns} from={1} to={0} />}>
            One square forward, into an empty square.
          </Example>
          <Example title="Jump." picture={<Row cells={["", "them", "me"]} me={me} pawns={pawns} from={2} to={0} />}>
            Over exactly one of their pieces, into the empty square right behind it.
          </Example>
          <Example title="Blocked." picture={<Row cells={["them", "them", "me"]} me={me} pawns={pawns} blocked={2} />}>
            Nothing empty in front, and nothing empty behind the piece in front: this piece can&apos;t move.
          </Example>
        </div>
        <ul className={LIST}>
          <li>Never backward, never over your own pieces, never over two pieces at once.</li>
          <li>
            <b>Track</b>: one row, so each piece has one direction. <b>Grid</b>: each piece can go up <i>or</i> left (theirs go down or right), in a straight line: no
            diagonals.
          </li>
        </ul>
        <div className="flex items-center gap-3 rounded-xl bg-[var(--surface-2)] p-3">
          <GridPicture me={me} pawns={pawns} />
          <p className="m-0 text-[15px] leading-snug">
            <b>On the Grid</b>, this piece can slide up or left (theirs go down or right). Jumps work the same way, in a straight line.
          </p>
        </div>
      </Section>

      <Section title="How to win a round">
        <ul className={LIST}>
          <li>
            <b>Save your moves.</b> A piece at the far edge has nothing left to give. A slide spends one square of room, a jump two: when you can, take the patient move.
          </li>
          <li>
            <b>Take away theirs.</b> Park a piece right in front of one of theirs, with no empty square behind yours, and it can&apos;t slide or jump.
          </li>
          <li>
            <b>Count.</b> Under each name, &ldquo;moves available&rdquo; shows how many moves each side has right now. Watch theirs run out.
          </li>
          <li>
            <b>Mind the clock.</b> Each player has a chess clock: only the player to move uses time, and every move adds a little back (Track {CLOCKS.track.startMs / 60_000} min
            +{CLOCKS.track.incrementMs / 1000} s a move, Grid {CLOCKS.grid.startMs / 60_000} min +{CLOCKS.grid.incrementMs / 1000} s). Running out loses the round.
          </li>
        </ul>
      </Section>

      <Section title="How to win the match">
        <ul className={LIST}>
          <li>
            <b>Each board is played twice</b>, the second time with sides swapped, so you both get the same chances.
          </li>
          <li>
            The match ends once one player can&apos;t be caught: <b>at least 4 rounds</b> (3–0 ends it early). Level after 4, you play another board, and so on. Still level after
            10 rounds, it&apos;s a draw.
          </li>
          <li>
            <b>Pick your pawn</b> in the lobby or between matches (a frog, a ghost, a star…); the two of you can&apos;t have the same one. Your colour
            stays yours all match, whichever side you play.
          </li>
        </ul>
      </Section>
    </div>
  );
}

/**
 * "How to play": a button that opens the full rules in a modal <dialog>
 * (Escape, the backdrop or Close shuts it). `variant` "icon" is the header's
 * round ? button, "link" a text button for the lobby.
 */
export default function RulesButton({ me, pawns, variant = "icon" }: { me: Role | null; pawns: Record<Role, Pawn>; variant?: "icon" | "link" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          aria-label="How to play"
          title="How to play"
          onClick={() => setOpen(true)}
          className={`${FONT} flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-[var(--well-rim)] bg-[var(--surface)] text-[18px] font-bold text-[var(--text)] ${FOCUS}`}
        >
          ?
        </button>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className={`cursor-pointer border-0 bg-transparent p-0 text-[15px] font-bold text-[var(--p1)] underline ${FOCUS}`}>
          Read the full rules
        </button>
      )}
      {open ? <RulesDialog me={me ?? "p1"} pawns={pawns} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function RulesDialog({ me, pawns, onClose }: { me: Role; pawns: Record<Role, Pawn>; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    // Focus the rules themselves (showModal picks Close), so they scroll with the keyboard.
    body.current?.focus();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="m-auto max-h-[min(88dvh,820px)] w-[min(40rem,calc(100%-2rem))] max-w-none overflow-hidden rounded-2xl border-0 bg-transparent p-0 backdrop:bg-black/60"
    >
      <div className={`${FONT} flex max-h-[min(88dvh,820px)] flex-col bg-[var(--surface)] text-[var(--text)]`}>
        <svg aria-hidden="true" width="0" height="0" className="absolute">
          <defs>
            <marker id="lh-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M0 0L10 5L0 10z" fill="var(--target)" />
            </marker>
          </defs>
        </svg>
        <div className="flex items-center justify-between gap-3 border-b-2 border-[var(--well)] px-5 py-3.5">
          <h2 id={titleId} className="m-0 text-[22px] font-extrabold">
            How to play
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-0 bg-[var(--surface-2)] text-[20px] text-[var(--text)] ${FOCUS}`}
          >
            ×
          </button>
        </div>
        <div ref={body} tabIndex={-1} className="overflow-y-auto px-5 py-4 outline-none">
          <RulesContent me={me} pawns={pawns} />
          <PrimaryButton className="mt-5" onClick={onClose}>
            Got it
          </PrimaryButton>
        </div>
      </div>
    </dialog>
  );
}
