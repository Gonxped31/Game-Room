import { NUMBER_GRADIENTS } from "@/lib/games/ftw/constants";
import { COLOR } from "@/lib/games/cocounsel/theme";
import { gameBySlug } from "@/lib/games/registry";

/**
 * The 40px game tile at the start of each "Your rooms" row
 * (references/game-room/game-room-ui-spec.md, "Your rooms content"): First to
 * Worst is a teal square with a mini "1" number card; Co-Counsel is the
 * blue/red split with the yellow lens. Decorative - the row's text names the
 * game.
 */
export default function GameTile({ slug }: { slug: string }) {
  if (slug === "ftw") {
    const [from, to] = NUMBER_GRADIENTS[0];
    return (
      <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]" style={{ backgroundColor: "#128A94" }}>
        <span className="flex h-[26px] w-[19px] items-center justify-center rounded-[4px] border border-[#D6D6D6] bg-white">
          <span
            className="font-[family-name:var(--font-fredoka)] text-[15px] font-bold leading-none"
            style={{ backgroundImage: `linear-gradient(to bottom, ${from}, ${to})`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}
          >
            1
          </span>
        </span>
      </span>
    );
  }
  if (slug === "cocounsel") {
    return (
      <span
        aria-hidden="true"
        className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[10px]"
        style={{ background: `linear-gradient(to right, ${COLOR.investigator} 50%, ${COLOR.defendant} 50%)` }}
      >
        <span className="relative h-[18px] w-[28px]">
          <span className="absolute left-0 top-0 h-[18px] w-[18px] rounded-full border-2 border-white" />
          <span className="absolute right-0 top-0 h-[18px] w-[18px] rounded-full border-2 border-white" />
          <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ backgroundColor: COLOR.yellow }} />
        </span>
      </span>
    );
  }
  // A game without its own tile yet: its accent color with the first letter.
  const game = gameBySlug(slug);
  return (
    <span
      aria-hidden="true"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] font-[family-name:var(--font-fredoka)] text-lg font-bold"
      style={{ backgroundColor: game?.accentColor ?? "#0F7983", color: game?.ink ?? "#FFFFFF" }}
    >
      {(game?.title ?? slug).charAt(0).toUpperCase()}
    </span>
  );
}
