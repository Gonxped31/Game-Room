"use client";

import type { CSSProperties, JSX } from "react";
import CoCounselArt from "@/components/gameRoom/CoCounselArt";
import FtwArt from "@/components/gameRoom/FtwArt";
import IaiArt from "@/components/gameRoom/IaiArt";
import NightHighwayArt from "@/components/gameRoom/NightHighwayArt";
import type { GameEntry } from "@/lib/games/registry";

const ART_BY_SLUG: Record<string, () => JSX.Element> = {
  ftw: FtwArt,
  cocounsel: CoCounselArt,
  nighthighway: NightHighwayArt,
  iai: IaiArt,
};

/** On the white card: a 3px teal focus outline (references/game-room/game-room-ui-spec.md, "Accessibility"). */
const FOCUS_RING = "focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#0F7983]";

interface GameCardProps {
  game: GameEntry;
  /** 0-based position among the cards - alternates the desktop-only tilt (-1.5deg, +1.5deg, ...). */
  index: number;
  /** Which game's Start is in progress, if any - every Start is disabled meanwhile, to prevent double rooms. */
  startingSlug: string | null;
  /** Whether this card's join panel is open (for aria-expanded). */
  joinOpen: boolean;
  onStart: (slug: string) => void;
  onJoin: (slug: string, button: HTMLButtonElement) => void;
}

/**
 * One game's card on the hub, per references/game-room/game-room-ui-spec.md's
 * "Game card" and "Card buttons": art panel, title, description, chips, then
 * Start (the game's accent fill) and Join (white) side by side.
 *
 * The resting tilt is desktop-only ("No rotation" under 760px): a `--tilt`
 * custom property consumed by a class gated behind `min-[760px]:`, so it
 * doesn't exist at all on mobile. Hover or keyboard focus anywhere in the
 * card straightens it and lifts it 6px; `motion-reduce:` turns that off.
 */
export default function GameCard({ game, index, startingSlug, joinOpen, onStart, onJoin }: GameCardProps) {
  const Art = ART_BY_SLUG[game.slug];
  const tilt = index % 2 === 0 ? -1.5 : 1.5;
  const starting = startingSlug === game.slug;
  const buttonBase = `flex h-[52px] flex-1 cursor-pointer items-center justify-center rounded-[14px] border-2 transition-transform duration-[60ms] enabled:active:translate-y-1 enabled:active:shadow-none disabled:cursor-not-allowed motion-reduce:transition-none min-[760px]:h-14 ${FOCUS_RING} ${game.buttonTextClassName}`;

  return (
    <article
      style={{ "--tilt": `${tilt}deg` } as CSSProperties}
      className="rounded-[18px] bg-white p-[10px] pb-4 shadow-[0_6px_0_rgba(0,0,0,.28),0_16px_30px_rgba(0,0,0,.25)] transition-transform duration-150 ease-out motion-reduce:transition-none min-[760px]:rounded-[20px] min-[760px]:p-3 min-[760px]:pb-[22px] min-[760px]:[transform:rotate(var(--tilt))] min-[760px]:focus-within:[transform:rotate(0deg)_translateY(-6px)] min-[760px]:hover:[transform:rotate(0deg)_translateY(-6px)] motion-reduce:min-[760px]:focus-within:[transform:rotate(var(--tilt))] motion-reduce:min-[760px]:hover:[transform:rotate(var(--tilt))]"
    >
      <div className="relative h-[104px] overflow-hidden rounded-[10px] min-[760px]:h-[200px] min-[760px]:rounded-xl">{Art ? <Art /> : null}</div>
      <div className="mt-3.5 flex flex-col gap-2.5 px-1.5 min-[760px]:mt-5 min-[760px]:gap-3 min-[760px]:px-2.5">
        <h2 className={`m-0 text-[26px] leading-[1.1] min-[760px]:text-[32px] ${game.titleClassName}`} style={{ color: game.ink }}>
          {game.title}
        </h2>
        <p className="m-0 text-[15px] font-medium leading-[1.4] min-[760px]:text-base" style={{ color: game.textSecondary }}>
          {game.description}
        </p>
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          {game.tags.map((tag) => (
            <li key={tag} className="rounded-full border-2 px-3 py-[3px] text-[13px] font-semibold" style={{ borderColor: game.ink, color: game.ink }}>
              {tag}
            </li>
          ))}
        </ul>
        <div className="mt-1.5 flex gap-2.5">
          <button
            type="button"
            aria-label={game.startPath ? `Start ${game.title}` : `Start a ${game.title} room`}
            disabled={startingSlug != null}
            onClick={() => onStart(game.slug)}
            className={`${buttonBase} disabled:opacity-80`}
            style={{
              backgroundColor: game.accentColor,
              borderColor: game.ink,
              color: game.ink,
              boxShadow: starting ? "none" : `0 4px 0 ${game.ink}`,
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
            className={`${buttonBase} bg-white`}
            style={{ borderColor: game.ink, color: game.ink, boxShadow: `0 4px 0 ${game.ink}` }}
          >
            Join
          </button>
        </div>
      </div>
    </article>
  );
}
