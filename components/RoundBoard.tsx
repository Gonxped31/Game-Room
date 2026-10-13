import { useEffect, useState } from "react";
import { ITEMS_PER_ROUND } from "@/lib/constants";
import type { CurrentRound } from "@/lib/game";
import { randomRound } from "@/lib/prompts";
import CardTable, { CellState, TableRow } from "./CardTable";
import Hand from "./Hand";
import Button from "./Button";
import CustomPromptForm from "./CustomPromptForm";

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
      : "The master is ranking the topics…";
  } else if (status === "GUESSING") {
    msg = !isMaster ? "Master's cards are locked. Guess their ranking." : "Ranking locked. Your partner is guessing…";
  } else {
    msg = shown ? "" : "Flipping cards…";
  }

  const hint =
    score === ITEMS_PER_ROUND
      ? "Perfect. You two are in sync."
      : score != null && score >= 3
        ? "Pretty close!"
        : "Not even close. Time to talk.";

  return (
    <div>
      {msg ? (
        <p aria-live="polite" className="mb-3.5 rounded-xl bg-white px-3.5 py-2.5 font-semibold text-black shadow-[0_3px_8px_rgba(0,0,0,.25)]">
          {msg}
        </p>
      ) : null}

      <CardTable
        prompt={prompt}
        headLeft={isMaster ? "You · master" : "Master"}
        headRight={!isMaster ? "You · guesser" : "Guesser"}
        rows={rows}
        onTapMaster={placing && isMaster ? tapSlot : undefined}
        onTapGuesser={placing && !isMaster ? tapSlot : undefined}
      />

      {placing ? (
        <div>
          <Hand numbers={hand} selected={sel} back={isMaster ? "m" : "g"} onSelect={(n) => setSel((s) => (s === n ? null : n))} />
          <Button disabled={!ready} onClick={submit}>
            {isMaster ? "Lock in my ranking" : "Submit final guess"}
          </Button>
          {isMaster ? (
            <div>
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
          <Button onClick={onNextRound}>Next round (roles swap)</Button>
        </div>
      ) : null}
    </div>
  );
}
