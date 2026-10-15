import type { CaseVerdict } from "@/lib/games/cocounsel/caseTypes";
import { COLOR } from "@/lib/games/cocounsel/theme";
import Button from "./Button";
import ResultsHeader from "./ResultsHeader";
import Stamp from "./Stamp";

interface AdjournedScreenProps {
  investigatorName: string;
  defendantName: string;
  /** 0-based - which Part the case-wide attempt budget ran out on. */
  endedPartIndex: number;
  totalParts: number;
  /**
   * Only present when the budget ran out on the case's LAST Part - the
   * judge still reveals the final ruling on the way out. Absent for an
   * earlier Part: per the design rule "only give the final answer if they
   * fail at the last Part", nothing about the case is resolved, so there's
   * no verdict (and no "see the full case file" option, since that would
   * spoil every Part's correct pair regardless).
   */
  verdict?: CaseVerdict;
  onSeeRecap?: () => void;
  onStartNewCase: () => void;
  onBack: () => void;
}

/**
 * The case-wide attempt budget ran out - a genuine loss state, distinct
 * from (and rendered instead of) the celebratory VerdictScreen. Picked by
 * app/cocounsel/page.tsx via `game.log.at(-1)?.outcome !== "solved"`.
 */
export default function AdjournedScreen({ investigatorName, defendantName, endedPartIndex, totalParts, verdict, onSeeRecap, onStartNewCase, onBack }: AdjournedScreenProps) {
  return (
    <div>
      <ResultsHeader investigatorName={investigatorName} defendantName={defendantName} onBack={onBack} />
      <div className="px-4 pb-8 pt-6">
        <Stamp color="red" rotate={-3}>
          Case Adjourned
        </Stamp>
        <p className="mt-4 font-[family-name:var(--font-archivo)] text-base" style={{ color: COLOR.ink }}>
          Too many misreadings - the court ran out of patience on Part {endedPartIndex + 1} of {totalParts}.
        </p>

        {verdict ? (
          <>
            <p className="mt-2 font-[family-name:var(--font-archivo)] text-sm" style={{ color: COLOR.text2 }}>
              The judge still delivers a ruling on the way out:
            </p>
            <div
              className="mt-4 rounded-[6px] p-4 font-[family-name:var(--font-courier-prime)] text-[15px] leading-[26px]"
              style={{ backgroundColor: COLOR.white, color: COLOR.ink }}
            >
              {verdict.text}
            </div>
          </>
        ) : (
          <p className="mt-2 font-[family-name:var(--font-archivo)] text-sm" style={{ color: COLOR.text2 }}>
            The case is dismissed before being fully heard - no final answer this time.
          </p>
        )}

        <div className="mt-6 flex flex-col gap-3">
          {verdict && onSeeRecap ? (
            <Button variant="secondary" onClick={onSeeRecap}>
              See the full case file
            </Button>
          ) : null}
          <Button onClick={onStartNewCase}>Start a new case</Button>
        </div>
      </div>
    </div>
  );
}
