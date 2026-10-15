import { COLOR } from "@/lib/games/cocounsel/theme";
import { GAME_TITLE } from "@/lib/games/cocounsel/constants";
import type { ThemeMode } from "@/lib/games/cocounsel/useTheme";
import BackLink from "./BackLink";
import ThemeToggle from "./ThemeToggle";

interface WordmarkProps {
  size?: "sm" | "lg";
  onBack: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
}

/** The back link + two-overlapping-circles mark + "Co-Counsel" text + theme toggle - every screen that shows this is a top-of-flow screen needing both controls right beside it. */
export default function Wordmark({ size = "sm", onBack, theme, onToggleTheme }: WordmarkProps) {
  const mark = size === "lg" ? 48 : 32;
  const circle = mark * 0.62;
  const overlap = mark * 0.32;

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <BackLink onBack={onBack} />
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
      <ThemeToggle theme={theme} onToggle={onToggleTheme} />
    </div>
  );
}
