import type { CaseDefinition } from "@/lib/games/cocounsel/caseTypes";
import { COLOR } from "@/lib/games/cocounsel/theme";
import Wordmark from "./Wordmark";

interface RolePickerProps {
  caseDef: CaseDefinition;
  investigatorTaken: boolean;
  defendantTaken: boolean;
  onPickInvestigator: () => void;
  onPickDefendant: () => void;
}

/**
 * "Who are you this round?" - no name entry, unlike the shared 1v1
 * RolePicker; players pick a role, and the in-story character name comes
 * from the case data. When both roles are already claimed (a device with no
 * local `me`, e.g. after a rematch), both buttons stay enabled so either
 * player can re-confirm who they are. No room code shown here - the shared
 * 1v1 RolePicker doesn't show it either; only the Footer and the
 * InviteLinkBanner step (right after this one) do.
 */
export default function RolePicker({ caseDef, investigatorTaken, defendantTaken, onPickInvestigator, onPickDefendant }: RolePickerProps) {
  const bothTaken = investigatorTaken && defendantTaken;

  return (
    <div>
      <div className="px-4 pb-5 pt-3.5">
        <Wordmark />
        <p className="mt-2 font-[family-name:var(--font-archivo)] text-base" style={{ color: COLOR.text2 }}>
          Two sides of one story. Talk it out to solve it.
        </p>
        <p className="mt-4 font-[family-name:var(--font-archivo)] text-base font-bold" style={{ color: COLOR.ink }}>
          {caseDef.title}
        </p>
        <h1 className="mt-4 font-[family-name:var(--font-archivo)] text-2xl font-extrabold leading-[1.15]" style={{ color: COLOR.ink }}>
          {bothTaken ? "Welcome back! Which one are you?" : "Who are you this round?"}
        </h1>
        {!bothTaken ? (
          <p className="mt-1 font-[family-name:var(--font-archivo)] text-sm" style={{ color: COLOR.text2 }}>
            Your partner picks the other role. Never look at each other&apos;s screen.
          </p>
        ) : null}
      </div>
      <div className="relative flex flex-col">
        <button
          type="button"
          disabled={investigatorTaken && !bothTaken}
          onClick={onPickInvestigator}
          aria-label={bothTaken ? `I'm ${caseDef.characters.investigator}, the Investigator` : "I'm the Investigator"}
          className="flex min-h-[180px] flex-col justify-center gap-2 px-6 py-8 text-left text-white disabled:cursor-not-allowed disabled:opacity-60"
          style={{ backgroundColor: COLOR.investigator }}
        >
          <span aria-hidden="true" className="text-2xl">
            🔍
          </span>
          <span className="font-[family-name:var(--font-archivo)] text-2xl font-extrabold">
            {bothTaken ? `I'm ${caseDef.characters.investigator}` : "I'm the Investigator"}
          </span>
          {!bothTaken ? (
            <span className="font-[family-name:var(--font-archivo)] text-base">You saw what happened from the outside. You hold the evidence.</span>
          ) : null}
        </button>
        <button
          type="button"
          disabled={defendantTaken && !bothTaken}
          onClick={onPickDefendant}
          aria-label={bothTaken ? `I'm ${caseDef.characters.defendant}, the Defendant` : "I'm the Defendant"}
          className="flex min-h-[180px] flex-col justify-center gap-2 px-6 py-8 text-left text-white disabled:cursor-not-allowed disabled:opacity-60"
          style={{ backgroundColor: COLOR.defendant }}
        >
          <span aria-hidden="true" className="text-2xl">
            💬
          </span>
          <span className="font-[family-name:var(--font-archivo)] text-2xl font-extrabold">
            {bothTaken ? `I'm ${caseDef.characters.defendant}` : "I'm the Defendant"}
          </span>
          {!bothTaken ? (
            <span className="font-[family-name:var(--font-archivo)] text-base">You know what was going on inside. You hold the motives.</span>
          ) : null}
        </button>
        <div
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2"
          style={{ backgroundColor: COLOR.yellow, borderColor: COLOR.ink }}
        >
          <span className="text-xl font-extrabold" style={{ color: COLOR.ink }}>
            +
          </span>
        </div>
      </div>
    </div>
  );
}
