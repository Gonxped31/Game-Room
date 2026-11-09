"use client";

import type { ReactNode } from "react";
import HowToPlay, { type HowToPlayLook } from "@/components/HowToPlay";
import { texts } from "@/lib/i18n/text";
import { useText } from "@/lib/i18n/useLang";
import type { Role } from "@/lib/session/types";
import { CLOCKS } from "@/lib/games/lasthop/constants";
import type { Pawn } from "@/lib/games/lasthop/constants";
import { PawnShape } from "./pawns";
import { TEXT } from "./text";
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

function Section({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <section className="grid gap-2">
      <h3 className={`${FONT} m-0 text-[18px] font-bold`}>{title}</h3>
      {children}
    </section>
  );
}

const LIST = "m-0 grid gap-1.5 pl-5 [&:is(ol)]:list-decimal [&:is(ul)]:list-disc text-[15px] leading-snug text-[var(--muted)] [&_b]:text-[var(--text)]";
const STRONG = "text-[var(--text)]";
const { track: TRACK, grid: GRID } = CLOCKS;

/**
 * How to play's words, English and French (docs/i18n.md). Rich text, so the
 * values are elements; the lists are rendered in order. The clocks come from
 * `CLOCKS`, the "moves available" quote matches the player bars (text.ts).
 */
const RULES = texts({
  en: {
    goalTitle: "The goal: make the last move" as ReactNode,
    goal: (
      <>
        You take turns moving one of your pieces. <b className={STRONG}>If it&apos;s your turn and none of your pieces can move, you lose the round.</b> Getting across the board
        scores nothing: what counts is having a move left when your opponent doesn&apos;t.
      </>
    ) as ReactNode,
    movesTitle: "How pieces move" as ReactNode,
    moves: (
      <>
        Pieces only go <b className={STRONG}>forward</b>, toward the other side. On your screen yours always start at the bottom (or right) and move up (or left).
      </>
    ) as ReactNode,
    slideTitle: "Slide.",
    slide: "One square forward, into an empty square." as ReactNode,
    jumpTitle: "Jump.",
    jump: "Over exactly one of their pieces, into the empty square right behind it." as ReactNode,
    blockedTitle: "Blocked.",
    blocked: "Nothing empty in front, and nothing empty behind the piece in front: this piece can't move." as ReactNode,
    moveList: [
      "Never backward, never over your own pieces, never over two pieces at once.",
      <>
        <b>Track</b>: one row, so each piece has one direction. <b>Grid</b>: each piece can go up <i>or</i> left (theirs go down or right), in a straight line: no diagonals.
      </>,
    ] as ReactNode[],
    grid: (
      <>
        <b>On the Grid</b>, this piece can slide up or left (theirs go down or right). Jumps work the same way, in a straight line.
      </>
    ) as ReactNode,
    roundTitle: "How to win a round" as ReactNode,
    roundList: [
      <>
        <b>Save your moves.</b> A piece at the far edge has nothing left to give. A slide spends one square of room, a jump two: when you can, take the patient move.
      </>,
      <>
        <b>Take away theirs.</b> Park a piece right in front of one of theirs, with no empty square behind yours, and it can&apos;t slide or jump.
      </>,
      <>
        <b>Count.</b> Under each name, &ldquo;moves available&rdquo; shows how many moves each side has right now. Watch theirs run out.
      </>,
      <>
        <b>Mind the clock.</b> Each player has a chess clock: only the player to move uses time, and every move adds a little back (Track {TRACK.startMs / 60_000} min +
        {TRACK.incrementMs / 1000} s a move, Grid {GRID.startMs / 60_000} min +{GRID.incrementMs / 1000} s). Running out loses the round.
      </>,
    ] as ReactNode[],
    matchTitle: "How to win the match" as ReactNode,
    matchList: [
      <>
        <b>Each board is played twice</b>, the second time with sides swapped, so you both get the same chances.
      </>,
      <>
        The match ends once one player can&apos;t be caught: <b>at least 4 rounds</b> (3–0 ends it early). Level after 4, you play another board, and so on. Still level after 10
        rounds, it&apos;s a draw.
      </>,
      <>
        <b>Pick your pawn</b> in the lobby or between matches (a frog, a ghost, a star…); the two of you can&apos;t have the same one. Your colour stays yours all match, whichever
        side you play.
      </>,
    ] as ReactNode[],
  },
  fr: {
    goalTitle: <>Le but&nbsp;: jouer le dernier coup</>,
    goal: (
      <>
        Chacun son tour, tu déplaces un de tes pions. <b className={STRONG}>Si c&apos;est ton tour et qu&apos;aucun de tes pions ne peut bouger, tu perds la manche.</b> Traverser
        le plateau ne rapporte rien&nbsp;: ce qui compte, c&apos;est d&apos;avoir encore un coup à jouer quand ton adversaire n&apos;en a plus.
      </>
    ),
    movesTitle: "Comment bougent les pions",
    moves: (
      <>
        Les pions ne vont que <b className={STRONG}>vers l&apos;avant</b>, vers le camp d&apos;en face. Sur ton écran, les tiens partent toujours du bas (ou de la droite) et
        montent (ou vont vers la gauche).
      </>
    ),
    slideTitle: "Glisser.",
    slide: "D'une case vers l'avant, dans une case vide.",
    jumpTitle: "Sauter.",
    jump: "Par-dessus un seul pion adverse, dans la case vide juste derrière.",
    blockedTitle: "Bloqué.",
    blocked: <>Pas de case vide devant, ni derrière le pion d&apos;en face&nbsp;: ce pion ne peut pas bouger.</>,
    moveList: [
      "Jamais en arrière, jamais par-dessus tes propres pions, jamais par-dessus deux pions à la fois.",
      <>
        <b>Piste</b>&nbsp;: une seule rangée, donc chaque pion n&apos;a qu&apos;une direction. <b>Grille</b>&nbsp;: chaque pion peut monter <i>ou</i> aller à gauche (ceux
        d&apos;en face descendent ou vont à droite), en ligne droite&nbsp;: pas de diagonale.
      </>,
    ],
    grid: (
      <>
        <b>Sur la Grille</b>, ce pion peut glisser vers le haut ou vers la gauche (ceux d&apos;en face, vers le bas ou la droite). Les sauts marchent pareil, en ligne droite.
      </>
    ),
    roundTitle: "Comment gagner une manche",
    roundList: [
      <>
        <b>Économise tes coups.</b> Un pion arrivé au bout n&apos;a plus rien à offrir. Une glissade use une case d&apos;avance, un saut deux&nbsp;: quand tu peux, joue le coup
        patient.
      </>,
      <>
        <b>Bloque les siens.</b> Place un de tes pions juste devant un des siens, sans case vide derrière le tien&nbsp;: il ne peut plus ni glisser ni sauter.
      </>,
      <>
        <b>Compte.</b> Sous chaque nom, «&nbsp;coups possibles&nbsp;» indique combien de coups chaque camp a en ce moment. Regarde ceux d&apos;en face fondre.
      </>,
      <>
        <b>Surveille le chrono.</b> Chaque joueur a son chrono, comme aux échecs&nbsp;: seul celui du joueur qui doit jouer tourne, et chaque coup rajoute un peu de temps
        (Piste {TRACK.startMs / 60_000}&nbsp;min +{TRACK.incrementMs / 1000}&nbsp;s par coup, Grille {GRID.startMs / 60_000}&nbsp;min +{GRID.incrementMs / 1000}&nbsp;s). Tomber à
        zéro fait perdre la manche.
      </>,
    ],
    matchTitle: "Comment gagner la partie",
    matchList: [
      <>
        <b>Chaque plateau se joue deux fois</b>, la seconde en échangeant les côtés&nbsp;: vous avez donc les mêmes chances.
      </>,
      <>
        La partie se termine dès qu&apos;un joueur ne peut plus être rattrapé&nbsp;: <b>au moins 4 manches</b> (un 3–0 y met fin plus tôt). À égalité après 4, vous jouez un autre
        plateau, et ainsi de suite. Toujours à égalité après 10 manches&nbsp;: partie nulle.
      </>,
      <>
        <b>Choisis ton pion</b> dans la salle d&apos;attente ou entre deux parties (une grenouille, un fantôme, une étoile…)&#8239;; vous ne pouvez pas avoir le même. Ta couleur
        reste la tienne toute la partie, quel que soit ton côté.
      </>,
    ],
  },
});

/** The rules, in full, with drawings in the viewer's own shape and colour. */
function RulesContent({ me, pawns }: { me: Role; pawns: Record<Role, Pawn> }) {
  const r = useText(RULES);
  return (
    <div className="grid gap-5">
      <Section title={r.goalTitle}>
        <p className="m-0 text-[15px] leading-snug text-[var(--muted)]">{r.goal}</p>
      </Section>

      <Section title={r.movesTitle}>
        <p className="m-0 text-[15px] leading-snug text-[var(--muted)]">{r.moves}</p>
        <div className="grid gap-2 min-[560px]:grid-cols-3">
          <Example title={r.slideTitle} picture={<Row cells={["", "me"]} me={me} pawns={pawns} from={1} to={0} />}>
            {r.slide}
          </Example>
          <Example title={r.jumpTitle} picture={<Row cells={["", "them", "me"]} me={me} pawns={pawns} from={2} to={0} />}>
            {r.jump}
          </Example>
          <Example title={r.blockedTitle} picture={<Row cells={["them", "them", "me"]} me={me} pawns={pawns} blocked={2} />}>
            {r.blocked}
          </Example>
        </div>
        <ul className={LIST}>
          {r.moveList.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
        <div className="flex items-center gap-3 rounded-xl bg-[var(--surface-2)] p-3">
          <GridPicture me={me} pawns={pawns} />
          <p className="m-0 text-[15px] leading-snug">{r.grid}</p>
        </div>
      </Section>

      <Section title={r.roundTitle}>
        <ul className={LIST}>
          {r.roundList.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </Section>

      <Section title={r.matchTitle}>
        <ul className={LIST}>
          {r.matchList.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

/** Last Hop's look for the shared dialog: the violet surface, Rubik, the tangerine "Got it". */
const LOOK: HowToPlayLook = {
  iconClassName: `${FONT} flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-[var(--well-rim)] bg-[var(--surface)] text-[18px] font-bold text-[var(--text)] ${FOCUS}`,
  linkClassName: `cursor-pointer border-0 bg-transparent p-0 text-[15px] font-bold text-[var(--p1)] underline ${FOCUS}`,
  panelClassName: `${FONT} bg-[var(--surface)] text-[var(--text)]`,
  headerClassName: "border-b-2 border-[var(--well)]",
  titleClassName: "text-[22px] font-extrabold",
  closeClassName: `flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-0 bg-[var(--surface-2)] text-[20px] text-[var(--text)] ${FOCUS}`,
  DoneButton: PrimaryButton,
};

/**
 * "How to play" (docs/how-to-play.md, on the shared components/HowToPlay.tsx):
 * `variant` "icon" is the header's round ? button, "link" the lobby's "Read
 * the full rules". The drawings use the viewer's own pawn and colour.
 */
export default function RulesButton({ me, pawns, variant = "icon" }: { me: Role | null; pawns: Record<Role, Pawn>; variant?: "icon" | "link" }) {
  const t = useText(TEXT);
  return (
    <HowToPlay look={LOOK} variant={variant} label={t.readRules}>
      <svg aria-hidden="true" width="0" height="0" className="absolute">
        <defs>
          <marker id="lh-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0 0L10 5L0 10z" fill="var(--target)" />
          </marker>
        </defs>
      </svg>
      <RulesContent me={me ?? "p1"} pawns={pawns} />
    </HowToPlay>
  );
}
