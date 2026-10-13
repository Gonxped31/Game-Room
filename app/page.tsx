"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { GAME_TITLE, Role } from "@/lib/constants";
import { type CurrentRound, lockIn, masterOf, newGame, nextRound as advanceRound, setPrompt, submitGuess } from "@/lib/game";
import { randomRound } from "@/lib/prompts";
import { createGameStore } from "@/lib/store";
import { createLocalStore } from "@/lib/store/localStore";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import RolePicker from "@/components/RolePicker";
import RoundBoard from "@/components/RoundBoard";

const DEFAULT_ROOM = "our-private-room-id";
const noopSubscribe = () => () => {};
const getRoomSnapshot = () => (typeof window !== "undefined" ? window.location.hash.slice(1) || DEFAULT_ROOM : DEFAULT_ROOM);

export default function Page() {
  const room = useSyncExternalStore(noopSubscribe, getRoomSnapshot, () => DEFAULT_ROOM);

  const gameStore = useMemo(() => createGameStore(room), [room]);
  const game = useSyncExternalStore(gameStore.subscribe, gameStore.getSnapshot, () => null);

  const meStore = useMemo(() => createLocalStore<Role | null>(`ftw:me:${room}`, { crossTab: false }), [room]);
  const me = useSyncExternalStore(meStore.subscribe, meStore.getSnapshot, () => null);

  // The first client to open an empty room creates it.
  useEffect(() => {
    if (game !== null) return;
    gameStore.transaction((current) => (current ? undefined : newGame(randomRound())));
  }, [game, gameStore]);

  const status = game?.current.status;
  const isMaster = game != null && me === masterOf(game.round);
  const other: Role | null = me === "p1" ? "p2" : me === "p2" ? "p1" : null;
  const placing = game != null && me != null && ((status === "RANKING" && isMaster) || (status === "GUESSING" && !isMaster));

  useEffect(() => {
    document.title = placing || (status === "REVEALED" && me) ? `▶ Your turn! · ${GAME_TITLE}` : GAME_TITLE;
  }, [placing, status, me]);

  const handleLockIn = (order: string[]) => {
    gameStore.transaction((current) => {
      if (!current) return undefined;
      try {
        return lockIn(current, order);
      } catch {
        return undefined;
      }
    });
  };

  const handleSubmitGuess = (order: string[]) => {
    gameStore.transaction((current) => {
      if (!current) return undefined;
      try {
        return submitGuess(current, order);
      } catch {
        return undefined;
      }
    });
  };

  const handleChangePrompt = (round: CurrentRound) => {
    gameStore.transaction((current) => {
      if (!current) return undefined;
      try {
        return setPrompt(current, round);
      } catch {
        return undefined;
      }
    });
  };

  const handleNextRound = () => {
    gameStore.transaction((current) => {
      if (!current) return undefined;
      try {
        return advanceRound(current, randomRound(current.usedPrompts ?? []));
      } catch {
        return undefined;
      }
    });
  };

  const handleResetGame = () => {
    gameStore.set(newGame(randomRound()));
  };

  return (
    <main className="mx-auto max-w-[520px] px-4 pb-7 pt-3.5">
      <Header
        round={me && game ? game.round : undefined}
        myScore={me && game ? game.totals[me] : undefined}
        theirScore={me && game && other ? game.totals[other] : undefined}
      />

      {!game ? (
        <p className="rounded-xl bg-white px-3.5 py-2.5 font-semibold text-black shadow-[0_3px_8px_rgba(0,0,0,.25)]">
          Connecting to the room…
        </p>
      ) : !me ? (
        <RolePicker onPick={(role) => meStore.set(role)} />
      ) : (
        <RoundBoard
          key={`${game.round}-${status}-${game.current.items.map((i) => i.id).join("|")}`}
          status={game.current.status}
          isMaster={isMaster}
          placing={placing}
          prompt={game.current.prompt}
          items={game.current.items}
          usedPrompts={game.usedPrompts ?? []}
          masterOrder={game.current.masterOrder ?? null}
          guessOrder={game.current.guessOrder ?? null}
          score={game.current.score ?? null}
          onLockIn={handleLockIn}
          onSubmitGuess={handleSubmitGuess}
          onNextRound={handleNextRound}
          onChangePrompt={handleChangePrompt}
        />
      )}

      <Footer
        room={room}
        role={me ? (isMaster ? "Master" : "Guesser") : undefined}
        onChangeRole={() => meStore.set(null)}
        onReset={handleResetGame}
      />
    </main>
  );
}
