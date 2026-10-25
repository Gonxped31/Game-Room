import { COLOR } from "@/lib/games/cocounsel/theme";
import type { ThemeMode } from "@/lib/games/cocounsel/useTheme";
import BackLink from "./BackLink";
import ThemeToggle from "./ThemeToggle";

interface ResultsHeaderProps {
  investigatorName: string;
  defendantName: string;
  /** Back to case selection (the owner only): a joiner has no ← at all. */
  onBack?: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
}

/** The split blue/red band used on the reveal and verdict screens, with a small yellow "lens" mark at the seam. */
export default function ResultsHeader({ investigatorName, defendantName, onBack, theme, onToggleTheme }: ResultsHeaderProps) {
  return (
    <div className="relative flex">
      <div className="flex-1 px-4 py-5 text-white" style={{ backgroundColor: COLOR.investigator }}>
        <div className="mb-2">
          {onBack ? <BackLink onBack={onBack} /> : null}
        </div>
        <div className="font-[family-name:var(--font-archivo)] text-2xl font-extrabold leading-none">{investigatorName}</div>
        <div className="font-[family-name:var(--font-archivo)] text-sm font-bold opacity-90">Investigator</div>
      </div>
      <div className="flex-1 px-4 py-5 text-right text-white" style={{ backgroundColor: COLOR.defendant }}>
        <div className="mb-2 flex justify-end">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
        <div className="font-[family-name:var(--font-archivo)] text-2xl font-extrabold leading-none">{defendantName}</div>
        <div className="font-[family-name:var(--font-archivo)] text-sm font-bold opacity-90">Defendant</div>
      </div>
      <div aria-hidden="true" className="absolute left-1/2 top-1/2 h-11 w-11 -translate-x-1/2 -translate-y-1/2">
        <div className="absolute left-0 h-11 w-11 rounded-full border-2 border-white" />
        <div className="absolute right-0 h-11 w-11 rounded-full border-2 border-white" />
        <div className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ backgroundColor: COLOR.yellow }} />
      </div>
    </div>
  );
}
