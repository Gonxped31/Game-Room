import type { CaseCard } from "@/lib/games/cocounsel/caseTypes";
import type { AttemptOutcome } from "@/lib/games/cocounsel/game";
import { COLOR } from "@/lib/games/cocounsel/theme";
import Button from "./Button";
import PartProgress from "./PartProgress";
import ResultsHeader from "./ResultsHeader";
import RevealCard from "./RevealCard";
import Stamp, { type StampColor } from "./Stamp";

interface RevealScreenProps {
  investigatorName: string;
  defendantName: string;
  totalParts: number;
  currentPartIndex: number;
  attemptsUsed: number;
  maxAttempts: number;
  /** The log entry's outcome for THIS attempt - distinguishes trap/wrong for the stamp color, unlike RevealInfo's 3-way outcome. */
  logOutcome: AttemptOutcome;
  investigatorCard: CaseCard;
  defendantCard: CaseCard;
  investigatorCardNumber: number;
  defendantCardNumber: number;
  solvedOnFirstTry?: boolean;
  theory?: string;
  continueLabel: string;
  myRole: "investigator" | "defendant";
  onPickAgain: () => void;
  onContinue: () => void;
}

const STAMP_CONFIG: Record<AttemptOutcome, { color: StampColor; label: string; heading: string; body: string }> = {
  solved: { color: "green", label: "WORKING THEORY", heading: "Working theory accepted.", body: "" },
  judgeRevealed: { color: "green", label: "WORKING THEORY", heading: "The judge reveals the pair.", body: "" },
  trap: { color: "amber", label: "DOESN'T FIT", heading: "Plausible, but something doesn't fit.", body: "Talk it through, then pick again." },
  wrong: { color: "ink", label: "DOESN'T HOLD UP", heading: "That doesn't hold up.", body: "Talk it through, then pick again." },
};

/** Both cards flip, a stamp lands, and - depending on the outcome - either "Pick again" (retry) or a theory + "Continue" (solved/judge-revealed). */
export default function RevealScreen({
  investigatorName,
  defendantName,
  totalParts,
  currentPartIndex,
  attemptsUsed,
  maxAttempts,
  logOutcome,
  investigatorCard,
  defendantCard,
  investigatorCardNumber,
  defendantCardNumber,
  solvedOnFirstTry,
  theory,
  continueLabel,
  myRole,
  onPickAgain,
  onContinue,
}: RevealScreenProps) {
  const cfg = STAMP_CONFIG[logOutcome];
  const isFinal = logOutcome === "solved" || logOutcome === "judgeRevealed";

  return (
    <div>
      <ResultsHeader investigatorName={investigatorName} defendantName={defendantName} />
      <div className="px-4 pb-8 pt-4">
        {solvedOnFirstTry ? (
          <p className="text-right font-[family-name:var(--font-archivo)] text-sm font-bold" style={{ color: COLOR.ink }}>
            Solved on the first try
          </p>
        ) : (
          <PartProgress totalParts={totalParts} currentPartIndex={currentPartIndex} attemptsUsed={attemptsUsed} maxAttempts={maxAttempts} tone="onPaper" />
        )}

        <div className="relative mt-4 grid grid-cols-2 gap-3 pb-6">
          <RevealCard n={investigatorCardNumber} text={investigatorCard.text} role="investigator" characterName={investigatorName} />
          <RevealCard n={defendantCardNumber} text={defendantCard.text} role="defendant" characterName={defendantName} />
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -bottom-2 flex justify-center">
            <Stamp color={cfg.color} rotate={-4}>
              {cfg.label}
            </Stamp>
          </div>
        </div>

        <h2 aria-live="polite" className="mt-6 font-[family-name:var(--font-archivo)] text-2xl font-extrabold leading-[1.2]" style={{ color: COLOR.ink }}>
          {cfg.heading}
        </h2>
        {cfg.body ? (
          <p className="mt-1 font-[family-name:var(--font-archivo)] text-base" style={{ color: COLOR.text2 }}>
            {cfg.body}
          </p>
        ) : null}

        {isFinal && theory ? (
          <div className="relative mt-6">
            <div className="absolute -top-3.5 left-2 rounded-t px-3 py-1 text-xs font-bold text-white" style={{ backgroundColor: COLOR.ink }}>
              Case notes
            </div>
            <div
              className="rounded-[6px] bg-white p-4 pt-5 font-[family-name:var(--font-courier-prime)] text-[15px] leading-[26px]"
              style={{ color: COLOR.ink }}
            >
              {theory}
            </div>
          </div>
        ) : null}

        <div className="mt-8">
          <Button warmDisabled={myRole === "defendant"} onClick={isFinal ? onContinue : onPickAgain}>
            {isFinal ? continueLabel : "Pick again"}
          </Button>
        </div>
      </div>
    </div>
  );
}
