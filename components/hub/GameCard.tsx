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

function Chips({ game, tags, className }: { game: GameEntry; tags: string[]; className: string }) {
  return (
    <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
      {tags.map((tag) => (
        <li key={tag} className={`rounded-full border-2 px-[11px] py-0.5 font-bold ${className}`} style={{ borderColor: game.ink, color: game.ink }}>
          {tag}
        </li>
      ))}
    </ul>
  );
}

/** Start (accent fill) and Join (white), side by side. */
function StartJoin({ game, startingSlug, joinOpen, startOpen = false, onStart, onJoin, size }: GameCardProps & { size: "desktop" | "mobile" }) {
  const starting = startingSlug === game.slug;
  const base = `flex flex-1 cursor-pointer items-center justify-center rounded-[14px] border-2 disabled:cursor-not-allowed ${PRESS} ${FOCUS_RING} ${game.titleClassName} ${
    size === "desktop" ? "h-[50px] text-[18px]" : "h-12 text-[17px]"
  }`;
  return (
    <div className="flex gap-2.5">
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
        {starting ? "Starting…" : "Start"}
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
        Join
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

/** "Matchmaking": full width under Start + Join, ink fill with an accent shadow. */
function Matchmaking({ game, onMatchmaking, matchmakingOpen = false, size }: GameCardProps & { size: "desktop" | "mobile" }) {
  if (!onMatchmaking) return null;
  return (
    <button
      type="button"
      aria-label={`Matchmaking for ${game.title}: play with other players`}
      aria-haspopup="dialog"
      aria-expanded={matchmakingOpen}
      onClick={(e) => onMatchmaking(game.slug, e.currentTarget)}
      className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-[14px] border-2 text-white shadow-[0_4px_0_var(--accent)] ${PRESS} ${FOCUS_RING} ${game.titleClassName} ${
        size === "desktop" ? "h-[50px] text-[18px]" : "h-12 text-[17px]"
      }`}
      style={{ backgroundColor: game.ink, borderColor: game.ink, "--accent": game.accentColor } as CSSProperties}
    >
      <GlobeIcon />
      Matchmaking
    </button>
  );
}

/** "Play solo": a plain link to the solo page (no room, no invite). */
function PlaySolo({ game, path, size }: { game: GameEntry; path: string; size: "desktop" | "mobile" }) {
  return (
    <a
      href={path}
      aria-label={`Play ${game.title} solo`}
      className={`flex w-full items-center justify-center rounded-[14px] border-2 no-underline ${SHADOW} ${PRESS_LINK} ${FOCUS_RING} ${game.titleClassName} ${size === "desktop" ? "h-[50px] text-[18px]" : "h-12 text-[17px]"}`}
      style={{ backgroundColor: game.accentColor, borderColor: game.ink, color: game.ink }}
    >
      Play solo
    </a>
  );
}

/**
 * The desktop card (from 760px): art panel, title, description, chips, then
 * the buttons.
 */
function DesktopCard({ game, description, tags, className = "", children }: { game: GameEntry; description: string; tags: string[]; className?: string; children: ReactNode }) {
  return (
    <article className={`hidden flex-col rounded-[20px] bg-white px-2.5 pt-2.5 pb-[18px] shadow-[0_5px_0_rgba(0,0,0,.25),0_14px_26px_rgba(0,0,0,.2)] min-[760px]:flex ${LIFT} ${className}`}>
      <div aria-hidden="true" className="h-[168px] shrink-0 overflow-hidden rounded-xl">
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
        <div className="mt-auto flex flex-col gap-2.5 pt-1.5">{children}</div>
      </div>
    </article>
  );
}

/**
 * One game's card in a Social folder (references/game-room/game-room-ui-spec.md,
 * "Game card"): the 300px desktop card (Start + Join, and Matchmaking for games
 * strangers can play) from 760px, the compact card (mini art beside the text) below.
 * Both are in the DOM; CSS shows one.
 */
export default function GameCard(props: GameCardProps) {
  const { game } = props;
  return (
    <>
      <DesktopCard game={game} description={game.description} tags={game.tags} className="w-[300px]">
        <StartJoin {...props} size="desktop" />
        <Matchmaking {...props} size="desktop" />
      </DesktopCard>
      <CompactCard game={game} description={game.shortDescription} chip={game.tags[0]}>
        <StartJoin {...props} size="mobile" />
        <Matchmaking {...props} size="mobile" />
      </CompactCard>
    </>
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
          <Chips game={game} tags={[chip]} className="text-xs" />
        </div>
      </div>
      {children}
    </article>
  );
}

/**
 * A game's card in the Solo folder: the same 300px card as the Social
 * folder's, with one "Play solo" button.
 */
export function SoloCard({ game }: { game: GameEntry }) {
  const solo = game.solo;
  if (!solo) return null;
  return (
    <>
      <DesktopCard game={game} description={solo.description} tags={solo.tags} className="w-[300px]">
        <PlaySolo game={game} path={solo.path} size="desktop" />
      </DesktopCard>
      <CompactCard game={game} description={solo.description} chip={solo.tags[0]}>
        <PlaySolo game={game} path={solo.path} size="mobile" />
      </CompactCard>
    </>
  );
}
