import Link from "next/link";
import { APP_TITLE, GAMES } from "@/lib/games/registry";

export default function GamePicker() {
  return (
    <main className="mx-auto max-w-[520px] px-4 pb-7 pt-3.5">
      <h1 className="m-0 mb-5 inline-block -rotate-2 rounded-[9px] bg-white px-3 py-2 text-[22px] font-bold leading-none text-black shadow-[0_3px_8px_rgba(0,0,0,.3)]">
        {APP_TITLE}
      </h1>
      <p className="mb-4 text-sm opacity-85">Pick a game - you&apos;ll get a private room to share with your partner.</p>
      <div className="grid gap-3">
        {GAMES.map((game) => (
          <Link
            key={game.slug}
            href={`/${game.slug}`}
            className="block rounded-xl bg-white px-4 py-3.5 text-black shadow-[0_3px_8px_rgba(0,0,0,.25)] transition-transform active:translate-y-[2px]"
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl leading-none">{game.emoji}</span>
              <div>
                <div className="text-lg font-bold">{game.title}</div>
                <div className="text-sm opacity-70">{game.tagline}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
