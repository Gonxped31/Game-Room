"use client";

import { useState } from "react";
import type { CaseCard, CasePart } from "@/lib/games/cocounsel/caseTypes";
import { COLOR } from "@/lib/games/cocounsel/theme";
import Button from "./Button";
import ExhibitTent from "./ExhibitTent";
import HeaderBand from "./HeaderBand";
import Hand from "./Hand";
import TranscriptSheet from "./TranscriptSheet";

interface PartScreenProps {
  role: "investigator" | "defendant";
  characterName: string;
  roleLabel: string;
  otherCharacterName: string;
  part: CasePart;
  info: string;
  hand: CaseCard[];
  totalParts: number;
  currentPartIndex: number;
  attemptsUsed: number;
  maxAttempts: number;
  /** Set once this device has locked in for the current attempt. */
  myLockedCardId: string | null;
  onLockIn: (cardId: string) => void;
}

/**
 * The main "read, talk, lock in" screen for a Part. If `myLockedCardId` is
 * set, we're necessarily still PLACING (the phase would already be REVEALED
 * otherwise) - show the "locked in, waiting" state instead of the hand.
 */
export default function PartScreen({
  role,
  characterName,
  roleLabel,
  otherCharacterName,
  part,
  info,
  hand,
  totalParts,
  currentPartIndex,
  attemptsUsed,
  maxAttempts,
  myLockedCardId,
  onLockIn,
}: PartScreenProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (myLockedCardId != null) {
    const lockedIndex = hand.findIndex((c) => c.id === myLockedCardId);
    const lockedCard = hand[lockedIndex];
    return (
      <div>
        <HeaderBand
          role={role}
          characterName={characterName}
          roleLabel={roleLabel}
          totalParts={totalParts}
          currentPartIndex={currentPartIndex}
          partTitle={part.title}
          attemptsUsed={attemptsUsed}
          maxAttempts={maxAttempts}
        />
        <div className="px-4 pt-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="mb-1 font-[family-name:var(--font-archivo)] text-sm font-bold" style={{ color: COLOR.ink }}>
                Your card
              </p>
              <div className="relative aspect-[2/3] w-full rounded-xl border-[3px] bg-white p-3" style={{ borderColor: COLOR.ink }}>
                <ExhibitTent n={lockedIndex + 1} />
                <p className="mt-2 font-[family-name:var(--font-archivo)] text-base font-bold leading-[1.25]" style={{ color: COLOR.ink }}>
                  {lockedCard?.text}
                </p>
                <span
                  aria-hidden="true"
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-white"
                  style={{ backgroundColor: COLOR.ink }}
                >
                  🔒
                </span>
              </div>
            </div>
            <div>
              <p className="mb-1 font-[family-name:var(--font-archivo)] text-sm font-bold" style={{ color: COLOR.ink }}>
                {otherCharacterName}&apos;s card
              </p>
              <div
                className="flex aspect-[2/3] w-full items-center justify-center rounded-xl border-2 border-dashed p-3 text-center"
                style={{ borderColor: COLOR.cardEdgeBlue, color: COLOR.text2 }}
              >
                <span className="font-[family-name:var(--font-archivo)] text-sm">{otherCharacterName} is still choosing</span>
              </div>
            </div>
          </div>
          <p aria-live="polite" className="mt-6 font-[family-name:var(--font-archivo)] text-2xl font-extrabold leading-[1.2]" style={{ color: COLOR.ink }}>
            Locked in. Waiting for {otherCharacterName}.
          </p>
          <p className="mt-1 font-[family-name:var(--font-archivo)] text-base" style={{ color: COLOR.text2 }}>
            Keep talking. Both cards flip at the same time.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <HeaderBand
        role={role}
        characterName={characterName}
        roleLabel={roleLabel}
        totalParts={totalParts}
        currentPartIndex={currentPartIndex}
        partTitle={part.title}
        attemptsUsed={attemptsUsed}
        maxAttempts={maxAttempts}
      />
      <div className="px-4 pb-32 pt-4">
        <TranscriptSheet text={info} role={role} />
        <p className="mb-3 mt-5 font-[family-name:var(--font-archivo)] text-base font-bold" style={{ color: COLOR.ink }}>
          Say it out loud. Don&apos;t show your screen.
        </p>
        <Hand cards={hand} role={role} selectedId={selectedId} onToggle={(id) => setSelectedId((cur) => (cur === id ? null : id))} />
      </div>
      <div
        className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[480px] border-t px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"
        style={{ borderColor: COLOR.disabledBg, backgroundColor: COLOR.paper }}
      >
        <Button disabled={!selectedId} warmDisabled={role === "defendant"} onClick={() => selectedId && onLockIn(selectedId)}>
          {selectedId ? `Lock in card ${hand.findIndex((c) => c.id === selectedId) + 1}` : "Pick a card to lock in"}
        </Button>
      </div>
    </div>
  );
}
