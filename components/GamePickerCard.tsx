import type { CSSProperties, JSX } from "react";
import Link from "next/link";
import type { GameEntry } from "@/lib/games/registry";
import CoCounselArt from "./gameRoom/CoCounselArt";
import FtwArt from "./gameRoom/FtwArt";

const ART_BY_SLUG: Record<string, () => JSX.Element> = {
  ftw: FtwArt,
  cocounsel: CoCounselArt,
};

interface GamePickerCardProps {
  game: GameEntry;
  /** 0-based position among the rendered cards - alternates the desktop-only tilt (first -1.5deg, second +1.5deg, ...). */
  index: number;
}

/**
 * One game's card on the picker, per references/game-room/game-room-ui-spec.md's
 * "Game card" section. The whole card is a single <Link> (with its own
 * aria-label, since the "Start a room" pill is a styled <span> rather than a
 * real <button> - nesting an interactive element inside the anchor would be
 * invalid HTML).
 *
 * The resting tilt is desktop-only ("No rotation" under 760px) - applied via
 * a `--tilt` CSS custom property consumed by an arbitrary-property Tailwind
 * class gated behind `min-[760px]:`, rather than an unconditional inline
 * `transform` style, so it genuinely doesn't exist below that breakpoint
 * rather than just being overridden back to 0. Hover/focus straightens to 0
 * and lifts 6px (also desktop-only, per spec); `motion-reduce:` disables the
 * transition entirely.
 */
export default function GamePickerCard({ game, index }: GamePickerCardProps) {
  const Art = ART_BY_SLUG[game.slug];
  const tilt = index % 2 === 0 ? -1.5 : 1.5;

  return (
    <Link
      href={`/${game.slug}`}
      aria-label={`Start a ${game.title} room`}
      style={{ "--tilt": `${tilt}deg` } as CSSProperties}
      className="group block overflow-hidden rounded-[18px] bg-white p-[10px] pb-4 shadow-[0_6px_0_rgba(0,0,0,.28),0_16px_30px_rgba(0,0,0,.25)] transition-transform duration-150 ease-out motion-reduce:transition-none min-[760px]:rounded-[20px] min-[760px]:p-3 min-[760px]:pb-[22px] min-[760px]:[transform:rotate(var(--tilt))] min-[760px]:hover:[transform:rotate(0deg)_translateY(-6px)] min-[760px]:focus-visible:[transform:rotate(0deg)_translateY(-6px)]"
    >
      <span className="relative block h-[104px] overflow-hidden rounded-[10px] min-[760px]:h-[200px] min-[760px]:rounded-xl">{Art ? <Art /> : null}</span>
      <span className="mt-3.5 flex flex-col gap-2.5 px-1.5 min-[760px]:mt-5 min-[760px]:gap-3 min-[760px]:px-2.5">
        <span className={`block text-[26px] leading-[1.1] min-[760px]:text-[32px] ${game.titleClassName}`} style={{ color: game.ink }}>
          {game.title}
        </span>
        <span className="block text-[15px] font-medium leading-[1.4] min-[760px]:text-base" style={{ color: game.textSecondary }}>
          {game.description}
        </span>
        <span className="flex flex-wrap gap-2">
          {game.tags.map((tag) => (
            <span key={tag} className="rounded-full border-2 px-3 py-[3px] text-[13px] font-semibold" style={{ borderColor: game.ink, color: game.ink }}>
              {tag}
            </span>
          ))}
        </span>
        <span
          className={`mt-1.5 flex h-[52px] items-center justify-center rounded-[14px] border-2 text-center transition-transform duration-75 group-active:translate-y-1 group-active:shadow-none motion-reduce:transition-none min-[760px]:h-14 ${game.buttonTextClassName}`}
          style={{ backgroundColor: game.accentColor, borderColor: game.ink, color: game.ink, boxShadow: `0 4px 0 ${game.ink}` }}
        >
          Start a room
        </span>
      </span>
    </Link>
  );
}
