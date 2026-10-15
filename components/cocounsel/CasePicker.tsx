import type { CaseDefinition } from "@/lib/games/cocounsel/caseTypes";
import { COLOR } from "@/lib/games/cocounsel/theme";
import type { ThemeMode } from "@/lib/games/cocounsel/useTheme";
import Button from "./Button";
import Wordmark from "./Wordmark";

interface CasePickerProps {
  caseDef: CaseDefinition;
  onChoose: () => void;
  onBack: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
}

/**
 * The "Pick a case" screen - a static confirmation step in v1 (one real
 * case), but shows all three tiers so the structure reads clearly for when
 * more ship. Purely about the case itself - no room code or invite-link UI
 * here; that's the shared InviteLinkBanner's job, one step later (after a
 * role is picked), matching First to Worst's flow. This is also Co-Counsel's
 * own "home" screen - every other screen's back link returns here.
 */
export default function CasePicker({ caseDef, onChoose, onBack, theme, onToggleTheme }: CasePickerProps) {
  return (
    <div className="px-4 pb-8 pt-3.5">
      <Wordmark onBack={onBack} theme={theme} onToggleTheme={onToggleTheme} />
      <h1 className="mt-4 font-[family-name:var(--font-archivo)] text-[28px] font-extrabold leading-[1.1]" style={{ color: COLOR.ink }}>
        Pick a case
      </h1>
      <p className="mt-1 font-[family-name:var(--font-archivo)] text-base" style={{ color: COLOR.text2 }}>
        You both play the case you choose here.
      </p>

      <div className="relative mt-7">
        <div className="absolute -top-3.5 left-4 rounded-t px-3 py-1 text-xs font-bold text-white" style={{ backgroundColor: COLOR.ink }}>
          Easy
        </div>
        <div
          className="rounded-xl border-[3px] p-4 pt-6 shadow-[0_5px_0_rgba(0,0,0,.15)]"
          style={{ backgroundColor: COLOR.white, borderColor: COLOR.ink }}
        >
          <h2 className="font-[family-name:var(--font-archivo)] text-xl font-extrabold leading-[1.15]" style={{ color: COLOR.ink }}>
            {caseDef.title}
          </h2>
          <div className="mt-2 flex items-center gap-2">
            {caseDef.parts.map((part) => (
              <span key={part.n} aria-hidden="true" className="h-4 w-7 rounded" style={{ backgroundColor: COLOR.yellow }} />
            ))}
            <span className="font-[family-name:var(--font-archivo)] text-sm font-bold" style={{ color: COLOR.text2 }}>
              {caseDef.parts.length} Parts
            </span>
          </div>
          <p className="mt-3 font-[family-name:var(--font-archivo)] text-[15px]" style={{ color: COLOR.ink }}>
            {caseDef.teaser}
          </p>
          <p className="mt-2 font-[family-name:var(--font-archivo)] text-sm" style={{ color: COLOR.text2 }}>
            Best played on a call with your partner.
          </p>
          <div className="mt-4">
            <Button onClick={onChoose}>Choose this case</Button>
          </div>
        </div>
      </div>

      {(
        [
          { tier: "Medium", body: "Up to 5 Parts. More twists, more to remember. Coming later." },
          { tier: "Hard", body: "6 or more Parts. A real test of memory. Coming later." },
        ] as const
      ).map(({ tier, body }) => (
        <div key={tier} className="relative mt-5">
          <div
            className="absolute -top-3.5 left-4 rounded-t border-2 border-b-0 border-dashed px-3 py-1 text-xs font-bold"
            style={{ borderColor: COLOR.text2, color: COLOR.text2, backgroundColor: COLOR.paper }}
          >
            {tier}
          </div>
          <div className="rounded-xl border-2 border-dashed p-4 pt-6" style={{ borderColor: COLOR.text2 }}>
            <p className="font-[family-name:var(--font-archivo)] text-[15px]" style={{ color: COLOR.text2 }}>
              {body}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
