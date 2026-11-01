"use client";

import type { CSSProperties, ReactNode } from "react";
import GameArt from "@/components/gameRoom/HubArt";
import type { GameEntry } from "@/lib/games/registry";

/** On white cards: a 3px black focus outline (references/game-room/game-room-ui-spec.md, "Accessibility"). */
const FOCUS_RING = "focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-black";

/** Hover or keyboard focus anywhere in the card lifts it 6px; `motion-reduce:` turns that off. */
const LIFT = "transition-transform duration-150 ease-out hover:-translate-y-1.5 focus-within:-translate-y-1.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:focus-within:translate-y-0";

/** A hard 4px shadow in the button's border color (the game's ink), so `active:shadow-none` can drop it. */
const SHADOW = "shadow-[0_4px_0_currentColor]";

/** Buttons press down 4px and lose their shadow. */
const PRESS = "transition-transform duration-[60ms] enabled:active:translate-y-1 enabled:active:shadow-none motion-reduce:transition-none";
const PRESS_LINK = "transition-transform duration-[60ms] active:translate-y-1 active:shadow-none motion-reduce:transition-none";

/**
 * The hub's cards are parallelograms leaning 14deg (Hub's CardGrid has the
 * layout). `SLANT` leans a box; `UPRIGHT` (inline) and `UPRIGHT_BLOCK` lean
 * its content back, so text and art stay straight. On the desktop card the
 * whole card leans, and the buttons and chips in it lean with it; on the
 * compact (mobile) card, which stays upright, they lean on their own. The
 * press and lift use `translate`, a separate property, so they still compose.
 */
const SLANT = "-skew-x-14";
const UPRIGHT = "inline-block skew-x-14";
const UPRIGHT_BLOCK = "skew-x-14";

/** Desktop buttons lean with their card; mobile ones lean on their own. */
const buttonSize = (size: "desktop" | "mobile") => (size === "desktop" ? "h-12 text-[17px]" : `${SLANT} h-12 text-[17px]`);

interface GameCardProps {
  game: GameEntry;
  /** Which game's Start is in progress, if any - every Start is disabled meanwhile, to prevent double rooms. */
  startingSlug: string | null;
  /** Whether this card's join panel is open (for aria-expanded). */
  joinOpen: boolean;
  /** Whether this card's Start panel is open (a game with modes asks which first). */
  startOpen?: boolean;
  onStart: (slug: string, button: HTMLButtonElement) => void;
  onJoin: (slug: string, button: HTMLButtonElement) => void;
  /** Games strangers can be matched into get a third button, "Matchmaking" (docs/matchmaking.md). */
  onMatchmaking?: (slug: string, button: HTMLButtonElement) => void;
  /** Whether this card's Matchmaking panel is open (for aria-expanded). */
  matchmakingOpen?: boolean;
}

/** The tags, as small parallelograms: leaning with the card, or on their own (`lean`) on the upright compact card. */
function Chips({ game, tags, className, lean = false }: { game: GameEntry; tags: string[]; className: string; lean?: boolean }) {
  return (
    <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0 pl-1">
      {tags.map((tag) => (
        <li key={tag} className={`${lean ? SLANT : ""} rounded-[6px] border-2 px-[11px] py-0.5 font-bold ${className}`} style={{ borderColor: game.ink, color: game.ink }}>
          <span className={UPRIGHT}>{tag}</span>
        </li>
      ))}
    </ul>
  );
}

/** Start (accent fill) and Join (white), side by side. */
function StartJoin({
  game,
  startingSlug,
  joinOpen,
  startOpen = false,
  onStart,
  onJoin,
  size,
  className = "",
}: GameCardProps & { size: "desktop" | "mobile"; className?: string }) {
  const starting = startingSlug === game.slug;
  const base = `flex flex-1 cursor-pointer items-center justify-center rounded-[12px] border-2 disabled:cursor-not-allowed ${PRESS} ${FOCUS_RING} ${game.titleClassName} ${buttonSize(size)}`;
  return (
    <div className={`flex gap-2.5 ${className}`}>
      <button
        type="button"
        aria-label={`Start a ${game.title} room`}
        aria-haspopup={game.modes ? "dialog" : undefined}
        aria-expanded={game.modes ? startOpen : undefined}
        disabled={startingSlug != null}
        onClick={(e) => onStart(game.slug, e.currentTarget)}
        className={`${base} disabled:opacity-80 ${starting ? "" : SHADOW}`}
        style={{
          backgroundColor: game.accentColor,
          borderColor: game.ink,
          color: game.ink,
          cursor: starting ? "progress" : undefined,
        }}
      >
        <span className={UPRIGHT}>{starting ? "Starting…" : "Start"}</span>
      </button>
      <button
        type="button"
        aria-label={`Join a ${game.title} room`}
        aria-haspopup="dialog"
        aria-expanded={joinOpen}
        onClick={(e) => onJoin(game.slug, e.currentTarget)}
        className={`${base} bg-white ${SHADOW}`}
        style={{ borderColor: game.ink, color: game.ink }}
      >
        <span className={UPRIGHT}>Join</span>
      </button>
    </div>
  );
}

function GlobeIcon() {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
      <circle cx="10" cy="10" r="8" />
      <path d="M2 10h16M10 2c2.5 2.4 3.5 5 3.5 8s-1 5.6-3.5 8c-2.5-2.4-3.5-5-3.5-8s1-5.6 3.5-8Z" />
    </svg>
  );
}

/** "Matchmaking": under Start + Join (or beside them when there's room), ink fill with an accent shadow. */
function Matchmaking({
  game,
  onMatchmaking,
  matchmakingOpen = false,
  size,
  className = "w-full",
}: GameCardProps & { size: "desktop" | "mobile"; className?: string }) {
  if (!onMatchmaking) return null;
  return (
    <button
      type="button"
      aria-label={`Matchmaking for ${game.title}: play with other players`}
      aria-haspopup="dialog"
      aria-expanded={matchmakingOpen}
      onClick={(e) => onMatchmaking(game.slug, e.currentTarget)}
      className={`flex ${className} cursor-pointer items-center justify-center rounded-[12px] border-2 text-white shadow-[0_4px_0_var(--accent)] ${PRESS} ${FOCUS_RING} ${game.titleClassName} ${buttonSize(size)}`}
      style={{ backgroundColor: game.ink, borderColor: game.ink, "--accent": game.accentColor } as CSSProperties}
    >
      <span className={`${UPRIGHT_BLOCK} inline-flex items-center gap-2`}>
        <GlobeIcon />
        Matchmaking
      </span>
    </button>
  );
}

/** "Play solo": a plain link to the solo page (no room, no invite). */
function PlaySolo({ game, path, size }: { game: GameEntry; path: string; size: "desktop" | "mobile" }) {
  return (
    <a
      href={path}
      aria-label={`Play ${game.title} solo`}
      className={`flex w-full items-center justify-center rounded-[12px] border-2 no-underline ${SHADOW} ${PRESS_LINK} ${FOCUS_RING} ${game.titleClassName} ${buttonSize(size)}`}
      style={{ backgroundColor: game.accentColor, borderColor: game.ink, color: game.ink }}
    >
      <span className={UPRIGHT}>Play solo</span>
    </a>
  );
}

/**
 * One game's card in the Social folder (references/game-room/game-room-ui-spec.md,
 * "Game card"): the parallelogram desktop card (art, title, description,
 * chips, Start + Join, and Matchmaking for games strangers can play) from
 * 760px, the compact card (mini art beside the text) below. Both are in the
 * DOM; CSS shows one.
 */
export default function GameCard(props: GameCardProps) {
  const { game } = props;
  return (
    <>
      <SlantCard game={game} description={game.description} tags={game.tags}>
        {/* One row when the text column has room (about 380px), else Matchmaking goes under Start + Join. */}
        <div className="flex flex-wrap gap-2.5">
          <StartJoin {...props} size="desktop" className="flex-[2_1_200px]" />
          <Matchmaking {...props} size="desktop" className="flex-[1_1_170px]" />
        </div>
      </SlantCard>
      <CompactCard game={game} description={game.shortDescription} chip={game.tags[0]}>
        <StartJoin {...props} size="mobile" />
        <Matchmaking {...props} size="mobile" />
      </CompactCard>
    </>
  );
}

const CARD_SHADOW = "shadow-[0_5px_0_rgba(0,0,0,.25),0_14px_26px_rgba(0,0,0,.2)]";

/**
 * The desktop card (from 760px): a parallelogram, art on the left (the
 * square mini art, bleeding to the card's edges, its right edge slanted
 * too), then the title, description, chips and the buttons (`children`).
 * It must sit in Hub's CardGrid (an `@container`), which sets its width:
 * - from a 1530px-wide grid: a third of the row. The grid leans as a whole,
 *   so the card doesn't lean itself;
 * - from 980px: half the row; below, the whole row (at most 600px). Each card
 *   leans on its own.
 */
function SlantCard({ game, description, tags, children }: { game: GameEntry; description: string; tags: string[]; children: ReactNode }) {
  return (
    <article
      className={`hidden min-w-0 max-w-[600px] shrink-0 grow-0 basis-full overflow-hidden rounded-[14px] bg-white ${CARD_SHADOW} min-[760px]:flex @min-[980px]:max-w-none @min-[980px]:basis-[calc((100%-28px)/2)] @min-[1530px]:basis-[calc((100%-56px)/3)] @max-[1530px]:-skew-x-14 ${LIFT}`}
    >
      <div aria-hidden="true" className="relative w-[38%] max-w-[220px] shrink-0 overflow-hidden">
        {/* Upright, and wider than the panel, so it fills the slanted corners. */}
        <div className={`absolute inset-y-0 -inset-x-10 ${UPRIGHT_BLOCK}`}>
          <GameArt slug={game.slug} mini />
        </div>
      </div>
      <div className={`flex min-w-0 flex-1 flex-col gap-2 py-4 pr-6 pl-5 ${game.bodyClassName}`}>
        <h4 className={`m-0 ${UPRIGHT_BLOCK} text-[24px] leading-[1.05] ${game.titleClassName}`} style={{ color: game.ink }}>
          {game.title}
        </h4>
        <p className={`m-0 ${UPRIGHT_BLOCK} text-[14px] font-medium leading-[1.4]`} style={{ color: game.textSecondary }}>
          {description}
        </p>
        <Chips game={game} tags={tags} className="text-[12px]" />
        <div className="mt-auto pt-1.5">{children}</div>
      </div>
    </article>
  );
}

function CompactCard({ game, description, chip, children }: { game: GameEntry; description: string; chip: string; children: ReactNode }) {
  return (
    <article className={`flex flex-col gap-3 rounded-[18px] bg-white px-2.5 pt-2.5 pb-3.5 shadow-[0_4px_0_rgba(0,0,0,.22)] min-[760px]:hidden ${LIFT}`}>
      <div className="flex items-start gap-3">
        <div aria-hidden="true" className="h-[92px] w-[92px] shrink-0 overflow-hidden rounded-xl">
          <GameArt slug={game.slug} mini />
        </div>
        <div className={`flex min-w-0 flex-col gap-1.5 ${game.bodyClassName}`}>
          <h4 className={`m-0 text-[22px] leading-[1.05] ${game.titleClassName}`} style={{ color: game.ink }}>
            {game.title}
          </h4>
          <p className="m-0 line-clamp-2 text-sm font-medium leading-[1.35]" style={{ color: game.textSecondary }}>
            {description}
          </p>
          <Chips game={game} tags={[chip]} className="text-xs" lean />
        </div>
      </div>
      {children}
    </article>
  );
}

/**
 * A game's card in the Solo folder, in Hub's card grid like the Social cards:
 * the parallelogram desktop card with one "Play solo" button, or the compact
 * card on mobile.
 */
export function SoloCard({ game }: { game: GameEntry }) {
  const solo = game.solo;
  if (!solo) return null;
  return (
    <>
      <SlantCard game={game} description={solo.description} tags={solo.tags}>
        <PlaySolo game={game} path={solo.path} size="desktop" />
      </SlantCard>
      <CompactCard game={game} description={solo.description} chip={solo.tags[0]}>
        <PlaySolo game={game} path={solo.path} size="mobile" />
      </CompactCard>
    </>
  );
}
