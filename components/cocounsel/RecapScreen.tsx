import type { CaseDefinition } from "@/lib/games/cocounsel/caseTypes";
import { COLOR } from "@/lib/games/cocounsel/theme";
import type { ThemeMode } from "@/lib/games/cocounsel/useTheme";
import Button from "./Button";
import Wordmark from "./Wordmark";

interface RecapScreenProps {
  caseDef: CaseDefinition;
  /** The bottom button - back to the verdict/adjourned screen this Recap was opened from, not Co-Counsel's case-selection "home" (that's onBack, the Wordmark's own back link). */
  onBackToVerdict: () => void;
  onBack: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
}

/** "See the full case file" - every Part side by side with both private screens, the first time either player sees the other's text. */
export default function RecapScreen({ caseDef, onBackToVerdict, onBack, theme, onToggleTheme }: RecapScreenProps) {
  return (
    <div className="px-4 pb-8 pt-3.5">
      <Wordmark onBack={onBack} theme={theme} onToggleTheme={onToggleTheme} />
      <h1 className="mt-4 font-[family-name:var(--font-archivo)] text-2xl font-extrabold" style={{ color: COLOR.ink }}>
        The full case file
      </h1>
      <p className="mt-1 font-[family-name:var(--font-archivo)] text-sm" style={{ color: COLOR.text2 }}>
        Every Part, both sides of the story.
      </p>

      {caseDef.parts.map((part) => {
        const investigatorCorrect = part.hands.investigator.find((c) => c.id === part.correct[0]);
        const defendantCorrect = part.hands.defendant.find((c) => c.id === part.correct[1]);
        return (
          <div key={part.n} className="mt-6">
            <h2 className="font-[family-name:var(--font-archivo)] text-lg font-extrabold" style={{ color: COLOR.ink }}>
              Part {part.n}: {part.title}
            </h2>
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-[6px] p-3" style={{ backgroundColor: COLOR.white, borderLeft: `4px solid ${COLOR.investigator}` }}>
                <p className="text-xs font-bold" style={{ color: COLOR.investigator }}>
                  {caseDef.characters.investigator}, Investigator
                </p>
                <p className="mt-1 font-[family-name:var(--font-courier-prime)] text-sm leading-[22px]" style={{ color: COLOR.ink }}>
                  {part.screens.investigator.info}
                </p>
              </div>
              <div className="rounded-[6px] p-3" style={{ backgroundColor: COLOR.white, borderLeft: `4px solid ${COLOR.defendant}` }}>
                <p className="text-xs font-bold" style={{ color: COLOR.defendant }}>
                  {caseDef.characters.defendant}, Defendant
                </p>
                <p className="mt-1 font-[family-name:var(--font-courier-prime)] text-sm leading-[22px]" style={{ color: COLOR.ink }}>
                  {part.screens.defendant.info}
                </p>
              </div>
            </div>
            <div className="mt-2 rounded-[6px] p-3" style={{ backgroundColor: COLOR.green, color: "#FFFFFF" }}>
              <p className="text-xs font-bold uppercase tracking-wide">The correct pair</p>
              <p className="mt-1 text-sm">
                {investigatorCorrect?.text} + {defendantCorrect?.text}
              </p>
            </div>
          </div>
        );
      })}

      <div className="mt-8">
        <Button variant="secondary" onClick={onBackToVerdict}>
          Back to the verdict
        </Button>
      </div>
    </div>
  );
}
