"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { APP_TITLE, type GameEntry, gameBySlug } from "@/lib/games/registry";
import GameCard from "./GameCard";
import HubOverlay from "./HubOverlay";
import JoinPanel from "./JoinPanel";
import YourRoomsList from "./YourRoomsList";
import { useIsDesktop } from "./useIsDesktop";
import { type SavedRoom, useSavedRooms } from "./useSavedRooms";

/** On the teal page: a 3px white focus outline, 2px offset (references/game-room/game-room-ui-spec.md, "Accessibility"). */
const FOCUS_RING_ON_TEAL = "focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-white";

type Open = { kind: "join"; slug: string; anchor: HTMLElement } | { kind: "rooms"; anchor: HTMLElement } | null;

function ListIcon() {
  return (
    <svg aria-hidden="true" width="20" height="16" viewBox="0 0 20 16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <path d="M2 2h16M2 8h16M2 14h10" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M4 10h12M11 5l5 5-5 5" />
    </svg>
  );
}

function CountBadge({ count }: { count: number }) {
  return (
    <span aria-hidden="true" className="flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-[#0F7983] px-1.5 text-[13px] font-bold leading-none text-white">
      {count}
    </span>
  );
}

/** "Continue": a pill that opens the most recently active room. */
function ContinueChip({ room }: { room: SavedRoom }) {
  const game = gameBySlug(room.gameSlug);
  return (
    <a
      href={`/${room.gameSlug}#${room.code}`}
      className={`inline-flex h-11 max-w-full items-center gap-2.5 self-start rounded-full bg-black/20 pr-3 pl-3.5 text-[15px] font-medium text-white no-underline min-[760px]:text-base ${FOCUS_RING_ON_TEAL}`}
    >
      <span className="shrink-0 font-bold">Continue</span>
      <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-[2px] outline-[1.5px] outline-white [outline-style:solid]" style={{ backgroundColor: game?.accentColor ?? "#FFFFFF" }} />
      <span className="min-w-0 truncate">
        {room.name || room.code}
        <span className="hidden min-[760px]:inline"> · {game?.title ?? room.gameSlug}</span>
      </span>
      <ArrowIcon />
    </a>
  );
}

/**
 * The Game Room hub (references/game-room/game-room-ui-spec.md and its
 * mockups in references/game-room/visual-design/):
 * - Header: title, subtitle, and a Continue chip for the latest room; on
 *   desktop the Your rooms button sits top right.
 * - Game cards, each with Start and Join.
 * - On mobile, Your rooms is a floating pill instead.
 * Join and Your rooms open one shared overlay: a popover anchored to the
 * button on desktop, a bottom sheet on mobile. Only one is open at a time.
 */
export default function Hub({ games }: { games: GameEntry[] }) {
  const desktop = useIsDesktop();
  const { rooms, loadedAt } = useSavedRooms();
  const [open, setOpen] = useState<Open>(null);
  const [startingSlug, setStartingSlug] = useState<string | null>(null);
  const titleId = useId();

  // Start opens the game's page with no #code - a full page load, so the game
  // creates the room itself (Co-Counsel recognizes its creator by arriving
  // with an empty hash). Set from an effect, per this repo's
  // react-hooks/immutability lint rule.
  useEffect(() => {
    if (startingSlug) window.location.href = new URL(`/${gameBySlug(startingSlug)?.startPath ?? startingSlug}`, window.location.origin).href;
  }, [startingSlug]);

  const close = useCallback(() => setOpen(null), []);
  const toggleJoin = (slug: string, anchor: HTMLElement) =>
    setOpen((current) => (current?.kind === "join" && current.slug === slug ? null : { kind: "join", slug, anchor }));
  const toggleRooms = (anchor: HTMLElement) => setOpen((current) => (current?.kind === "rooms" ? null : { kind: "rooms", anchor }));

  const latest = rooms[0];
  const roomsLabel = `Your rooms, ${rooms.length} saved`;
  const joinGame = open?.kind === "join" ? gameBySlug(open.slug) : undefined;

  return (
    <main className="px-4 pt-6 pb-[100px] min-[760px]:px-14 min-[760px]:pt-10 min-[760px]:pb-8">
      <header className="mb-5 flex items-start justify-between gap-6 min-[760px]:mb-6">
        <div className="flex min-w-0 flex-col gap-4">
          <h1
            className="m-0 self-start rounded-[9px] bg-white px-3.5 py-2 text-[26px] font-bold leading-none text-black shadow-[0_3px_8px_rgba(0,0,0,.3)] min-[760px]:px-4 min-[760px]:py-2.5 min-[760px]:text-[30px]"
            style={{ fontFamily: "var(--font-fredoka)", transform: "rotate(-2deg)" }}
          >
            {APP_TITLE}
          </h1>
          <p className="m-0 max-w-[520px] text-base font-medium leading-[1.35] text-white min-[760px]:text-[19px]">
            Pick a game. You&apos;ll get a private room to share with your partner.
          </p>
          {latest ? <ContinueChip room={latest} /> : null}
        </div>
        {rooms.length ? (
          <button
            type="button"
            aria-label={roomsLabel}
            aria-haspopup="dialog"
            aria-expanded={open?.kind === "rooms"}
            onClick={(e) => toggleRooms(e.currentTarget)}
            className={`hidden h-11 shrink-0 cursor-pointer items-center gap-2.5 rounded-xl border-2 border-black bg-white px-3.5 font-[family-name:var(--font-fredoka)] text-base font-bold text-black shadow-[0_3px_0_#000] transition-transform duration-[60ms] active:translate-y-[3px] active:shadow-none motion-reduce:transition-none min-[760px]:flex ${FOCUS_RING_ON_TEAL}`}
          >
            <ListIcon />
            Your rooms
            <CountBadge count={rooms.length} />
          </button>
        ) : null}
      </header>

      <div className="flex flex-col items-center gap-5 min-[760px]:flex-row min-[760px]:flex-wrap min-[760px]:items-start min-[760px]:justify-center min-[760px]:gap-14">
        {games.map((game, i) => (
          <div key={game.slug} className="w-full max-w-[440px] min-[760px]:w-[340px] min-[760px]:max-w-none">
            <GameCard
              game={game}
              index={i}
              startingSlug={startingSlug}
              joinOpen={open?.kind === "join" && open.slug === game.slug}
              onStart={setStartingSlug}
              onJoin={toggleJoin}
            />
          </div>
        ))}
      </div>

      <p className="mt-8 mb-0 text-center text-sm font-medium leading-[1.35] text-white min-[760px]:mt-6 min-[760px]:text-[15px]">
        No accounts. Send your partner the link and you&apos;re both in.
      </p>

      {rooms.length ? (
        <button
          type="button"
          aria-label={roomsLabel}
          aria-haspopup="dialog"
          aria-expanded={open?.kind === "rooms"}
          onClick={(e) => toggleRooms(e.currentTarget)}
          className={`fixed right-4 bottom-[calc(28px+env(safe-area-inset-bottom))] z-40 flex h-[52px] cursor-pointer items-center gap-2.5 rounded-full border-2 border-black bg-white px-5 font-[family-name:var(--font-fredoka)] text-base font-bold text-black shadow-[0_4px_0_#000,0_10px_24px_rgba(0,0,0,.3)] min-[760px]:hidden ${FOCUS_RING_ON_TEAL}`}
        >
          <ListIcon />
          Your rooms
          <CountBadge count={rooms.length} />
        </button>
      ) : null}

      {open?.kind === "join" && joinGame ? (
        <HubOverlay anchor={open.anchor} desktop={desktop} placement="above-center" title={`Join a ${joinGame.title} room`} labelledBy={titleId} onClose={close}>
          <JoinPanel gameTitle={joinGame.title} headingId={titleId} inSheet={!desktop} />
        </HubOverlay>
      ) : null}
      {open?.kind === "rooms" ? (
        <HubOverlay anchor={open.anchor} desktop={desktop} placement="below-right" title="Your rooms" labelledBy={titleId} sheetMaxHeightClass="max-h-[75vh]" onClose={close}>
          <YourRoomsList rooms={rooms} loadedAt={loadedAt} heading={desktop ? { id: titleId } : null} />
        </HubOverlay>
      ) : null}
    </main>
  );
}
