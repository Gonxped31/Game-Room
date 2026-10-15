import Link from "next/link";
import type { GameEntry } from "@/lib/games/registry";

interface GamePickerCardProps {
  game: GameEntry;
}

/**
 * One game's card on the picker (app/page.tsx), per the references/game-room
 * mockup: an image band, title, description, a couple of info pills, and a
 * "Start a room" pill. The whole card is a single <Link> - the "Start a
 * room" pill is a styled <span>, not a real <button>, since nesting an
 * interactive element inside the anchor would be invalid HTML.
 */
export default function GamePickerCard({ game }: GamePickerCardProps) {
  return (
    <Link
      href={`/${game.slug}`}
      className="block overflow-hidden rounded-2xl bg-white text-black shadow-[0_4px_10px_rgba(0,0,0,.25)] transition-transform active:translate-y-[2px]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- a small static local asset, not worth next/image's config for this */}
      <img src={game.image} alt="" className="h-[180px] w-full object-cover" />
      <div className="p-4">
        <div className="text-xl font-bold">{game.title}</div>
        <p className="mt-1.5 text-[15px] opacity-75">{game.tagline}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {game.tags.map((tag) => (
            <span key={tag} className="rounded-full border-2 border-black px-3 py-1 text-xs font-bold">
              {tag}
            </span>
          ))}
        </div>
        <span
          className="mt-4 block rounded-xl p-3.5 text-center text-lg font-bold"
          style={{ backgroundColor: game.accentColor, color: game.accentTextColor, boxShadow: `0 4px 0 ${game.accentShadowColor}` }}
        >
          Start a room
        </span>
      </div>
    </Link>
  );
}
