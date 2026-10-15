import { COLOR } from "@/lib/games/cocounsel/theme";

interface PartProgressProps {
  totalParts: number;
  /** 0-based. */
  currentPartIndex: number;
  attemptsUsed: number;
  maxAttempts: number;
  /** "onColor" for a role-colored band (white text/tabs), "onPaper" for the plain reveal-screen strip. */
  tone: "onColor" | "onPaper";
}

/** Docket tabs (which Part) + try-left pips - shown inside HeaderBand during a Part, and standalone on the reveal screen. */
export default function PartProgress({ totalParts, currentPartIndex, attemptsUsed, maxAttempts, tone }: PartProgressProps) {
  const triesLeft = Math.max(0, maxAttempts - attemptsUsed);
  const textColor = tone === "onColor" ? "#FFFFFF" : COLOR.ink;
  const inactiveTab = tone === "onColor" ? "rgba(255,255,255,.35)" : COLOR.disabledBg;
  const usedPipBorder = tone === "onColor" ? "#FFFFFF" : COLOR.ink;

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <div className="flex gap-1" aria-hidden="true">
          {Array.from({ length: totalParts }, (_, i) => (
            <span key={i} className="h-2.5 w-7 rounded-t-sm" style={{ backgroundColor: i === currentPartIndex ? COLOR.yellow : inactiveTab }} />
          ))}
        </div>
        <span className="font-[family-name:var(--font-archivo)] text-sm font-bold" style={{ color: textColor }}>
          Part {currentPartIndex + 1} of {totalParts}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <span className="flex gap-1" aria-hidden="true">
          {Array.from({ length: maxAttempts }, (_, i) =>
            i < triesLeft ? (
              <span key={i} className="h-3 w-3 rounded-full" style={{ backgroundColor: COLOR.yellow }} />
            ) : (
              <span key={i} className="h-3 w-3 rounded-full border-2" style={{ borderColor: usedPipBorder }} />
            ),
          )}
        </span>
        <span className="font-[family-name:var(--font-archivo)] text-sm font-bold" style={{ color: textColor }}>
          {triesLeft} {triesLeft === 1 ? "try" : "tries"} left
        </span>
      </div>
    </div>
  );
}
