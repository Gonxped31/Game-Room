import { type Archetype, type EcRole, nextToPlace, type RoundState } from "@/lib/games/ecard/game";
import Button from "@/components/Button";
import CardFace from "./CardFace";
import Hand from "./Hand";

interface CellInfo {
  empty: boolean;
  up: boolean;
  archetype?: Archetype;
}

interface RoundBoardProps {
  round: RoundState;
  myRole: EcRole;
  emperorName: string;
  slaveName: string;
  /** True once round 12 has resolved decisively - no more rounds to play. */
  isComplete: boolean;
  onPlay: (cardId: string) => void;
  onContinue: () => void;
  onNextRound: () => void;
}

function cellFor(round: RoundState, role: EcRole, myRole: EcRole): CellInfo {
  const placement = round.firstPlacement?.role === role ? round.firstPlacement : round.secondPlacement?.role === role ? round.secondPlacement : undefined;
  if (!placement) return { empty: true, up: false };
  // my own card is always shown face-up once I've placed it (I know what I played); the opponent's stays face-down until REVEALED.
  const up = round.status === "REVEALED" || role === myRole;
  return { empty: false, up, archetype: up ? placement.archetype : undefined };
}

export default function RoundBoard({ round, myRole, emperorName, slaveName, isComplete, onPlay, onContinue, onNextRound }: RoundBoardProps) {
  const isEmperor = myRole === "emperor";
  // Realtime Database drops empty arrays on write, so a fully-spent hand can
  // round-trip as undefined rather than [] - tolerate that same as the game logic does.
  const myHand = (isEmperor ? round.emperorHand : round.slaveHand) ?? [];
  const canPlace = nextToPlace(round) === myRole;

  const emperorCell = cellFor(round, "emperor", myRole);
  const slaveCell = cellFor(round, "slave", myRole);

  const opponentName = isEmperor ? slaveName : emperorName;
  const winnerName = round.result === "emperor" ? emperorName : round.result === "slave" ? slaveName : null;

  let msg = "";
  if (round.status === "PLACING") {
    msg = canPlace ? "Tap a card to play it face-down." : `Waiting for ${opponentName} to place…`;
  } else if (round.result === "tie") {
    msg = "Tied! Both Citizens are out - the round continues.";
  } else {
    msg = `${winnerName} wins this exchange!`;
  }

  const hasFixedBar = canPlace || round.status === "REVEALED";

  return (
    <div className={hasFixedBar ? "pb-40" : undefined}>
      <p aria-live="polite" className="mb-3.5 rounded-xl bg-white px-3.5 py-2.5 text-center font-semibold text-black shadow-[0_3px_8px_rgba(0,0,0,.25)]">
        {msg}
      </p>

      <div className="mb-1.5 grid grid-cols-2 gap-3 text-center text-[13px] font-semibold">
        <span>{isEmperor ? "You (Emperor)" : emperorName}</span>
        <span>{!isEmperor ? "You (Slave)" : slaveName}</span>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-3">
        <div className="aspect-[2/3] w-full justify-self-center" style={{ width: "min(28vw,120px)" }}>
          {emperorCell.empty ? (
            <div
              role="img"
              aria-label={`${isEmperor ? "Your" : emperorName + "'s"} slot: empty`}
              className="h-full w-full rounded-[9px] border-2 border-dashed border-white/60 bg-black/10"
            />
          ) : (
            <div role="img" aria-label={`${isEmperor ? "Your" : emperorName + "'s"} slot: ${emperorCell.up ? emperorCell.archetype : "face down"}`}>
              <CardFace archetype={emperorCell.archetype} up={emperorCell.up} back="emperor" />
            </div>
          )}
        </div>
        <div className="aspect-[2/3] w-full justify-self-center" style={{ width: "min(28vw,120px)" }}>
          {slaveCell.empty ? (
            <div
              role="img"
              aria-label={`${!isEmperor ? "Your" : slaveName + "'s"} slot: empty`}
              className="h-full w-full rounded-[9px] border-2 border-dashed border-white/60 bg-black/10"
            />
          ) : (
            <div role="img" aria-label={`${!isEmperor ? "Your" : slaveName + "'s"} slot: ${slaveCell.up ? slaveCell.archetype : "face down"}`}>
              <CardFace archetype={slaveCell.archetype} up={slaveCell.up} back="slave" />
            </div>
          )}
        </div>
      </div>

      {canPlace ? (
        <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[520px] border-t border-white/15 bg-[#128A94] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-6px_14px_rgba(0,0,0,.25)]">
          <Hand cards={myHand} back={isEmperor ? "emperor" : "slave"} onPlay={onPlay} />
        </div>
      ) : null}

      {round.status === "REVEALED" ? (
        <div aria-live="polite" className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[520px] border-t border-white/15 bg-[#128A94] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-6px_14px_rgba(0,0,0,.25)]">
          {round.result === "tie" ? (
            <Button onClick={onContinue}>Continue this round</Button>
          ) : isComplete ? (
            <p className="m-0 text-center font-bold text-[#FFE14D]">Game complete! Final scores above.</p>
          ) : (
            <Button onClick={onNextRound}>Next round</Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
