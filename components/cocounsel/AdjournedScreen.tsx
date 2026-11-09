import type { CaseVerdict } from "@/lib/games/cocounsel/caseTypes";
import { COLOR } from "@/lib/games/cocounsel/theme";
import type { ThemeMode } from "@/lib/games/cocounsel/useTheme";
import Button from "./Button";
import ResultsHeader from "./ResultsHeader";
import Stamp from "./Stamp";
import { useText } from "@/lib/i18n/useLang";
import { CC_TEXT } from "./text";

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
  /** Opens the case picker - the room's owner only; absent for the other player, who waits for them instead. */
  onStartNewCase?: () => void;
  /** Back to case selection (the owner only): a joiner has no ← at all. */
  onBack?: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
}

/**
 * The case-wide attempt budget ran out - a genuine loss state, distinct
 * from (and rendered instead of) the celebratory VerdictScreen. Picked by
 * app/cocounsel/page.tsx via `game.log.at(-1)?.outcome !== "solved"`.
 */
export default function AdjournedScreen({
  investigatorName,
  defendantName,
  endedPartIndex,
  totalParts,
  verdict,
  onSeeRecap,
  onStartNewCase,
  onBack,
  theme,
  onToggleTheme,
}: AdjournedScreenProps) {
  const t = useText(CC_TEXT);
  return (
    <div>
      <ResultsHeader investigatorName={investigatorName} defendantName={defendantName} onBack={onBack} theme={theme} onToggleTheme={onToggleTheme} />
      <div className="px-4 pb-8 pt-6">
        <Stamp color="red" rotate={-3}>
          {t.adjournedStamp}
        </Stamp>
        <p className="mt-4 font-[family-name:var(--font-archivo)] text-base" style={{ color: COLOR.ink }}>
          {t.ranOut(endedPartIndex + 1, totalParts)}
        </p>

        {verdict ? (
          <>
            <p className="mt-2 font-[family-name:var(--font-archivo)] text-sm" style={{ color: COLOR.text2 }}>
              {t.rulingOnWayOut}
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
            {t.dismissed}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-3">
          {verdict && onSeeRecap ? (
            <Button variant="secondary" onClick={onSeeRecap}>
              {t.seeCaseFile}
            </Button>
          ) : null}
          {onStartNewCase ? (
            <Button onClick={onStartNewCase}>{t.startNewCase}</Button>
          ) : (
            <p aria-live="polite" className="text-center font-[family-name:var(--font-archivo)] text-sm" style={{ color: COLOR.text2 }}>
              {t.waitingForPartner}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
