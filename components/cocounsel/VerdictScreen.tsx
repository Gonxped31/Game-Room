import type { CaseVerdict } from "@/lib/games/cocounsel/caseTypes";
import type { DuoClassification } from "@/lib/games/cocounsel/game";
import { COLOR } from "@/lib/games/cocounsel/theme";
import Button from "./Button";
import ResultsHeader from "./ResultsHeader";
import Stamp from "./Stamp";

interface VerdictScreenProps {
  investigatorName: string;
  defendantName: string;
  verdict: CaseVerdict;
  trust: number;
  focus: number;
  duo: DuoClassification;
  attempts: number;
  totalParts: number;
  onSeeRecap: () => void;
  onRematch: () => void;
  onBack: () => void;
}

function ScoreBar({ label, sub, value }: { label: string; sub: string; value: number }) {
  return (
    <div>
      <p className="font-[family-name:var(--font-archivo)] text-base font-bold" style={{ color: COLOR.ink }}>
        {label}
      </p>
      <p className="font-[family-name:var(--font-archivo)] text-sm" style={{ color: COLOR.text2 }}>
        {sub}
      </p>
      <p className="mt-1 font-[family-name:var(--font-archivo-narrow)] text-[52px] font-bold leading-[1.05]" style={{ color: COLOR.ink }}>
        {Math.round(value)}%
      </p>
      <div className="mt-1 h-[10px] w-full rounded-full" style={{ backgroundColor: COLOR.disabledBg }}>
        <div className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: COLOR.ink }} />
      </div>
    </div>
  );
}

/** The end-of-case screen - the first (and only) place Focus/Trust/duo classification are shown. */
export default function VerdictScreen({
  investigatorName,
  defendantName,
  verdict,
  trust,
  focus,
  duo,
  attempts,
  totalParts,
  onSeeRecap,
  onRematch,
  onBack,
}: VerdictScreenProps) {
  return (
    <div>
      <ResultsHeader investigatorName={investigatorName} defendantName={defendantName} onBack={onBack} />
      <div className="px-4 pb-8 pt-6">
        <Stamp color="green" rotate={-3}>
          {verdict.title}
        </Stamp>
        <div
          className="mt-6 rounded-[6px] p-4 font-[family-name:var(--font-courier-prime)] text-[15px] leading-[26px]"
          style={{ backgroundColor: COLOR.white, color: COLOR.ink }}
        >
          {verdict.text}
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4">
          <ScoreBar label="Focus" sub="How well you remembered" value={focus} />
          <ScoreBar label="Trust" sub="How well you listened" value={trust} />
        </div>
        <div className="mt-6 flex items-center gap-3 rounded-xl px-4 py-3" style={{ backgroundColor: COLOR.ink }}>
          <span className="font-[family-name:var(--font-archivo)] text-sm text-white">Your duo</span>
          <span className="font-[family-name:var(--font-archivo-narrow)] text-2xl font-bold" style={{ color: COLOR.yellow }}>
            {duo}
          </span>
        </div>
        <p className="mt-4 font-[family-name:var(--font-archivo)] text-sm" style={{ color: COLOR.text2 }}>
          {attempts} attempts across {totalParts} Parts
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Button onClick={onSeeRecap}>See the full case file</Button>
          <Button variant="secondary" onClick={onRematch}>
            Rematch with swapped roles
          </Button>
        </div>
      </div>
    </div>
  );
}
