import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ITEMS_PER_ROUND } from "@/lib/constants";
import type { CurrentRound } from "@/lib/game";
import { randomRound } from "@/lib/prompts";
import CardFace from "./CardFace";
import CardTable, { CellState, TableRow } from "./CardTable";
import Hand from "./Hand";
import Button from "./Button";
import CustomPromptForm from "./CustomPromptForm";

const GHOST_SIZE = { width: 68, height: 102 }; // matches the min(15vw,68px) card width at its 2:3 aspect ratio
const DRAG_THRESHOLD_PX = 8;

export type RoundStatus = "RANKING" | "GUESSING" | "REVEALED";

interface Item {
  id: string;
  label: string;
}

interface RoundBoardProps {
  status: RoundStatus;
  isMaster: boolean;
  placing: boolean;
  prompt: string;
  items: Item[];
  masterName: string;
  guesserName: string;
  /** Every prompt seen this session, so "Shuffle prompt" doesn't repeat one - see lib/game.ts's usedPrompts. */
  usedPrompts: string[];
  masterOrder: string[] | null;
  guessOrder: string[] | null;
  score: number | null;
  onLockIn: (order: string[]) => void;
  onSubmitGuess: (order: string[]) => void;
  onNextRound: () => void;
  /** Swaps the round's prompt/items while still RANKING (shuffle or custom prompt). */
  onChangePrompt: (round: CurrentRound) => void;
}

/**
 * One phase of a round (RANKING, GUESSING or REVEALED). The parent remounts
 * this component (via a `key` including round+status+item IDs) whenever the
 * phase or the item set changes, so placement state and the reveal stagger
 * always start fresh without needing a reset effect.
 */
export default function RoundBoard({
  status,
  isMaster,
  placing,
  prompt,
  items,
  masterName,
  guesserName,
  usedPrompts,
  masterOrder,
  guessOrder,
  score,
  onLockIn,
  onSubmitGuess,
  onNextRound,
  onChangePrompt,
}: RoundBoardProps) {
  const [assign, setAssign] = useState<Record<string, number>>({});
  const [sel, setSel] = useState<number | null>(null);
  const [shown, setShown] = useState(false);
  const [ghost, setGhost] = useState<{ n: number; x: number; y: number } | null>(null);
  const suppressNextClickRef = useRef(false);

  useEffect(() => {
    if (status !== "REVEALED") return;
    const t = setTimeout(() => setShown(true), 900);
    return () => clearTimeout(t);
  }, [status]);

  const itemIds = items.map((x) => x.id);
  const used = new Set(Object.values(assign));
  const hand = Array.from({ length: ITEMS_PER_ROUND }, (_, i) => i + 1).filter((k) => !used.has(k));
  const ready = hand.length === 0;
  const order = () => [...itemIds].sort((a, b) => (assign[a] ?? 0) - (assign[b] ?? 0));

  const tapSlot = (id: string) => {
    if (!placing) return;
    if (sel != null) {
      setAssign((a) => ({ ...a, [id]: sel }));
      setSel(null);
      return;
    }
    if (assign[id]) {
      setAssign((a) => {
        const next = { ...a };
        delete next[id];
        return next;
      });
    }
  };

  // Drag-to-place: an addition to tap-to-place (tapSlot above), not a
  // replacement - if a gesture never moves past the threshold it's left to
  // fall through as a normal click (tap-to-select). Hit-testing uses
  // data-drop-id (set on CardSlot only when that slot is interactive) via
  // elementFromPoint, rather than wiring refs through CardTable/CardSlot.
  const handleDragStart = (n: number, e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!placing) return;
    const startX = e.clientX;
    const startY = e.clientY;
    let dragging = false;

    const onMove = (ev: PointerEvent) => {
      if (!dragging) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_THRESHOLD_PX) return;
        dragging = true;
      }
      setGhost({ n, x: ev.clientX, y: ev.clientY });
    };

    const onUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      if (!dragging) return; // let the native click fire for a plain tap
      setGhost(null);
      suppressNextClickRef.current = true;
      const target = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>("[data-drop-id]");
      const dropId = target?.dataset.dropId;
      if (dropId) {
        setAssign((a) => ({ ...a, [dropId]: n }));
        setSel(null);
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const submit = () => {
    if (isMaster) {
      onLockIn(order());
    } else {
      onSubmitGuess(order());
    }
  };

  const delay = (i: number) => (shown ? i * 0.25 : 0);

  const side = (id: string, who: "m" | "g", i: number): CellState => {
    const mine = (who === "m") === isMaster;
    const mNum = masterOrder ? masterOrder.indexOf(id) + 1 : 0;
    const gNum = guessOrder ? guessOrder.indexOf(id) + 1 : 0;

    if (status === "REVEALED") {
      const n = who === "m" ? mNum : gNum;
      const cell: CellState = { kind: "card", n: n || undefined, up: shown, delay: delay(i) };
      if (who === "g" && shown) {
        cell.badge = masterOrder && guessOrder && masterOrder.indexOf(id) === guessOrder.indexOf(id) ? "ok" : "no";
        cell.badgeDelay = delay(i) + 0.6;
      }
      return cell;
    }
    if (mine && placing) {
      return assign[id] ? { kind: "card", n: assign[id], up: true } : { kind: "empty" };
    }
    if (who === "m" && status === "GUESSING") {
      return { kind: "card", n: isMaster ? mNum || undefined : undefined, up: false };
    }
    return { kind: "empty" };
  };

  const rows: TableRow[] = items.map((item, i) => ({
    id: item.id,
    label: item.label,
    matched:
      status === "REVEALED" &&
      shown &&
      !!masterOrder &&
      !!guessOrder &&
      masterOrder.indexOf(item.id) === guessOrder.indexOf(item.id),
    master: side(item.id, "m", i),
    guesser: side(item.id, "g", i),
  }));

  let msg = "";
  if (status === "RANKING") {
    msg = isMaster
      ? `Tap a number, then tap a topic slot. Rank from 1 (first) to ${ITEMS_PER_ROUND} (worst).`
      : `${masterName} is ranking the topics…`;
  } else if (status === "GUESSING") {
    msg = !isMaster ? "Master's cards are locked. Guess their ranking." : `Ranking locked. ${guesserName} is guessing…`;
  } else {
    msg = shown ? "" : "Flipping cards…";
  }

  const hint =
    score === ITEMS_PER_ROUND
      ? "Perfect. You two are in sync."
      : score != null && score >= 3
        ? "Pretty close!"
        : "Not even close. Time to talk.";

  // Pinned to the screen (not just stuck once scrolled to) so the primary
  // action is reachable without ANY scrolling, however tall the table gets.
  // Centered the same way <main> is, since `fixed` escapes that container.
  // The bottom-clearance padding for this lives on <main> in app/page.tsx,
  // not here - this bar is pinned to the VIEWPORT, so it also covers the
  // Footer (which comes after this component in the document) once scrolled
  // all the way down, not just this component's own last row.
  const fixedBar =
    "fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[520px] border-t border-white/15 bg-[#128A94] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-6px_14px_rgba(0,0,0,.25)]";

  return (
    <div>
      {ghost ? (
        <div
          style={{
            position: "fixed",
            left: ghost.x - GHOST_SIZE.width / 2,
            top: ghost.y - GHOST_SIZE.height / 2,
            width: GHOST_SIZE.width,
            height: GHOST_SIZE.height,
            pointerEvents: "none",
            zIndex: 50,
            opacity: 0.9,
          }}
        >
          <CardFace n={ghost.n} up back={isMaster ? "m" : "g"} />
        </div>
      ) : null}

      {msg ? (
        <p aria-live="polite" className="mb-3.5 rounded-xl bg-white px-3.5 py-2.5 font-semibold text-black shadow-[0_3px_8px_rgba(0,0,0,.25)]">
          {msg}
        </p>
      ) : null}

      <CardTable
        prompt={prompt}
        headLeft={isMaster ? `${masterName} (You)` : masterName}
        headRight={!isMaster ? `${guesserName} (You)` : guesserName}
        rows={rows}
        onTapMaster={placing && isMaster ? tapSlot : undefined}
        onTapGuesser={placing && !isMaster ? tapSlot : undefined}
      />

      {placing ? (
        <div>
          <div className={fixedBar}>
            <Hand
              numbers={hand}
              selected={sel}
              back={isMaster ? "m" : "g"}
              onSelect={(n) => {
                if (suppressNextClickRef.current) {
                  suppressNextClickRef.current = false;
                  return;
                }
                setSel((s) => (s === n ? null : n));
              }}
              onDragStart={handleDragStart}
            />
            <Button disabled={!ready} onClick={submit}>
              {isMaster ? "Lock in my ranking" : "Submit final guess"}
            </Button>
          </div>
          {isMaster ? (
            <div className="mt-3">
              <Button variant="sm" onClick={() => onChangePrompt(randomRound(usedPrompts))}>
                Shuffle prompt
              </Button>
              <CustomPromptForm onApply={onChangePrompt} />
            </div>
          ) : null}
        </div>
      ) : null}

      {status === "REVEALED" && shown ? (
        <div aria-live="polite">
          <div
            className="big-score mt-4 text-center text-7xl font-bold text-[#FFE14D]"
            style={{ textShadow: "0 4px 0 rgba(0,0,0,.35)", animationDelay: `${ITEMS_PER_ROUND * 0.25}s` }}
          >
            {score} / {ITEMS_PER_ROUND}
          </div>
          <p className="mt-2 text-center text-sm opacity-95">{hint}</p>
          <div className={fixedBar}>
            <Button onClick={onNextRound}>Next round (roles swap)</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
