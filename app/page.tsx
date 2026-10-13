"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { GAME_TITLE, Role } from "@/lib/constants";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import RolePicker from "@/components/RolePicker";
import RoundBoard, { RoundStatus } from "@/components/RoundBoard";

/**
 * Stage 1: static card-table UI with the flip animation, no game logic
 * module and no store yet. Both roles are played locally via "Change role"
 * so the full RANKING -> GUESSING -> REVEALED flow can be eyeballed in one
 * tab. lib/game.ts, lib/scoring.ts and the real store land in Stage 2/3.
 */
const PROMPT = "Pizza toppings";
const STATIC_ITEMS = [
  { id: "i0_pepperoni", label: "Pepperoni" },
  { id: "i1_mushrooms", label: "Mushrooms" },
  { id: "i2_pineapple", label: "Pineapple" },
  { id: "i3_anchovies", label: "Anchovies" },
  { id: "i4_jalapenos", label: "Jalapenos" },
];

const masterOf = (round: number): Role => (round % 2 === 1 ? "p1" : "p2");
const matches = (a: string[], b: string[]) => a.filter((id, i) => b[i] === id).length;

const DEFAULT_ROOM = "our-private-room-id";
const noopSubscribe = () => () => {};
const getRoomSnapshot = () => (typeof window !== "undefined" ? window.location.hash.slice(1) || DEFAULT_ROOM : DEFAULT_ROOM);

export default function Page() {
  const room = useSyncExternalStore(noopSubscribe, getRoomSnapshot, () => DEFAULT_ROOM);

  const [me, setMe] = useState<Role | null>(null);
  const [round, setRound] = useState(1);
  const [totals, setTotals] = useState<{ p1: number; p2: number }>({ p1: 0, p2: 0 });
  const [status, setStatus] = useState<RoundStatus>("RANKING");
  const [masterOrder, setMasterOrder] = useState<string[] | null>(null);
  const [guessOrder, setGuessOrder] = useState<string[] | null>(null);
  const [score, setScore] = useState<number | null>(null);

  const isMaster = me === masterOf(round);
  const other: Role = me === "p1" ? "p2" : "p1";
  const placing = me != null && ((status === "RANKING" && isMaster) || (status === "GUESSING" && !isMaster));

  useEffect(() => {
    document.title = placing || (status === "REVEALED" && me) ? `▶ Your turn! · ${GAME_TITLE}` : GAME_TITLE;
  }, [placing, status, me]);

  const handleLockIn = (order: string[]) => {
    setMasterOrder(order);
    setStatus("GUESSING");
  };

  const handleSubmitGuess = (order: string[]) => {
    const s = matches(order, masterOrder ?? []);
    setGuessOrder(order);
    setScore(s);
    if (me) setTotals((t) => ({ ...t, [me]: t[me] + s }));
    setStatus("REVEALED");
  };

  const nextRound = () => {
    setRound((r) => r + 1);
    setStatus("RANKING");
    setMasterOrder(null);
    setGuessOrder(null);
    setScore(null);
  };

  const resetGame = () => {
    setRound(1);
    setTotals({ p1: 0, p2: 0 });
    setStatus("RANKING");
    setMasterOrder(null);
    setGuessOrder(null);
    setScore(null);
  };

  return (
    <main className="mx-auto max-w-[520px] px-4 pb-7 pt-3.5">
      <Header round={me ? round : undefined} myScore={me ? totals[me] : undefined} theirScore={me ? totals[other] : undefined} />

      {!me ? (
        <RolePicker onPick={setMe} />
      ) : (
        <RoundBoard
          key={`${round}-${status}`}
          status={status}
          isMaster={isMaster}
          placing={placing}
          prompt={PROMPT}
          items={STATIC_ITEMS}
          masterOrder={masterOrder}
          guessOrder={guessOrder}
          score={score}
          onLockIn={handleLockIn}
          onSubmitGuess={handleSubmitGuess}
          onNextRound={nextRound}
        />
      )}

      <Footer room={room} onChangeRole={() => setMe(null)} onReset={resetGame} />
    </main>
  );
}
