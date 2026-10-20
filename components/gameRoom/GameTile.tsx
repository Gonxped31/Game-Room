import { NUMBER_GRADIENTS } from "@/lib/games/ftw/constants";
import { COLOR } from "@/lib/games/cocounsel/theme";
import { gameBySlug } from "@/lib/games/registry";

/**
 * The 40px game tile at the start of each "Your rooms" row
 * (references/game-room/game-room-ui-spec.md, "Your rooms content"): First to
 * Worst is a teal square with a mini "1" number card; Co-Counsel is the
 * blue/red split with the yellow lens; Night Highway is the night road with a
 * pair of taillights. Decorative - the row's text names the game.
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
  if (slug === "nighthighway") {
    return (
      <span aria-hidden="true" className="relative block h-10 w-10 shrink-0 overflow-hidden rounded-[10px]" style={{ background: "linear-gradient(#0a1633, #04070f)" }}>
        <span className="absolute inset-x-0 bottom-0 h-[22px]" style={{ background: "#1b2135", clipPath: "polygon(42% 0, 58% 0, 100% 100%, 0 100%)" }} />
        <span className="absolute bottom-[8px] left-[11px] h-[3px] w-[5px] rounded-[1px] bg-[#ff2b45] shadow-[0_0_6px_2px_rgba(255,43,69,.7)]" />
        <span className="absolute bottom-[8px] right-[11px] h-[3px] w-[5px] rounded-[1px] bg-[#ff2b45] shadow-[0_0_6px_2px_rgba(255,43,69,.7)]" />
      </span>
    );
  }
  if (slug === "buzzerquiz") {
    return (
      <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#16113A]">
        <span className="h-[26px] w-[26px] rounded-full border-4 border-[#9E1B14] bg-[#FF4B3E]" />
      </span>
    );
  }
  if (slug === "wordscramble") {
    return (
      <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#F6E2B8]">
        <span className="flex h-[26px] w-[26px] items-center justify-center rounded-[6px] bg-[#F2CF8D] font-[family-name:var(--font-lilita)] text-[16px] leading-none text-[#2A1B12] shadow-[0_3px_0_#B98535]">
          W
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
