"use client";

import { useCallback, useEffect, useState } from "react";
import { useGameSession } from "@/lib/session/useGameSession";
import { getCase } from "@/lib/games/cocounsel/cases";
import { DEFENDANT, GAME_TITLE, INVESTIGATOR, MAX_CASE_ATTEMPTS } from "@/lib/games/cocounsel/constants";
import { classifyDuo, continueAfterReveal, focusPercent, type GameState, lockIn, newGame, screenOfRole, totalAttempts, trustPercent } from "@/lib/games/cocounsel/game";
import { COLOR, CONTAINER_MAX_WIDTH_CLASS } from "@/lib/games/cocounsel/theme";
import { useTheme } from "@/lib/games/cocounsel/useTheme";
import InviteLinkBanner from "@/components/InviteLinkBanner";
import BackButton from "@/components/cocounsel/BackButton";
import CasePicker from "@/components/cocounsel/CasePicker";
import Footer from "@/components/cocounsel/Footer";
import PartScreen from "@/components/cocounsel/PartScreen";
import RecapScreen from "@/components/cocounsel/RecapScreen";
import RevealScreen from "@/components/cocounsel/RevealScreen";
import RolePicker from "@/components/cocounsel/RolePicker";
import ThemeToggle from "@/components/cocounsel/ThemeToggle";
import VerdictScreen from "@/components/cocounsel/VerdictScreen";

const CASE_ID = "ruined-birthday";

export default function CoCounselPage() {
  const caseDef = getCase(CASE_ID);
  const createInitialState = useCallback((): GameState => newGame(CASE_ID), []);
  const session = useGameSession<GameState>({ gameSlug: "cocounsel", createInitialState });
  const { room, game, me, names, bothJoined, pickIdentity, transact, setGame, newRoom } = session;
  const { theme, toggleTheme } = useTheme();

  // Whoever visits with no #room in the URL at all is the one about to
  // generate a fresh room and share its link - only THAT device should see
  // the case-picker; a device that opens an existing link joins a room that
  // already has its case chosen and skips straight past it. Captured via a
  // useState lazy initializer, which (like useRef) runs synchronously during
  // this component's very first render - strictly before any effects fire,
  // including useGameSession's own hash-generating effect - so this
  // reliably observes the ORIGINAL hash before that effect can rewrite it.
  // Safe from hydration mismatches despite reading `window` here: the JSX
  // branch that depends on it is already gated behind `!game`, which is
  // uniformly null on the very first paint for both server and client (see
  // the `!game` branch below), so this value can't affect anything until
  // well after hydration has completed.
  const [isCreator, setIsCreator] = useState<boolean | null>(() => (typeof window !== "undefined" ? window.location.hash === "" : null));
  const isJoiner = isCreator === false;

  // Local, not synced - v1 has exactly one real case, so this is a static
  // confirmation step (per the design doc's own note), not a shared choice.
  // Only the creator (see isJoiner above) ever sees it at all.
  const [caseConfirmed, setCaseConfirmed] = useState(false);
  const showCasePicker = !isJoiner && !caseConfirmed;
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
  // Generating a brand new room via the footer's "New room" link makes this
  // device the creator of THAT room (even if it joined the current one via a
  // link) - reset the flag so the fresh room's case-picker shows correctly.
  const handleNewRoom = () => {
    setIsCreator(true);
    setCaseConfirmed(false);
    newRoom();
  };

  return (
    <div className="min-h-screen w-full" data-theme={theme} style={{ backgroundColor: COLOR.paper }}>
      <BackButton />
      <ThemeToggle theme={theme} onToggle={toggleTheme} />
      {/* pt-14 reserves a clear strip above all content for the fixed back
          button (top-3, 40px tall) so it never overlaps the Wordmark logo or
          a role-colored band's own top-left text. */}
      <main className={`mx-auto pt-14 font-[family-name:var(--font-archivo)] ${CONTAINER_MAX_WIDTH_CLASS}`} style={{ color: COLOR.ink }}>
        {!game ? (
          // Checked FIRST, unconditionally, before showCasePicker - game is
          // uniformly null here for every environment (static prerender,
          // and every live client's very first render alike, per
          // useGameSession's own getServerSnapshot-matching design), so this
          // branch is what keeps the isCreator/showCasePicker logic below
          // from ever being reached before hydration has safely completed.
          <p className="px-4 pt-8 font-[family-name:var(--font-archivo)] text-base" style={{ color: COLOR.ink }}>
            Connecting to the room…
          </p>
        ) : showCasePicker ? (
          <CasePicker caseDef={caseDef} onChoose={() => setCaseConfirmed(true)} />
        ) : !me ? (
          <RolePicker
            caseDef={caseDef}
            investigatorTaken={investigatorTaken}
            defendantTaken={defendantTaken}
            onPickInvestigator={() => pickIdentity(INVESTIGATOR, caseDef.characters.investigator)}
            onPickDefendant={() => pickIdentity(DEFENDANT, caseDef.characters.defendant)}
          />
        ) : !bothJoined ? (
          <InviteLinkBanner />
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
                maxAttempts={MAX_CASE_ATTEMPTS}
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
                maxAttempts={MAX_CASE_ATTEMPTS}
                myLockedCardId={myLockedCardId}
                onLockIn={handleLockIn}
              />
            );
          })()
        )}

        {!showCasePicker && game ? (
          <Footer
            room={room}
            identity={me ? `${caseDef.characters[myRole]} · ${myRole === "investigator" ? "Investigator" : "Defendant"}` : undefined}
            onReset={handleResetCase}
            onNewRoom={handleNewRoom}
          />
        ) : null}
      </main>
    </div>
  );
}
