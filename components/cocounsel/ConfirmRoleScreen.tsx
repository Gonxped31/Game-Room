import type { CaseDefinition } from "@/lib/games/cocounsel/caseTypes";
import { COLOR } from "@/lib/games/cocounsel/theme";
import type { ThemeMode } from "@/lib/games/cocounsel/useTheme";
import Button from "./Button";
import Wordmark from "./Wordmark";

interface ConfirmRoleScreenProps {
  caseDef: CaseDefinition;
  myRole: "investigator" | "defendant";
  onContinue: () => void;
  onSwitchRole: () => void;
  onBack: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
}

/**
 * Shown when rejoining a room where this device already has a remembered
 * seat - instead of always silently resuming it, this gives the deliberate
 * choice to continue as that role or switch. "Switch role instead" trades
 * seats with the other player in a single update (or simply moves to the
 * other role if nobody holds it yet) - see handleSwitchRole in
 * app/cocounsel/page.tsx - so neither player is ever left without a seat,
 * and the other device just finds itself in the other role. Only ever shown while the case
 * is still fresh (`isFreshGame`), so switching can never pull a role out
 * from under an already-active match.
 */
export default function ConfirmRoleScreen({ caseDef, myRole, onContinue, onSwitchRole, onBack, theme, onToggleTheme }: ConfirmRoleScreenProps) {
  const myName = caseDef.characters[myRole];
  const roleLabel = myRole === "investigator" ? "Investigator" : "Defendant";

  return (
    <div>
      <div className="px-4 pb-5 pt-3.5">
        <Wordmark onBack={onBack} theme={theme} onToggleTheme={onToggleTheme} />
        <p className="mt-2 font-[family-name:var(--font-archivo)] text-base" style={{ color: COLOR.text2 }}>
          {caseDef.title}
        </p>
        <h1 className="mt-4 font-[family-name:var(--font-archivo)] text-2xl font-extrabold leading-[1.15]" style={{ color: COLOR.ink }}>
          Welcome back!
        </h1>
        <p className="mt-1 font-[family-name:var(--font-archivo)] text-sm" style={{ color: COLOR.text2 }}>
          Last time you were {myName}, the {roleLabel}.
        </p>
      </div>
      <div className="px-4 pb-8">
        <div className="flex flex-col gap-3">
          <Button onClick={onContinue}>
            Continue as {myName}, the {roleLabel}
          </Button>
          <Button variant="secondary" onClick={onSwitchRole}>
            Switch role instead
          </Button>
        </div>
      </div>
    </div>
  );
}
