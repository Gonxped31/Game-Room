"use client";

import { useCallback, useEffect, useState } from "react";
import { useGameSession } from "@/lib/session/useGameSession";
import { getCase } from "@/lib/games/cocounsel/cases";
import { DEFENDANT, GAME_TITLE, INVESTIGATOR, MAX_ATTEMPTS_PER_PART } from "@/lib/games/cocounsel/constants";
import { classifyDuo, continueAfterReveal, focusPercent, type GameState, lockIn, newGame, screenOfRole, totalAttempts, trustPercent } from "@/lib/games/cocounsel/game";
import { COLOR } from "@/lib/games/cocounsel/theme";
import CasePicker from "@/components/cocounsel/CasePicker";
import Footer from "@/components/cocounsel/Footer";
import PartScreen from "@/components/cocounsel/PartScreen";
import RecapScreen from "@/components/cocounsel/RecapScreen";
import RevealScreen from "@/components/cocounsel/RevealScreen";
import RolePicker from "@/components/cocounsel/RolePicker";
import VerdictScreen from "@/components/cocounsel/VerdictScreen";

const CASE_ID = "ruined-birthday";

export default function CoCounselPage() {
  const caseDef = getCase(CASE_ID);
  const createInitialState = useCallback((): GameState => newGame(CASE_ID), []);
  const session = useGameSession<GameState>({ gameSlug: "cocounsel", createInitialState });
  const { room, game, me, names, bothJoined, pickIdentity, transact, setGame, newRoom } = session;

  // Local, not synced - v1 has exactly one real case, so this is a static
  // confirmation step (per the design doc's own note), not a shared choice.
  const [step, setStep] = useState<"pick-case" | "playing">("pick-case");
  const [showRecap, setShowRecap] = useState(false);

  const myScreen = me ? screenOfRole(me) : null;
  const myRole: "investigator" | "defendant" = myScreen ?? "investigator";
  const otherRole: "investigator" | "defendant" = myRole === "investigator" ? "defendant" : "investigator";
  const investigatorTaken = Boolean(names[INVESTIGATOR]);
  const defendantTaken = Boolean(names[DEFENDANT]);

  const phase = game?.phase;
  const isMyTurnToAct =
    game != null &&
    me != null &&
    ((phase === "SELECTING" && !game.locks?.[me]) || phase === "REVEALED");

  useEffect(() => {
    document.title = isMyTurnToAct ? `▶ Your turn! · ${GAME_TITLE}` : GAME_TITLE;
  }, [isMyTurnToAct]);

  const handleLockIn = (cardId: string) => {
    if (!me) return;
    transact((current) => lockIn(current, caseDef, me, cardId));
  };
  const handleContinue = () => transact((current) => continueAfterReveal(current, caseDef));
  const handleResetCase = () => setGame(newGame(CASE_ID));
  const handleRematch = () => {
    setGame(newGame(CASE_ID));
    setShowRecap(false);
  };

  return (
    <main className="mx-auto min-h-screen max-w-[480px] font-[family-name:var(--font-archivo)]" style={{ backgroundColor: COLOR.paper }}>
      {step === "pick-case" ? (
        <CasePicker room={room} caseDef={caseDef} onChoose={() => setStep("playing")} />
      ) : !game ? (
        <p className="px-4 pt-8 font-[family-name:var(--font-archivo)] text-base" style={{ color: COLOR.ink }}>
          Connecting to the room…
        </p>
      ) : !bothJoined ? (
        <RolePicker
          room={room}
          caseDef={caseDef}
          investigatorTaken={investigatorTaken}
          defendantTaken={defendantTaken}
          onPickInvestigator={() => pickIdentity(INVESTIGATOR, caseDef.characters.investigator)}
          onPickDefendant={() => pickIdentity(DEFENDANT, caseDef.characters.defendant)}
        />
      ) : game.phase === "CASE_DONE" ? (
        showRecap ? (
          <RecapScreen caseDef={caseDef} onBack={() => setShowRecap(false)} />
        ) : (
          <VerdictScreen
            investigatorName={caseDef.characters.investigator}
            defendantName={caseDef.characters.defendant}
            verdict={caseDef.verdict}
            trust={trustPercent(game.log)}
            focus={focusPercent(game.log)}
            duo={classifyDuo(trustPercent(game.log), focusPercent(game.log))}
            attempts={totalAttempts(game.log)}
            totalParts={caseDef.parts.length}
            onSeeRecap={() => setShowRecap(true)}
            onRematch={handleRematch}
          />
        )
      ) : game.phase === "REVEALED" && game.lastReveal ? (
        (() => {
          const part = caseDef.parts[game.partIndex];
          const reveal = game.lastReveal!;
          const investigatorCard = part.hands.investigator.find((c) => c.id === reveal.investigatorCardId)!;
          const defendantCard = part.hands.defendant.find((c) => c.id === reveal.defendantCardId)!;
          const logEntry = game.log.at(-1)!;
          const isLastPart = game.partIndex >= caseDef.parts.length - 1;
          const continueLabel = isLastPart ? "See the verdict" : `Continue to Part ${game.partIndex + 2}`;
          return (
            <RevealScreen
              investigatorName={caseDef.characters.investigator}
              defendantName={caseDef.characters.defendant}
              totalParts={caseDef.parts.length}
              currentPartIndex={game.partIndex}
              attemptsUsed={game.attempts}
              maxAttempts={MAX_ATTEMPTS_PER_PART}
              logOutcome={logEntry.outcome}
              investigatorCard={investigatorCard}
              defendantCard={defendantCard}
              investigatorCardNumber={part.hands.investigator.findIndex((c) => c.id === investigatorCard.id) + 1}
              defendantCardNumber={part.hands.defendant.findIndex((c) => c.id === defendantCard.id) + 1}
              solvedOnFirstTry={reveal.solvedOnFirstTry}
              theory={part.theory}
              continueLabel={continueLabel}
              myRole={myRole}
              onPickAgain={handleContinue}
              onContinue={handleContinue}
            />
          );
        })()
      ) : (
        (() => {
          const part = caseDef.parts[game.partIndex];
          const info = part.screens[myRole].info;
          const hand = part.hands[myRole];
          const myLockedCardId = me ? (game.locks?.[me] ?? null) : null;
          return (
            <PartScreen
              role={myRole}
              characterName={caseDef.characters[myRole]}
              roleLabel={myRole === "investigator" ? "Investigator" : "Defendant"}
              otherCharacterName={caseDef.characters[otherRole]}
              part={part}
              info={info}
              hand={hand}
              totalParts={caseDef.parts.length}
              currentPartIndex={game.partIndex}
              attemptsUsed={game.attempts}
              maxAttempts={MAX_ATTEMPTS_PER_PART}
              myLockedCardId={myLockedCardId}
              onLockIn={handleLockIn}
            />
          );
        })()
      )}

      {step === "playing" && game ? (
        <Footer
          room={room}
          identity={me ? `${caseDef.characters[myRole]} · ${myRole === "investigator" ? "Investigator" : "Defendant"}` : undefined}
          onReset={handleResetCase}
          onNewRoom={newRoom}
        />
      ) : null}
    </main>
  );
}
