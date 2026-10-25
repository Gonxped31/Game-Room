import { COLOR } from "@/lib/games/cocounsel/theme";
import type { ThemeMode } from "@/lib/games/cocounsel/useTheme";
import BackLink from "./BackLink";
import PartProgress from "./PartProgress";
import ThemeToggle from "./ThemeToggle";

interface HeaderBandProps {
  role: "investigator" | "defendant";
  characterName: string;
  roleLabel: string;
  totalParts: number;
  /** 0-based. */
  currentPartIndex: number;
  partTitle: string;
  attemptsUsed: number;
  maxAttempts: number;
  /** Back to case selection (the owner only): a joiner has no ← at all. */
  onBack?: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
}

/** The full-width role-colored band shown during a Part: docket tabs, tries-left pips, title, "You're X, the Y". */
export default function HeaderBand({
  role,
  characterName,
  roleLabel,
  totalParts,
  currentPartIndex,
  partTitle,
  attemptsUsed,
  maxAttempts,
  onBack,
  theme,
  onToggleTheme,
}: HeaderBandProps) {
  const bg = role === "investigator" ? COLOR.investigator : COLOR.defendant;

  return (
    <div className="px-4 py-5 text-white" style={{ backgroundColor: bg }}>
      {/* Its own row, separate from PartProgress below - that row's own
          content (docket tabs, "Part X of Y", tries-left pips/text) already
          spans close to the full content width, so cramming the back link
          and theme toggle into the same row risked overflow/wrapping on
          narrow viewports. */}
      <div className="mb-2 flex items-center justify-between">
        {onBack ? <BackLink onBack={onBack} /> : null}
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
      <div className="mb-2">
        <PartProgress totalParts={totalParts} currentPartIndex={currentPartIndex} attemptsUsed={attemptsUsed} maxAttempts={maxAttempts} tone="onColor" />
      </div>
      <h1 className="font-[family-name:var(--font-archivo)] text-[27px] font-extrabold leading-[1.1] tracking-[-0.01em]">{partTitle}</h1>
      <p className="m-0 font-[family-name:var(--font-archivo)] text-base font-medium">
        You&apos;re {characterName}, the {roleLabel}
      </p>
    </div>
  );
}
