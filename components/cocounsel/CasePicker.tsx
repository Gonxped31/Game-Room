import { casesByTier } from "@/lib/games/cocounsel/cases";
import { COLOR } from "@/lib/games/cocounsel/theme";
import type { ThemeMode } from "@/lib/games/cocounsel/useTheme";
import Button from "./Button";
import Wordmark from "./Wordmark";
import RulesButton from "./Rules";
import { useLang } from "@/lib/i18n/useLang";
import { CC_TEXT } from "./text";

interface CasePickerProps {
  /** The case the room's game is on right now, marked on its card. */
  currentCaseId: string;
  /**
   * How the current case stands: "inProgress" (a case is underway - its
   * card offers to resume), "done" (it just finished - marked "Just played")
   * or "fresh" (nothing played yet - no mark at all).
   */
  currentStatus: "fresh" | "inProgress" | "done";
  onChoose: (caseId: string) => void;
  /** Back to case selection (the owner only): a joiner has no ← at all. */
  onBack?: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
}

/**
 * The "Pick a case" screen, every case in cases.json grouped by tier. Only
 * the room's owner ever sees it; choosing a case starts it for both players.
 * Purely about the case - no room code or invite-link UI here; that's the
 * shared InviteLinkBanner's job, one step later. This is also Co-Counsel's
 * own "home" screen for the owner - their other screens' back links return here.
 */
export default function CasePicker({ currentCaseId, currentStatus, onChoose, onBack, theme, onToggleTheme }: CasePickerProps) {
  const lang = useLang();
  const t = CC_TEXT[lang];
  return (
    <div className="px-4 pb-8 pt-3.5">
      <Wordmark onBack={onBack} theme={theme} onToggleTheme={onToggleTheme} />
      <h1 className="mt-4 font-[family-name:var(--font-archivo)] text-[28px] font-extrabold leading-[1.1]" style={{ color: COLOR.ink }}>
        {t.pickCase}
      </h1>
      <p className="mt-1 font-[family-name:var(--font-archivo)] text-base" style={{ color: COLOR.text2 }}>
        {t.pickCaseIntro}
      </p>
      <div className="mt-2 flex">
        <RulesButton variant="link" />
      </div>

      {casesByTier(lang)
        .filter(({ cases }) => cases.length > 0)
        .map(({ tier, cases }) => (
          <section key={tier} aria-labelledby={`tier-${tier}`} className="relative mt-8">
            <h2
              id={`tier-${tier}`}
              className="absolute -top-3.5 left-4 rounded-t px-3 py-1 font-[family-name:var(--font-archivo)] text-xs font-bold"
              style={{ backgroundColor: COLOR.ink, color: COLOR.paper }}
            >
              {t.tier[tier]}
            </h2>
            <div className="flex flex-col gap-4 rounded-xl border-[3px] p-3 pt-6" style={{ borderColor: COLOR.ink }}>
              {cases.map((caseDef) => {
                const isCurrent = caseDef.id === currentCaseId;
                const justPlayed = isCurrent && currentStatus === "done";
                const resumes = isCurrent && currentStatus === "inProgress";
                const badge = justPlayed ? t.justPlayed : resumes ? t.inProgress : null;
                return (
                  <article
                    key={caseDef.id}
                    className="rounded-lg border-2 p-4 shadow-[0_4px_0_rgba(0,0,0,.12)]"
                    style={{ backgroundColor: COLOR.white, borderColor: COLOR.ink }}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="min-w-0 font-[family-name:var(--font-archivo)] text-xl font-extrabold leading-[1.15]" style={{ color: COLOR.ink }}>
                        {caseDef.title}
                      </h3>
                      {badge ? (
                        <span
                          className="shrink-0 rounded-full border-2 px-2.5 py-0.5 font-[family-name:var(--font-archivo)] text-xs font-bold"
                          style={{ borderColor: COLOR.ink, color: COLOR.ink, backgroundColor: COLOR.yellow }}
                        >
                          {badge}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {caseDef.parts.map((part) => (
                        <span key={part.n} aria-hidden="true" className="h-4 w-7 rounded" style={{ backgroundColor: COLOR.yellow }} />
                      ))}
                      <span className="font-[family-name:var(--font-archivo)] text-sm font-bold" style={{ color: COLOR.text2 }}>
                        {t.parts(caseDef.parts.length)}
                      </span>
                    </div>
                    <p className="mt-3 font-[family-name:var(--font-archivo)] text-[15px]" style={{ color: COLOR.ink }}>
                      {caseDef.teaser}
                    </p>
                    <div className="mt-4">
                      <Button
                        onClick={() => onChoose(caseDef.id)}
                        aria-label={resumes ? t.resumeAria(caseDef.title) : t.chooseAria(caseDef.title)}
                      >
                        {resumes ? t.resumeCase : justPlayed ? t.playAgain : t.chooseCase}
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
    </div>
  );
}
