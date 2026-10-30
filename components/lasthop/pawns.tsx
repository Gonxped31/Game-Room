import type { CSSProperties, ReactNode } from "react";
import type { Pawn } from "@/lib/games/lasthop/constants";

/**
 * The pawns, drawn flat in a 100x100 box (not emoji, so they look the same
 * on every device): a body in the player's colour, a hard shadow below in
 * its shade, and a face in ink where the pawn has one. Readable down to
 * ~14px; the board's direction chevron sits over the middle.
 */

const FACE = "var(--ink)";

/** The body's outline, used twice: once as the shadow, once on top. */
const BODY: Record<Pawn, ReactNode> = {
  square: <rect x="9" y="9" width="82" height="82" rx="22" />,
  circle: <circle cx="50" cy="50" r="44" />,
  frog: (
    <>
      <ellipse cx="50" cy="60" rx="44" ry="32" />
      <circle cx="27" cy="28" r="15" />
      <circle cx="73" cy="28" r="15" />
    </>
  ),
  bunny: (
    <>
      <ellipse cx="34" cy="26" rx="10" ry="24" />
      <ellipse cx="66" cy="26" rx="10" ry="24" />
      <circle cx="50" cy="62" r="34" />
    </>
  ),
  bear: (
    <>
      <circle cx="20" cy="24" r="15" />
      <circle cx="80" cy="24" r="15" />
      <circle cx="50" cy="56" r="38" />
    </>
  ),
  star: <path d="M50 4 L62 36 L96 37 L69 58 L79 92 L50 72 L21 92 L31 58 L4 37 L38 36 Z" strokeLinejoin="round" />,
  heart: <path d="M50 90 C22 70 6 52 6 33 C6 18 17 8 30 8 C39 8 46 13 50 21 C54 13 61 8 70 8 C83 8 94 18 94 33 C94 52 78 70 50 90 Z" />,
  ghost: <path d="M12 50 C12 25 29 8 50 8 C71 8 88 25 88 50 V90 L75 80 L63 90 L50 80 L37 90 L25 80 L12 90 Z" />,
};

/** Eyes, drawn over the body. */
const FACES: Partial<Record<Pawn, ReactNode>> = {
  frog: (
    <>
      <circle cx="27" cy="27" r="5.5" fill={FACE} />
      <circle cx="73" cy="27" r="5.5" fill={FACE} />
    </>
  ),
  bunny: (
    <>
      <circle cx="38" cy="54" r="4.5" fill={FACE} />
      <circle cx="62" cy="54" r="4.5" fill={FACE} />
    </>
  ),
  bear: (
    <>
      <circle cx="37" cy="46" r="4.5" fill={FACE} />
      <circle cx="63" cy="46" r="4.5" fill={FACE} />
    </>
  ),
  ghost: (
    <>
      <ellipse cx="37" cy="40" rx="5.5" ry="7.5" fill={FACE} />
      <ellipse cx="63" cy="40" rx="5.5" ry="7.5" fill={FACE} />
    </>
  ),
};

/** A pawn in `fill`, with an optional hard shadow in `shade` (on the board). */
export function PawnShape({ pawn, fill, shade, className, style }: { pawn: Pawn; fill: string; shade?: string; className?: string; style?: CSSProperties }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 100 100" className={className} style={style} overflow="visible">
      {shade ? (
        <g fill={shade} transform="translate(0 7)">
          {BODY[pawn]}
        </g>
      ) : null}
      <g fill={fill}>{BODY[pawn]}</g>
      {FACES[pawn]}
    </svg>
  );
}
