import { COLOR } from "@/lib/games/cocounsel/theme";
import { gameBySlug } from "@/lib/games/registry";
import { GLYPH, REGION_COLORS } from "@/lib/games/regions/theme";

/**
 * The 40px game tile at the start of each "Your rooms" row
 * (references/game-room/game-room-ui-spec.md, "40 px tiles"): Same Page is the
 * lilac desk with a "1" sticky note; Co-Counsel is the blue/red split with the
 * yellow lens; Night Highway is the night road with a pair of taillights.
 * Decorative - the row's text names the game.
 */
export default function GameTile({ slug }: { slug: string }) {
  if (slug === "ftw") {
    // Same Page: the lilac desk with a yellow "1" sticky note.
    return (
      <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#B9A7FF]">
        <span className="flex h-[26px] w-[26px] -rotate-3 items-center justify-center rounded-[3px_3px_6px_3px] bg-[#FFE94A] pt-[2px] font-[family-name:var(--font-kalam)] text-[17px] font-bold leading-none text-[#1D2240] shadow-[0_2px_0_rgba(29,34,64,.14),0_3px_6px_rgba(29,34,64,.16)]">
          1
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
  if (slug === "borderrun") {
    // The card's highway sign: a green panel with a white arrow, on the map's sea.
    return (
      <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#E4EEF0]">
        <svg width="30" height="18" viewBox="0 0 30 18">
          <rect x="1" y="1" width="28" height="16" rx="4" fill="#176B4B" stroke="#fff" strokeWidth="1.5" />
          <path d="M7 9H22M18 5.5L22 9L18 12.5" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  if (slug === "regions") {
    // The card's board: four region pastels, a king in one.
    return (
      <span aria-hidden="true" className="grid h-10 w-10 shrink-0 grid-cols-2 overflow-hidden rounded-[10px] border-2 border-[#16261D]">
        {REGION_COLORS.slice(0, 4).map((color, i) => (
          <span key={color} className="flex items-center justify-center text-[14px] leading-none text-[#16261D]" style={{ backgroundColor: color }}>
            {i === 3 ? GLYPH.king : null}
          </span>
        ))}
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
