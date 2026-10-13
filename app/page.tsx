"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { GAME_TITLE, Role } from "@/lib/constants";
import {
  type CurrentRound,
  guesserOf,
  lockIn,
  masterOf,
  newGame,
  nextRound as advanceRound,
  setName,
  setPrompt,
  submitGuess,
} from "@/lib/game";
import { randomRound } from "@/lib/prompts";
import { generateRoomCode } from "@/lib/room";
import { createGameStore } from "@/lib/store";
import { createLocalStore } from "@/lib/store/localStore";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import RolePicker from "@/components/RolePicker";
import RoundBoard from "@/components/RoundBoard";
import RoleStickers from "@/components/RoleStickers";
import InviteLinkBanner from "@/components/InviteLinkBanner";
import SessionRecap from "@/components/SessionRecap";

const DEFAULT_ROOM = "our-private-room-id";

function subscribeToHash(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}
const getRoomSnapshot = () => (typeof window !== "undefined" ? window.location.hash.slice(1) || DEFAULT_ROOM : DEFAULT_ROOM);

export default function Page() {
  const room = useSyncExternalStore(subscribeToHash, getRoomSnapshot, () => DEFAULT_ROOM);

  const gameStore = useMemo(() => createGameStore(room), [room]);
  const game = useSyncExternalStore(gameStore.subscribe, gameStore.getSnapshot, () => null);

  const meStore = useMemo(() => createLocalStore<Role | null>(`ftw:me:${room}`, { crossTab: false }), [room]);
  const me = useSyncExternalStore(meStore.subscribe, meStore.getSnapshot, () => null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // A visitor with no #room in the URL at all gets their own fresh private
    // room instead of silently landing in the shared default - important now
    // that multiple pairs can play at once. Bail before touching gameStore
    // (still bound to the DEFAULT_ROOM placeholder this render) so we never
    // read or write that shared room on the way to the real one.
    if (!window.location.hash) {
      window.location.hash = generateRoomCode();
      return;
    }
    // The first client to open an empty (real) room creates it.
    if (game !== null) return;
    gameStore.transaction((current) => (current ? undefined : newGame(randomRound())));
  }, [game, gameStore]);

  const status = game?.current.status;
  const isMaster = game != null && me === masterOf(game.round);
  const other: Role | null = me === "p1" ? "p2" : me === "p2" ? "p1" : null;
  const placing = game != null && me != null && ((status === "RANKING" && isMaster) || (status === "GUESSING" && !isMaster));

  const names = game?.names ?? {};
  const bothJoined = Boolean(names.p1 && names.p2);
  const masterName = (game && names[masterOf(game.round)]) || "Master";
  const guesserName = (game && names[guesserOf(game.round)]) || "Guesser";
  const myRoleLabel = me != null ? (isMaster ? "Master" : "Guesser") : undefined;
  const myName = me != null ? names[me] : undefined;

  useEffect(() => {
    document.title = placing || (status === "REVEALED" && me) ? `▶ Your turn! · ${GAME_TITLE}` : GAME_TITLE;
  }, [placing, status, me]);

  const handlePick = (role: Role, name: string) => {
    meStore.set(role);
    gameStore.transaction((current) => {
      if (!current) return undefined;
      try {
        return setName(current, role, name);
      } catch {
        return undefined;
      }
    });
  };

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

  const handleNewRoom = () => {
    meStore.set(null);
    window.location.hash = generateRoomCode();
  };

  // RoundBoard's primary action renders in a bar fixed to the viewport
  // bottom while placing or revealed, which would otherwise cover the
  // Footer once scrolled all the way down (it's pinned to the screen, not
  // the page, so it sits over whatever is currently at the bottom - not
  // just RoundBoard's own last row). Reserve clearance for it here, after
  // the Footer, rather than inside RoundBoard itself.
  const hasFixedBar = bothJoined && (placing || status === "REVEALED");

  return (
    <main className={`mx-auto max-w-[520px] px-4 pt-3.5 ${hasFixedBar ? "pb-52" : "pb-7"}`}>
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
        <RolePicker names={names} onPick={handlePick} />
      ) : !bothJoined ? (
        <InviteLinkBanner />
      ) : (
        <>
          <RoleStickers masterName={masterName} guesserName={guesserName} isMaster={isMaster} />
          <RoundBoard
            key={`${game.round}-${status}-${game.current.items.map((i) => i.id).join("|")}`}
            status={game.current.status}
            isMaster={isMaster}
            placing={placing}
            prompt={game.current.prompt}
            items={game.current.items}
            masterName={masterName}
            guesserName={guesserName}
            usedPrompts={game.usedPrompts ?? []}
            masterOrder={game.current.masterOrder ?? null}
            guessOrder={game.current.guessOrder ?? null}
            score={game.current.score ?? null}
            onLockIn={handleLockIn}
            onSubmitGuess={handleSubmitGuess}
            onNextRound={handleNextRound}
            onChangePrompt={handleChangePrompt}
          />
          <SessionRecap history={game.history ?? []} names={names} />
        </>
      )}

      <Footer
        room={room}
        identity={myRoleLabel ? (myName ? `${myName} · ${myRoleLabel}` : myRoleLabel) : undefined}
        onReset={handleResetGame}
        onNewRoom={handleNewRoom}
      />
    </main>
  );
}
