import { COLOR } from "@/lib/games/cocounsel/theme";
import BackLink from "./BackLink";
import PartProgress from "./PartProgress";

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
}

/** The full-width role-colored band shown during a Part: docket tabs, tries-left pips, title, "You're X, the Y". */
export default function HeaderBand({ role, characterName, roleLabel, totalParts, currentPartIndex, partTitle, attemptsUsed, maxAttempts }: HeaderBandProps) {
  const bg = role === "investigator" ? COLOR.investigator : COLOR.defendant;

  return (
    <div className="px-4 py-5 text-white" style={{ backgroundColor: bg }}>
      <div className="mb-2 flex items-center gap-2">
        <BackLink />
        <div className="min-w-0 flex-1">
          <PartProgress totalParts={totalParts} currentPartIndex={currentPartIndex} attemptsUsed={attemptsUsed} maxAttempts={maxAttempts} tone="onColor" />
        </div>
      </div>
      <h1 className="font-[family-name:var(--font-archivo)] text-[27px] font-extrabold leading-[1.1] tracking-[-0.01em]">{partTitle}</h1>
      <p className="m-0 font-[family-name:var(--font-archivo)] text-base font-medium">
        You&apos;re {characterName}, the {roleLabel}
      </p>
    </div>
  );
}
