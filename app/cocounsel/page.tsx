"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useGameSession } from "@/lib/session/useGameSession";
import { LEAVE_CONFIRM, leaveToHub, roomProblemMessage } from "@/lib/session/shared/roomActions";
import InAppBrowserBanner from "@/components/InAppBrowserBanner";
import { caseForState, DEFAULT_CASE_ID } from "@/lib/games/cocounsel/cases";
import { DEFENDANT, GAME_TITLE, INVESTIGATOR, MAX_CASE_ATTEMPTS } from "@/lib/games/cocounsel/constants";
import { classifyDuo, continueAfterReveal, focusPercent, type GameState, lockIn, newGame, screenOfRole, totalAttempts, trustPercent } from "@/lib/games/cocounsel/game";
import { COLOR, CONTAINER_MAX_WIDTH_CLASS } from "@/lib/games/cocounsel/theme";
import { useTheme } from "@/lib/games/cocounsel/useTheme";
import InviteLinkBanner from "@/components/InviteLinkBanner";
import AdjournedScreen from "@/components/cocounsel/AdjournedScreen";
import CasePicker from "@/components/cocounsel/CasePicker";
import ConfirmRoleScreen from "@/components/cocounsel/ConfirmRoleScreen";
import Footer from "@/components/cocounsel/Footer";
import PartScreen from "@/components/cocounsel/PartScreen";
import RecapScreen from "@/components/cocounsel/RecapScreen";
import RevealScreen from "@/components/cocounsel/RevealScreen";
import RolePicker from "@/components/cocounsel/RolePicker";
import VerdictScreen from "@/components/cocounsel/VerdictScreen";
import Wordmark from "@/components/cocounsel/Wordmark";

export default function CoCounselPage() {
  // A new room starts on the default case; its owner then picks the real one
  // in CasePicker, which restarts the shared game on that case.
  const createInitialState = useCallback((): GameState => newGame(DEFAULT_CASE_ID), []);
  const session = useGameSession<GameState>({ gameSlug: "cocounsel", createInitialState });
  const { room, game, me, names, bothJoined, roomName, canRenameRoom, setRoomName, roomNameError, canTakeOver, pickIdentity, releaseAllIdentities, transact, setGame, newRoom } =
    session;
  // A brand-new room's owner picks the case BEFORE taking a seat, but the
  // database only accepts game writes from seated players - so that first
  // choice is held here and written once the owner's seat claim lands (see
  // claimRole). Until then the role picker already shows its characters.
  const [pendingCaseId, setPendingCaseId] = useState<string | null>(null);
  // The case lives in the shared game state, so both devices always play
  // the same one - whichever the owner last picked.
  const caseDef = caseForState(pendingCaseId ?? game?.caseId);
  const { theme, toggleTheme } = useTheme();

  // Whoever visits with no #room in the URL at all is the one about to
  // generate a fresh room and share its link - only THAT device should see
  // the case-picker; a device that opens an existing link joins a room that
  // already has its case chosen and skips straight past it. Captured via a
  // useState lazy initializer, which (like useRef) runs synchronously during
  // this component's very first render - strictly before any effects fire,
  // including useGameSession's own room-creating effect, which only writes
  // the new room's code into the hash once the room exists - so this
  // reliably observes the ORIGINAL hash before it's rewritten.
  // Safe from hydration mismatches despite reading `window` here: the JSX
  // branch that depends on it is already gated behind `!game`, which is
  // uniformly null on the very first paint for both server and client (see
  // the `!game` branch below), so this value can't affect anything until
  // well after hydration has completed.
  //
  // This reliably needs the hash to already be settled on `window.location`
  // by this component's very first render, which only a genuine fresh page
  // load (or a plain `<a>`/raw-URL visit) guarantees - a client-side
  // `router.push()` navigation from a different route does NOT reliably
  // guarantee this (confirmed live: joining via the picker's "Join a room"
  // form could show CasePicker to a joiner). The hub (`components/hub/`)
  // therefore does a hard navigation (`window.location.href`, not
  // `router.push`) specifically so this lazy initializer can stay simple and
  // correct here, rather than this component trying to work around an
  // unreliable signal.
  const [isCreator, setIsCreator] = useState<boolean | null>(() => (typeof window !== "undefined" ? window.location.hash === "" : null));
  // The room's owner picks every case. `isCreator` covers the first visit
  // (before the room's meta has loaded); `canRenameRoom` (meta.createdBy is
  // this guest) keeps the owner recognised after a reload, when the hash is
  // already set and `isCreator` reads false.
  const isOwner = isCreator === true || canRenameRoom;
  const isJoiner = !isOwner;

  // Local, not synced: whether the owner has been through CasePicker since
  // creating the room. Only a fresh creation shows it unprompted - an owner
  // reopening an existing room resumes play and can reach the picker via
  // the back link or "Start a new case". A joiner never sees it at all
  // (isJoiner gates showCasePicker unconditionally below).
  const [caseConfirmed, setCaseConfirmed] = useState(false);
  // CasePicker is Co-Counsel's own "home" screen for its OWNER - every
  // screen's back link (see components/cocounsel/BackLink.tsx) re-shows it
  // via this, without touching the room, role claims, or game progress.
  // Cleared once the owner reconfirms via "Choose this case", resuming
  // wherever the shared game state actually has them.
  const [forceCasePicker, setForceCasePicker] = useState(false);
  const showCasePicker = isOwner && (forceCasePicker || (isCreator === true && !caseConfirmed));
  // Every screen's back link takes the owner back to case selection. A
  // joiner has no case-selection "home" (only the owner picks the case), and
  // a multiplayer room has no back link to the hub, so they get no ← at
  // all: the Footer's "Leave room" is the way out, for both.
  const handleBack = isJoiner ? undefined : () => setForceCasePicker(true);
  const [showRecap, setShowRecap] = useState(false);

  const myScreen = me ? screenOfRole(me) : null;
  const myRole: "investigator" | "defendant" = myScreen ?? "investigator";
  const otherRole: "investigator" | "defendant" = myRole === "investigator" ? "defendant" : "investigator";
  const investigatorTaken = Boolean(names[INVESTIGATOR]);
  const defendantTaken = Boolean(names[DEFENDANT]);

  // True while nothing has actually happened in the case yet - no card
  // locked in, no miss, still Part 1. Reopening a room with a remembered
  // seat (`me` already set from a previous visit) offers a "continue as X /
  // switch role" choice ONLY while this holds, so switching can never pull a
  // role out from under an already-active match; once there's real
  // progress, resuming silently (today's behavior) is both safe and the
  // only sensible option, so the choice is skipped entirely rather than
  // nagging with a confirm screen that has nothing meaningful to offer.
  const isFreshGame = Boolean(game) && game!.partIndex === 0 && game!.attempts === 0 && !game!.locks?.p1 && !game!.locks?.p2;
  // Local to this page visit, not synced or persisted - resets to false on
  // every fresh mount (i.e. every time the room is opened), which is what
  // makes needsRoleConfirm below re-prompt on each (re)join rather than only
  // once ever. Set true either by explicitly confirming on ConfirmRoleScreen
  // or by picking a role fresh via RolePicker (so a brand-new pick is never
  // immediately followed by a redundant "continue as X?" prompt).
  const [roleConfirmedThisVisit, setRoleConfirmedThisVisit] = useState(false);
  const needsRoleConfirm = Boolean(me) && isFreshGame && !roleConfirmedThisVisit;

  // Guards the auto-assign effect below from racing against THIS device's
  // own explicit pick (RolePicker's onPick handlers). A claim writes seats,
  // members and players in one update, but each reaches this component
  // through its own listener - so there's a render where the clicked role
  // already reads as taken while `me` (from `members`) isn't set yet. On that
  // render "the other role" looks like the only open one - exactly the
  // auto-assign trigger - and without this guard a device picking Defendant
  // could auto-assign itself Investigator instead. A ref, not state: only
  // ever read/written inside an effect or event handler below, never during
  // render, which react-hooks/refs forbids.
  const pickingRef = useRef(false);

  // Claims a role, then starts the owner's pending case choice (if any) now
  // that this device holds a seat and may write the game.
  const claimRole = (role: typeof INVESTIGATOR | typeof DEFENDANT) => {
    pickingRef.current = true;
    const claim = pickIdentity(role, caseDef.characters[screenOfRole(role)]);
    claim.finally(() => {
      pickingRef.current = false;
    });
    return claim.then(() => {
      if (pendingCaseId) {
        setGame(newGame(pendingCaseId));
        setPendingCaseId(null);
      }
    });
  };

  // With exactly two roles, once one is taken the other is already decided -
  // auto-claim it instead of making the second player tap a button whose
  // outcome is no longer really a choice. Only fires while genuinely
  // eligible to see RolePicker (game loaded, case confirmed, no seat of
  // mine to confirm, no pick of my own already in flight) and while exactly
  // one role is open: both open (nobody has picked yet) or both taken
  // (nothing left to decide) leave this alone. "Switch role" never passes
  // through here at all - it trades seats in one update (see
  // handleSwitchRole), so neither device is ever left without a seat.
  //
  // setRoleConfirmedThisVisit is called from pickIdentity's OWN .then(), not
  // synchronously in the effect body - react-hooks/set-state-in-effect
  // disallows the latter. This also keeps it correctly ordered: `me` only
  // updates once pickIdentity's shared write actually lands, which is always
  // at least one microtask after this synchronous .then() queues, so
  // roleConfirmedThisVisit is reliably true by the render where `me` first
  // reflects the auto-assigned role - no flash of a pointless confirm screen
  // for a role this device never chose to remember.
  useEffect(() => {
    if (!game || showCasePicker || me || pickingRef.current) return;
    if (investigatorTaken === defendantTaken) return;
    claimRole(investigatorTaken ? DEFENDANT : INVESTIGATOR).then(() => setRoleConfirmedThisVisit(true));
    // claimRole is rebuilt every render; the values it reads are all listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, showCasePicker, me, investigatorTaken, defendantTaken, pickIdentity, caseDef, pendingCaseId]);

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
  // Restarting a case resets only the game: seats live at the room level,
  // so both players keep their roles and go straight into Part 1 (they can
  // still trade roles from ConfirmRoleScreen next time they open the room).
  // "Rematch" and the footer's reset replay the SAME case; picking a
  // different one goes through CasePicker (handleChooseCase).
  const handleResetCase = () => {
    setGame(newGame(caseDef.id));
    setForceCasePicker(false);
  };
  const handleRematch = () => {
    setGame(newGame(caseDef.id));
    setForceCasePicker(false);
    setShowRecap(false);
  };
  // "Start a new case" / "Pick another case" (owner only): open CasePicker
  // with the just-played case marked. The other player stays on the ending
  // screen, waiting, until the owner's choice restarts the shared game.
  const handleOpenCasePicker = () => {
    setForceCasePicker(true);
    setShowRecap(false);
  };
  // Choosing the case the game is already on, mid-case, just resumes it;
  // anything else (another case, or replaying a finished one) starts it
  // fresh for both players.
  const handleChooseCase = (caseId: string) => {
    if (!me) setPendingCaseId(caseId);
    else if (!game || caseId !== game.caseId || game.phase === "CASE_DONE") setGame(newGame(caseId));
    setCaseConfirmed(true);
    setForceCasePicker(false);
  };
  const isCaseUnderway = Boolean(game) && (game!.partIndex > 0 || game!.attempts > 0 || Boolean(game!.locks?.p1 || game!.locks?.p2));
  const currentCaseStatus = game?.phase === "CASE_DONE" ? "done" : isCaseUnderway ? "inProgress" : "fresh";
  // Generating a brand new room via the footer's "New room" link makes this
  // device the creator of THAT room (even if it joined the current one via a
  // link) - reset the flag so the fresh room's case-picker shows correctly.
  // "Switch role instead": with the other player seated, trade seats with
  // them in one update; with their seat still empty, just move into it.
  const handleSwitchRole = () => {
    setRoleConfirmedThisVisit(true);
    if (bothJoined) {
      releaseAllIdentities();
      return;
    }
    const otherSeat = me === INVESTIGATOR ? DEFENDANT : INVESTIGATOR;
    void pickIdentity(otherSeat, caseDef.characters[screenOfRole(otherSeat)]);
  };
  // Asks first once both are playing: leaving ends the case for the partner.
  const handleLeave = () => void leaveToHub(session.leave, me && bothJoined ? LEAVE_CONFIRM : undefined);

  const handleNewRoom = () => {
    setIsCreator(true);
    setCaseConfirmed(false);
    setForceCasePicker(false);
    setPendingCaseId(null);
    newRoom();
  };

  return (
    <div className="min-h-screen w-full" data-theme={theme} style={{ backgroundColor: COLOR.paper }}>
      <InAppBrowserBanner />
      {/* No fixed-position chrome: the back link and theme toggle sit
          inline in each screen's own header (Wordmark, or a colored band's
          top row), so <main> reserves no top clearance and full-bleed bands
          start flush with the viewport. */}
      {/* A screen with a fixed bottom bar (PartScreen's Lock in) gets its height reserved below everything, the Footer included. */}
      <main className={`mx-auto font-[family-name:var(--font-archivo)] has-[[data-fixed-bar]]:pb-32 ${CONTAINER_MAX_WIDTH_CLASS}`} style={{ color: COLOR.ink }}>
        {roomProblemMessage(session) ? (
          // No room to leave here, so a plain way back to the hub.
          <div className="flex flex-col gap-3 px-4 pt-8 font-[family-name:var(--font-archivo)] text-base" style={{ color: COLOR.ink }}>
            <p role="alert" className="m-0">
              {roomProblemMessage(session)}
            </p>
            <Link href="/" className="self-start font-bold underline" style={{ color: COLOR.text2 }}>
              Back to all games
            </Link>
          </div>
        ) : !game ? (
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
          <CasePicker
            currentCaseId={caseDef.id}
            currentStatus={currentCaseStatus}
            onChoose={handleChooseCase}
            theme={theme}
            onToggleTheme={toggleTheme}
          />
        ) : needsRoleConfirm ? (
          <ConfirmRoleScreen
            caseDef={caseDef}
            myRole={myRole}
            onContinue={() => setRoleConfirmedThisVisit(true)}
            onSwitchRole={handleSwitchRole}
            onBack={handleBack}
            theme={theme}
            onToggleTheme={toggleTheme}
          />
        ) : !me ? (
          <RolePicker
            caseDef={caseDef}
            investigatorTaken={investigatorTaken}
            defendantTaken={defendantTaken}
            canTakeOverInvestigator={Boolean(canTakeOver[INVESTIGATOR])}
            canTakeOverDefendant={Boolean(canTakeOver[DEFENDANT])}
            onPickInvestigator={() => {
              void claimRole(INVESTIGATOR);
              setRoleConfirmedThisVisit(true);
            }}
            onPickDefendant={() => {
              void claimRole(DEFENDANT);
              setRoleConfirmedThisVisit(true);
            }}
            onBack={handleBack}
            theme={theme}
            onToggleTheme={toggleTheme}
          />
        ) : !bothJoined ? (
          <div className="px-4 pt-3.5">
            <Wordmark onBack={handleBack} theme={theme} onToggleTheme={toggleTheme} />
            <div className="mt-4">
              <InviteLinkBanner
                room={room}
                roomName={roomName}
                onRenameRoom={canRenameRoom ? setRoomName : undefined}
                nameError={roomNameError}
                accentColor={COLOR.yellow}
                accentShadowColor={COLOR.ink}
                accentTextColor={COLOR.ink}
              />
            </div>
          </div>
        ) : game.phase === "CASE_DONE" ? (
          showRecap ? (
            <RecapScreen caseDef={caseDef} onBackToVerdict={() => setShowRecap(false)} onBack={handleBack} theme={theme} onToggleTheme={toggleTheme} />
          ) : // How the case ended is read back from the log's last entry, not
          // `lastReveal` (already cleared by continueAfterReveal by the time
          // CASE_DONE renders) - "solved" is the only celebratory ending;
          // "judgeRevealed"/"adjourned" both mean the attempt budget ran out.
          game.log.at(-1)?.outcome !== "solved" ? (
            <AdjournedScreen
              investigatorName={caseDef.characters.investigator}
              defendantName={caseDef.characters.defendant}
              endedPartIndex={game.partIndex}
              totalParts={caseDef.parts.length}
              verdict={game.log.at(-1)?.outcome === "judgeRevealed" ? caseDef.verdict : undefined}
              onSeeRecap={() => setShowRecap(true)}
              onStartNewCase={isOwner ? handleOpenCasePicker : undefined}
              onBack={handleBack}
              theme={theme}
              onToggleTheme={toggleTheme}
            />
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
              onPickAnotherCase={isOwner ? handleOpenCasePicker : undefined}
              onBack={handleBack}
              theme={theme}
              onToggleTheme={toggleTheme}
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
            const continueLabel = reveal.outcome === "adjourned" ? "See what happened" : isLastPart ? "See the verdict" : `Continue to Part ${game.partIndex + 2}`;
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
                onBack={handleBack}
                theme={theme}
                onToggleTheme={toggleTheme}
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
                onBack={handleBack}
                theme={theme}
                onToggleTheme={toggleTheme}
              />
            );
          })()
        )}

        {game ? (
          <Footer
            room={room}
            roomName={roomName}
            identity={me ? `${caseDef.characters[myRole]} · ${myRole === "investigator" ? "Investigator" : "Defendant"}` : undefined}
            onReset={handleResetCase}
            onNewRoom={handleNewRoom}
            onLeave={handleLeave}
          />
        ) : null}
      </main>
    </div>
  );
}
