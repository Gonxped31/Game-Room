"use client";

import { useCallback, useEffect, useId, useState, type MouseEvent, type ReactNode } from "react";
import { MATCH_GAMES } from "@/lib/games/matchGames";
import { APP_TITLE, type GameEntry, gameBySlug, gamePath, roomHref } from "@/lib/games/registry";
import GameCard, { SoloCard } from "./GameCard";
import HubOverlay from "./HubOverlay";
import JoinPanel from "./JoinPanel";
import MatchPanel from "./MatchPanel";
import YourRoomsList from "./YourRoomsList";
import { useIsDesktop } from "./useIsDesktop";
import { type SavedRoom, useSavedRooms } from "./useSavedRooms";

/** Tokens from references/game-room/game-room-ui-spec.md, "Tokens". */
const SOCIAL = "#0B3C49";
const SOCIAL_ACCENT = "#FFE94A";
const TALK = "#FFE94A";
const SOLO = "#2B2466";
const SOLO_ACCENT = "#FF8FC7";

/** On teal and on the dark folders: a 3px white focus outline, 2px offset ("Accessibility"). */
const FOCUS_RING_ON_DARK = "focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-white";
/** On the yellow panel: a 3px black one. */
const FOCUS_RING_ON_YELLOW = "focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-black";

const SECTION_IDS = { social: "social-games", talk: "talk-it-out", solo: "solo-games" } as const;

type Open = { kind: "join" | "matchmaking"; slug: string; anchor: HTMLElement } | { kind: "rooms"; anchor: HTMLElement } | null;

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

/** Two people: the Social folder's tab icon. */
function PeopleIcon({ className }: { className: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="8.5" cy="7.5" r="3.5" />
      <circle cx="16.5" cy="8.5" r="3" />
      <path d="M2 19.5c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6v.5H2z" />
      <path d="M15.6 20v-.5c0-2-.7-3.8-2-5 .9-.5 1.9-.8 2.9-.8 3 0 5.5 2 5.5 5.3v1z" />
    </svg>
  );
}

/** One person: the Solo folder's tab icon. */
function PersonIcon({ className }: { className: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="7.5" r="4" />
      <path d="M4.5 20.5c0-4.2 3.4-7 7.5-7s7.5 2.8 7.5 7v.5h-15z" />
    </svg>
  );
}

function GlobeIcon({ className }: { className: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
    </svg>
  );
}

function SpeechIcon({ className }: { className: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-9l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z" />
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

const gamesLabel = (n: number) => `${n} game${n === 1 ? "" : "s"}`;

/** "Continue": a pill that opens the most recently active room. */
function ContinueChip({ room }: { room: SavedRoom }) {
  const game = gameBySlug(room.gameSlug);
  return (
    <a
      href={roomHref(room.gameSlug, room.code)}
      className={`inline-flex h-11 max-w-full items-center gap-2.5 self-start rounded-full bg-black/20 pr-3 pl-3.5 text-[15px] font-medium text-white no-underline min-[760px]:text-base ${FOCUS_RING_ON_DARK}`}
    >
      <span className="shrink-0 font-bold">Continue</span>
      <span
        aria-hidden="true"
        className="h-2.5 w-2.5 shrink-0 rounded-[2px] outline-[1.5px] outline-white [outline-style:solid]"
        style={{ backgroundColor: game?.continueColor ?? game?.accentColor ?? "#FFFFFF" }}
      />
      <span className="min-w-0 truncate">
        {room.name || room.code}
        <span className="hidden min-[760px]:inline"> · {game?.title ?? room.gameSlug}</span>
      </span>
      <ArrowIcon />
    </a>
  );
}

/**
 * A folder: a colored panel with a tab on its top-left corner ("Folder").
 * The top margin equals the tab's height, so the tab never overlaps the block
 * above.
 */
function Folder({
  id,
  color,
  accent,
  icon,
  title,
  shortTitle,
  count,
  description,
  children,
}: {
  id: string;
  color: string;
  accent: string;
  icon: (className: string) => ReactNode;
  title: string;
  shortTitle: string;
  count: number;
  description: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="relative mt-[50px] min-[760px]:mt-[62px]">
      <div
        className="absolute bottom-[calc(100%-2px)] left-0 flex h-[50px] items-center gap-2.5 rounded-t-[18px] pr-4 pl-2.5 min-[760px]:h-[62px] min-[760px]:gap-3.5 min-[760px]:rounded-t-[22px] min-[760px]:pr-[26px] min-[760px]:pl-3"
        style={{ backgroundColor: color }}
      >
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 -rotate-4 items-center justify-center rounded-[10px] text-black min-[760px]:h-[42px] min-[760px]:w-[42px] min-[760px]:rounded-xl"
          style={{ backgroundColor: accent }}
        >
          {icon("h-5 w-5 min-[760px]:h-[26px] min-[760px]:w-[26px]")}
        </span>
        <h2 id={id} className="m-0 scroll-mt-[70px] whitespace-nowrap text-[22px] font-bold leading-none text-white min-[760px]:text-[28px]">
          <span className="min-[760px]:hidden">{shortTitle}</span>
          <span className="hidden min-[760px]:inline">{title}</span>
        </h2>
        <span className="flex h-6 shrink-0 items-center rounded-full bg-white/16 px-2.5 text-xs font-semibold whitespace-nowrap text-white min-[760px]:h-7 min-[760px]:px-3 min-[760px]:text-sm">
          {gamesLabel(count)}
        </span>
      </div>
      <div
        className="flex flex-col gap-3.5 rounded-[0_22px_22px_22px] bg-[length:16px_16px] px-3 pt-4 pb-3.5 shadow-[0_6px_0_rgba(0,0,0,.18)] min-[760px]:gap-[26px] min-[760px]:rounded-[0_30px_30px_30px] min-[760px]:bg-[length:20px_20px] min-[760px]:px-8 min-[760px]:pt-[30px] min-[760px]:pb-[34px]"
        style={{ backgroundColor: color, backgroundImage: "radial-gradient(circle, rgba(255,255,255,.07) 1.4px, transparent 1.6px)" }}
      >
        <p className="m-0 text-[15px] font-medium leading-[1.35] text-white/92 min-[760px]:text-[18px]">{description}</p>
        {children}
      </div>
    </section>
  );
}

/** "Play from anywhere": globe circle, heading, a rule filling the row, then the line under it. */
function AnywhereHeading() {
  return (
    <div>
      <div className="flex items-center gap-2.5">
        <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-white/70 text-white min-[760px]:h-[34px] min-[760px]:w-[34px]">
          <GlobeIcon className="h-4 w-4 min-[760px]:h-5 min-[760px]:w-5" />
        </span>
        <h3 className="m-0 text-[18px] font-bold whitespace-nowrap text-white min-[760px]:text-[22px]">Play from anywhere</h3>
        <span aria-hidden="true" className="h-0.5 flex-1 bg-white/22" />
      </div>
      <p className="m-0 mt-1 pl-[38px] text-sm font-medium text-white/85 min-[760px]:pl-11 min-[760px]:text-base">
        <span className="hidden min-[760px]:inline">The game shows everyone what&apos;s happening. </span>No need to talk.
      </p>
    </div>
  );
}

const TALK_STEPS = ["Start a call, or sit side by side.", "Each of you opens the room on your own phone.", "Talk it through. The game won't tell you everything."];

/** "Talk it out": the bright yellow block inside the Social folder, so the need for a call is the most visible thing on the page. */
function TalkPanel({ children }: { children: ReactNode }) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-3 rounded-[18px] px-2.5 pt-3.5 pb-3 shadow-[0_6px_0_rgba(0,0,0,.25)] min-[760px]:mt-2 min-[760px]:rounded-[26px] min-[760px]:px-[26px] min-[760px]:pt-[26px] min-[760px]:gap-[28px] min-[760px]:pb-[30px]" style={{ backgroundColor: TALK }}>
      <div className="flex min-w-0 flex-[1_1_100%] flex-col gap-3 text-black min-[760px]:flex-[1_1_260px] min-[760px]:gap-4">
        <div className="flex items-center gap-2.5">
          <span aria-hidden="true" className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-black min-[760px]:h-[38px] min-[760px]:w-[38px]" style={{ color: TALK }}>
            <SpeechIcon className="h-4 w-4 min-[760px]:h-5 min-[760px]:w-5" />
          </span>
          <h3 id={SECTION_IDS.talk} className="m-0 scroll-mt-[70px] text-[20px] font-bold text-black min-[760px]:text-[26px]">
            Talk it out
          </h3>
        </div>
        <p className="m-0 text-[15px] font-medium leading-[1.35] text-[#1A1A1A] min-[760px]:hidden">You&apos;ll need to talk to win. Get on a call or sit together.</p>
        <span className="inline-flex h-[30px] items-center gap-1.5 self-start rounded-full bg-black px-3 text-[13px] font-semibold text-white">
          <PhoneIcon />
          Call or same room
        </span>
        <ol className="m-0 hidden list-none flex-col gap-2.5 p-0 min-[760px]:flex">
          {TALK_STEPS.map((step, i) => (
            <li key={step} className="flex items-start gap-2.5 text-base font-medium leading-[1.35]">
              <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black text-[13px] font-bold" style={{ color: TALK }}>
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>
      {/* Desktop: the two cards to the right of the steps; mobile: stacked under them. */}
      <div className="flex w-full flex-col gap-2.5 min-[760px]:mt-0 min-[760px]:w-auto min-[760px]:flex-row min-[760px]:flex-wrap min-[760px]:items-stretch min-[760px]:gap-[28px]">{children}</div>
    </div>
  );
}

/** Desktop rows of 300px cards with a 28px gap (wrapping); mobile, a 14px stack. */
function CardRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3.5 min-[760px]:flex-row min-[760px]:flex-wrap min-[760px]:items-stretch min-[760px]:gap-[28px]">{children}</div>;
}

/**
 * The Game Room hub (references/game-room/game-room-ui-spec.md, v2 sections):
 * - Header: title, subtitle, and a Continue chip for the latest room; on
 *   desktop the Your rooms button sits top right. On mobile, jump buttons
 *   under it.
 * - The Social folder: "Play from anywhere" cards, then the yellow "Talk it
 *   out" panel. Then the Solo folder.
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
    if (startingSlug) window.location.href = new URL(gamePath(startingSlug), window.location.origin).href;
  }, [startingSlug]);

  const close = useCallback(() => setOpen(null), []);
  const toggleJoin = (slug: string, anchor: HTMLElement) =>
    setOpen((current) => (current?.kind === "join" && current.slug === slug ? null : { kind: "join", slug, anchor }));
  const toggleMatchmaking = (slug: string, anchor: HTMLElement) =>
    setOpen((current) => (current?.kind === "matchmaking" && current.slug === slug ? null : { kind: "matchmaking", slug, anchor }));
  const toggleRooms = (anchor: HTMLElement) => setOpen((current) => (current?.kind === "rooms" ? null : { kind: "rooms", anchor }));

  const latest = rooms[0];
  const roomsLabel = `Your rooms, ${rooms.length} saved`;
  const joinGame = open?.kind === "join" ? gameBySlug(open.slug) : undefined;
  const matchGame = open?.kind === "matchmaking" ? gameBySlug(open.slug) : undefined;
  const matchConfig = open?.kind === "matchmaking" ? MATCH_GAMES[open.slug] : undefined;

  const anywhere = games.filter((game) => game.section === "anywhere");
  const talk = games.filter((game) => game.section === "talk");
  const solo = games.filter((game) => game.solo);

  const card = (game: GameEntry) => (
    <GameCard
      key={game.slug}
      game={game}
      startingSlug={startingSlug}
      joinOpen={open?.kind === "join" && open.slug === game.slug}
      onStart={setStartingSlug}
      onJoin={toggleJoin}
      onMatchmaking={MATCH_GAMES[game.slug] ? toggleMatchmaking : undefined}
      matchmakingOpen={open?.kind === "matchmaking" && open.slug === game.slug}
    />
  );

  return (
    <main className="flex flex-col gap-[22px] px-4 pt-[22px] pb-[110px] font-[family-name:var(--font-fredoka)] min-[760px]:gap-12 min-[760px]:px-14 min-[760px]:pt-10 min-[760px]:pb-9">
      <header className="flex items-start justify-between gap-6">
        <div className="flex min-w-0 flex-col gap-4">
          <h1 className="m-0 -rotate-2 self-start rounded-[9px] bg-white px-3.5 py-2 text-[26px] font-bold leading-none text-black shadow-[0_3px_8px_rgba(0,0,0,.3)] min-[760px]:px-4 min-[760px]:py-2.5 min-[760px]:text-[30px]">
            {APP_TITLE}
          </h1>
          <p className="m-0 max-w-[560px] text-[17px] font-medium leading-[1.35] text-white min-[760px]:text-[19px]">
            Pick a game. You&apos;ll get a private room and a link to share.
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
            className={`hidden h-11 shrink-0 cursor-pointer items-center gap-2.5 rounded-xl border-2 border-black bg-white px-3.5 text-base font-bold text-black shadow-[0_3px_0_#000] transition-transform duration-[60ms] active:translate-y-[3px] active:shadow-none motion-reduce:transition-none min-[760px]:flex ${FOCUS_RING_ON_DARK}`}
          >
            <ListIcon />
            Your rooms
            <CountBadge count={rooms.length} />
          </button>
        ) : null}
      </header>

      <JumpButtons />

      <Folder
        id={SECTION_IDS.social}
        color={SOCIAL}
        accent={SOCIAL_ACCENT}
        icon={(className) => <PeopleIcon className={className} />}
        title="Social games"
        shortTitle="Social"
        count={anywhere.length + talk.length}
        description="Two or more players, each on their own device."
      >
        <AnywhereHeading />
        <CardRow>{anywhere.map(card)}</CardRow>
        <TalkPanel>{talk.map(card)}</TalkPanel>
      </Folder>

      {solo.length ? (
        <Folder
          id={SECTION_IDS.solo}
          color={SOLO}
          accent={SOLO_ACCENT}
          icon={(className) => <PersonIcon className={className} />}
          title="Solo games"
          shortTitle="Solo"
          count={solo.length}
          description="Play on your own, anytime."
        >
          <CardRow>
            {solo.map((game) => (
              <SoloCard key={game.slug} game={game} />
            ))}
            <div className="hidden min-h-[120px] min-w-[220px] flex-1 items-center justify-center rounded-[20px] border-[2.5px] border-dashed border-white/35 p-4 text-center text-base font-semibold text-white/75 min-[760px]:flex">
              More solo games coming
            </div>
          </CardRow>
        </Folder>
      ) : null}

      <p className="m-0 text-center text-sm font-medium leading-[1.35] text-white min-[760px]:text-[15px]">No accounts. Send the link and everyone&apos;s in.</p>

      {rooms.length ? (
        <button
          type="button"
          aria-label={roomsLabel}
          aria-haspopup="dialog"
          aria-expanded={open?.kind === "rooms"}
          onClick={(e) => toggleRooms(e.currentTarget)}
          className={`fixed right-1 bottom-[calc(16px+env(safe-area-inset-bottom))] z-40 flex h-[52px] cursor-pointer items-center gap-2.5 rounded-full border-2 border-black bg-white px-5 text-base font-bold text-black shadow-[0_4px_0_#000,0_10px_24px_rgba(0,0,0,.3)] min-[760px]:hidden ${FOCUS_RING_ON_DARK}`}
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
      {open?.kind === "matchmaking" && matchGame && matchConfig ? (
        <HubOverlay anchor={open.anchor} desktop={desktop} placement="above-center" title={`${matchGame.title} matchmaking`} labelledBy={titleId} onClose={close}>
          <MatchPanel game={matchConfig} gameTitle={matchGame.title} headingId={titleId} inSheet={!desktop} />
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

const JUMPS = [
  { id: SECTION_IDS.social, label: "Social", fill: SOCIAL, text: "#FFFFFF", square: SOCIAL_ACCENT, focus: FOCUS_RING_ON_DARK },
  { id: SECTION_IDS.talk, label: "Talk it out", fill: TALK, text: "#000000", square: null, focus: FOCUS_RING_ON_YELLOW },
  { id: SECTION_IDS.solo, label: "Solo", fill: SOLO, text: "#FFFFFF", square: SOLO_ACCENT, focus: FOCUS_RING_ON_DARK },
];

/**
 * Mobile only: anchor links to each section's heading. A click scrolls there
 * (smoothly, unless reduced motion is on) without touching the URL's hash.
 */
function JumpButtons() {
  const jump = (e: MouseEvent<HTMLAnchorElement>, id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };
  return (
    <nav aria-label="Game types" className="flex flex-wrap gap-2 min-[760px]:hidden">
      {JUMPS.map((j) => (
        <a
          key={j.id}
          href={`#${j.id}`}
          onClick={(e) => jump(e, j.id)}
          className={`inline-flex h-[38px] items-center gap-2 rounded-full px-[13px] text-[15px] font-bold no-underline ${j.focus}`}
          style={{ backgroundColor: j.fill, color: j.text }}
        >
          {j.square ? <span aria-hidden="true" className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: j.square }} /> : null}
          {j.label}
        </a>
      ))}
    </nav>
  );
}
