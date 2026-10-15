import { COLOR } from "@/lib/games/cocounsel/theme";
import { GAME_TITLE } from "@/lib/games/cocounsel/constants";
import BackLink from "./BackLink";

/** The back link + two-overlapping-circles mark + "Co-Counsel" text - every screen that shows this is a top-of-flow screen needing back nav right beside it. */
export default function Wordmark({ size = "sm" }: { size?: "sm" | "lg" }) {
  const mark = size === "lg" ? 48 : 32;
  const circle = mark * 0.62;
  const overlap = mark * 0.32;

  return (
    <div className="flex items-center gap-2">
      <BackLink />
      <div aria-hidden="true" className="relative shrink-0" style={{ width: mark, height: mark }}>
        <div className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full" style={{ width: circle, height: circle, backgroundColor: COLOR.investigator }} />
        <div className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full" style={{ width: circle, height: circle, backgroundColor: COLOR.defendant }} />
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ width: overlap, height: overlap, backgroundColor: COLOR.yellow }}
        />
      </div>
      <span
        className={`font-[family-name:var(--font-archivo)] font-extrabold tracking-[-0.03em] ${size === "lg" ? "text-4xl" : "text-2xl"}`}
        style={{ color: COLOR.ink }}
      >
        {GAME_TITLE}
      </span>
    </div>
  );
}
