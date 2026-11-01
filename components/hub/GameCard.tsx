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
 * Buttons and chips are parallelograms: the box leans 10deg (`SLANT`), its
 * content leans back (`UPRIGHT`), so the text stays straight. The press and
 * lift use `translate`, a separate property, so they still compose.
 */
const SLANT = "-skew-x-10";
const UPRIGHT = "inline-block skew-x-10";

/**
 * The art's slanted edge, leaning like the buttons: the wide card's art ends
 * in a diagonal toward the text (24px across its 190px height); the 300px
 * card's art has a gently rising bottom edge (14px across its width).
 */
const ART_SEAM_WIDE = "[clip-path:polygon(0_0,100%_0,calc(100%_-_24px)_100%,0_100%)]";
const ART_SEAM_TALL = "[clip-path:polygon(0_0,100%_0,100%_calc(100%_-_14px),0_100%)]";

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

/** A computer screen: the "Best on a computer" tag and notice. */
function ComputerIcon() {
  return (
    <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
}

/**
 * The tags, as outlined parallelograms; a game that plays best on a computer
 * (`bestOnComputer`) adds a filled one, unless `computer` is off (the compact
 * card spells it out in a notice instead).
 */
function Chips({ game, tags, className, computer = true }: { game: GameEntry; tags: string[]; className: string; computer?: boolean }) {
  return (
    <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0 pl-0.5">
      {tags.map((tag) => (
        <li key={tag} className={`${SLANT} rounded-[6px] border-2 px-[11px] py-0.5 font-bold ${className}`} style={{ borderColor: game.ink, color: game.ink }}>
          <span className={UPRIGHT}>{tag}</span>
        </li>
      ))}
      {computer && game.bestOnComputer ? (
        <li className={`${SLANT} rounded-[6px] border-2 px-[11px] py-0.5 font-bold ${className}`} style={{ borderColor: game.ink, backgroundColor: game.ink, color: "#FFFFFF" }}>
          <span className="inline-flex skew-x-10 items-center gap-1.5">
            <ComputerIcon />
            Best on a computer
          </span>
        </li>
      ) : null}
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
  const base = `flex flex-1 cursor-pointer items-center justify-center ${SLANT} rounded-[12px] border-2 disabled:cursor-not-allowed ${PRESS} ${FOCUS_RING} ${game.titleClassName} ${
    size === "desktop" ? "h-[50px] text-[18px]" : "h-12 text-[17px]"
  }`;
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

/** "Matchmaking": full width under Start + Join (or beside them on the wide card), ink fill with an accent shadow. */
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
      className={`flex ${className} cursor-pointer items-center justify-center ${SLANT} rounded-[12px] border-2 text-white shadow-[0_4px_0_var(--accent)] ${PRESS} ${FOCUS_RING} ${game.titleClassName} ${
        size === "desktop" ? "h-[50px] text-[18px]" : "h-12 text-[17px]"
      }`}
      style={{ backgroundColor: game.ink, borderColor: game.ink, "--accent": game.accentColor } as CSSProperties}
    >
      <span className="inline-flex skew-x-10 items-center gap-2">
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
      className={`flex w-full items-center justify-center ${SLANT} rounded-[12px] border-2 no-underline ${SHADOW} ${PRESS_LINK} ${FOCUS_RING} ${game.titleClassName} ${size === "desktop" ? "h-[50px] text-[18px]" : "h-12 text-[17px]"}`}
      style={{ backgroundColor: game.accentColor, borderColor: game.ink, color: game.ink }}
    >
      <span className={UPRIGHT}>Play solo</span>
    </a>
  );
}

/**
 * One game's card in a Social folder (references/game-room/game-room-ui-spec.md,
 * "Game card"): the 300px desktop card (art panel, title, description, chips,
 * Start + Join, and Matchmaking for games strangers can play) from 760px, the compact card (mini art beside the text) below.
 * From a 1300px-wide container, the wide card takes the 300px card's place,
 * so it must sit inside an `@container` (Hub's CardGrid, the Talk it out
 * panel). All are in the DOM; CSS shows one.
 */
export default function GameCard(props: GameCardProps) {
  const { game } = props;
  const text = { game, description: game.description, tags: game.tags };
  return (
    <>
      <TallCard {...text}>
        <div className="flex flex-col gap-2.5">
          <StartJoin {...props} size="desktop" />
          <Matchmaking {...props} size="desktop" />
        </div>
      </TallCard>
      <WideCard {...text}>
        {/* One row when the text column has room (about 410px), else Matchmaking goes under Start + Join. */}
        <div className="flex flex-wrap gap-2.5">
          <StartJoin {...props} size="desktop" className="flex-[2_1_220px]" />
          <Matchmaking {...props} size="desktop" className="flex-[1_1_180px]" />
        </div>
      </WideCard>
      <CompactCard game={game} description={game.shortDescription} chip={game.tags[0]}>
        <StartJoin {...props} size="mobile" />
        <Matchmaking {...props} size="mobile" />
      </CompactCard>
    </>
  );
}

const CARD_SHADOW = "shadow-[0_5px_0_rgba(0,0,0,.25),0_14px_26px_rgba(0,0,0,.2)]";

type CardText = { game: GameEntry; description: string; tags: string[]; children: ReactNode };

/**
 * The 300px desktop card, below a 1300px-wide container (the wide card takes
 * over from it): art on top, then the title, description, chips and the
 * buttons (`children`).
 */
function TallCard({ game, description, tags, children }: CardText) {
  return (
    <article className={`hidden w-[300px] flex-col rounded-[20px] bg-white px-2.5 pt-2.5 pb-[18px] ${CARD_SHADOW} min-[760px]:@max-[1300px]:flex ${LIFT}`}>
      <div aria-hidden="true" className={`h-[168px] shrink-0 overflow-hidden rounded-xl ${ART_SEAM_TALL}`}>
        <GameArt slug={game.slug} />
      </div>
      <div className={`flex flex-1 flex-col gap-2.5 px-2 pt-4 ${game.bodyClassName}`}>
        <h4 className={`m-0 text-[28px] leading-[1.05] ${game.titleClassName}`} style={{ color: game.ink }}>
          {game.title}
        </h4>
        <p className="m-0 min-h-[63px] text-[15px] font-medium leading-[1.4]" style={{ color: game.textSecondary }}>
          {description}
        </p>
        <Chips game={game} tags={tags} className="text-[13px]" />
        <div className="mt-auto pt-1.5">{children}</div>
      </div>
    </article>
  );
}

/**
 * The wide desktop card, from a 1300px-wide card grid: art on the left; the
 * title, description, chips and buttons (`children`) on the right. Half the
 * row, less the 28px gap, so two fill it; a card alone on its row is centered.
 */
function WideCard({ game, description, tags, children }: CardText) {
  return (
    <article className={`hidden max-w-[calc(50%-14px)] grow basis-[calc(50%-28px)] gap-5 rounded-[20px] bg-white p-2.5 ${CARD_SHADOW} @min-[1300px]:flex ${LIFT}`}>
      <div aria-hidden="true" className={`h-[190px] w-[290px] shrink-0 overflow-hidden rounded-xl ${ART_SEAM_WIDE}`}>
        <GameArt slug={game.slug} />
      </div>
      <div className={`flex min-w-0 flex-1 flex-col gap-2.5 py-2 pr-2.5 ${game.bodyClassName}`}>
        <h4 className={`m-0 text-[28px] leading-[1.05] ${game.titleClassName}`} style={{ color: game.ink }}>
          {game.title}
        </h4>
        <p className="m-0 text-[15px] font-medium leading-[1.4]" style={{ color: game.textSecondary }}>
          {description}
        </p>
        <Chips game={game} tags={tags} className="text-[13px]" />
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
          <Chips game={game} tags={[chip]} className="text-xs" computer={false} />
        </div>
      </div>
      {game.bestOnComputer ? (
        <p className={`m-0 flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-semibold leading-snug ${game.bodyClassName}`} style={{ backgroundColor: "#FFF1C7", color: "#5C3A00" }}>
          <ComputerIcon />
          <span>
            <b>Best on a computer.</b> On a phone it may lag.
          </span>
        </p>
      ) : null}
      {children}
    </article>
  );
}

/**
 * A game's card in the Solo folder, in Hub's card grid like the Social cards:
 * the 300px card or the wide card (both with one "Play solo" button), or the
 * compact card on mobile.
 */
export function SoloCard({ game }: { game: GameEntry }) {
  const solo = game.solo;
  if (!solo) return null;
  const text = { game, description: solo.description, tags: solo.tags };
  return (
    <>
      <TallCard {...text}>
        <PlaySolo game={game} path={solo.path} size="desktop" />
      </TallCard>
      <WideCard {...text}>
        <PlaySolo game={game} path={solo.path} size="desktop" />
      </WideCard>
      <CompactCard game={game} description={solo.description} chip={solo.tags[0]}>
        <PlaySolo game={game} path={solo.path} size="mobile" />
      </CompactCard>
    </>
  );
}
