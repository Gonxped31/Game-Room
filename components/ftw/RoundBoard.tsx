import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { ITEMS_PER_ROUND } from "@/lib/games/ftw/constants";
import type { CurrentRound, RoundItem, RoundStatus } from "@/lib/games/ftw/game";
import { handNotes, placeNote, rankOrder, resultHeadline, tapHandNote, tapItem, type Pick, type Placement } from "@/lib/games/ftw/placement";
import { randomRound } from "@/lib/games/ftw/prompts";
import CustomPromptForm from "./CustomPromptForm";
import Sheet, { RULED_ROW, SHEET_INSET } from "./Sheet";
import { CheckIcon, DISPLAY, EyeIcon, FOCUS, HAND, PenIcon, PrimaryButton, PlayerSquare, SmallButton, StickyNote, TEXT, TILTS } from "./ui";

const DRAG_THRESHOLD_PX = 8;
/** Hand notes: 60px, shrinking to fit five (and four 14px gaps) in a narrow column. */
const HAND_NOTE = "min(60px, calc((100cqw - 56px) / 5))";

/** The reveal's timeline (ms): rows 250ms apart, each flipping its two notes, then the highlighter and the mark. */
const REVEAL_START = 300;
const ROW_STEP = 250;
const ROW_DURATION = 600;
const COUNT_STEP = 120;
const revealEnd = () => REVEAL_START + (ITEMS_PER_ROUND - 1) * ROW_STEP + ROW_DURATION;

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

interface RoundBoardProps {
  status: RoundStatus;
  isRanker: boolean;
  /** Whether it's this player's move: ranking (the ranker) or guessing (the guesser). */
  placing: boolean;
  round: number;
  prompt: string;
  items: RoundItem[];
  partnerName: string;
  partnerColor: string;
  partnerOnline: boolean;
  /** Every prompt seen this session, so "Shuffle prompt" doesn't repeat one. */
  usedPrompts: string[];
  /** The topics "Shuffle prompt" draws from (empty: every topic). */
  topics: string[];
  masterOrder: string[] | null;
  guessOrder: string[] | null;
  score: number | null;
  /** Which items the player whose turn it is has filled so far (IDs only, from the shared round). */
  placed: string[];
  /** Reports this player's filled items as they place, while it's their turn. */
  onPlacedChange: (placed: string[]) => void;
  onLockIn: (order: string[]) => void;
  onSubmitGuess: (order: string[]) => void;
  onNextRound: () => void;
  /** "Leave room": gives up the seat and goes to the hub. */
  onLeave: () => void;
  /** Swaps the round's prompt/items while still RANKING (shuffle or custom prompt). */
  onChangePrompt: (round: CurrentRound) => void;
  /** The desktop aside's score card (phones show the scores in the header). */
  scoreCard: ReactNode;
  /** Topics and the session recap: under everything on phones, at the bottom of the aside on desktop. */
  extras: ReactNode;
}

/**
 * One phase of a round (RANKING, GUESSING or REVEALED), per
 * references/ftw/first-to-worst-game-design.md. The parent remounts this
 * component (a `key` of round+status+item IDs) whenever the phase or the item
 * set changes, so placement and the reveal always start fresh.
 *
 * Layout: one column on phones (banner, sheet, the hand and button docked at
 * the bottom, extras); from 900px an aside beside the sheet.
 */
export default function RoundBoard(props: RoundBoardProps) {
  if (props.status === "REVEALED") return <Reveal {...props} />;
  return props.placing ? <Placing {...props} /> : <Waiting {...props} />;
}

/** The two-column frame: `top` and `dock` (and `rest`) in the aside, `sheet` beside them. */
function Frame({ top, sheet, dock, rest, dockSticky }: { top: ReactNode; sheet: ReactNode; dock: ReactNode; rest?: ReactNode; dockSticky?: boolean }) {
  return (
    <div className="grid gap-3.5 min-[900px]:grid-cols-[minmax(300px,380px)_minmax(0,720px)] min-[900px]:grid-rows-[auto_auto_1fr] min-[900px]:justify-center min-[900px]:gap-x-12 min-[900px]:gap-y-5 min-[900px]:[grid-template-areas:'top_sheet'_'dock_sheet'_'rest_sheet']">
      <div className="flex flex-col gap-3.5 min-[900px]:[grid-area:top]">{top}</div>
      <div className="min-w-0 min-[900px]:[grid-area:sheet]">{sheet}</div>
      <div
        className={`flex flex-col gap-2.5 min-[900px]:[grid-area:dock] ${
          dockSticky ? "sticky bottom-0 z-10 -mx-4 bg-[var(--desk)] px-4 pt-2 pb-[max(10px,env(safe-area-inset-bottom))] min-[900px]:static min-[900px]:mx-0 min-[900px]:bg-transparent min-[900px]:p-0" : ""
        }`}
      >
        {dock}
      </div>
      {rest ? <div className="flex min-w-0 flex-col gap-3 min-[900px]:[grid-area:rest]">{rest}</div> : null}
    </div>
  );
}

/** "You're ranking" / "You're guessing": white, ink border, an icon circle, a bold and a muted line. */
function RoleBanner({ isRanker, partnerName }: { isRanker: boolean; partnerName: string }) {
  return (
    <div role="status" className={`${TEXT} flex items-center gap-3 rounded-2xl border-2 border-[var(--ink)] bg-white px-3.5 py-2.5 text-[var(--ink)]`}>
      <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-white">
        {isRanker ? <PenIcon size={18} /> : <EyeIcon size={18} />}
      </span>
      <span className="min-w-0">
        <span className="block text-base font-bold leading-tight">{isRanker ? "You're ranking" : "You're guessing"}</span>
        <span className="block text-sm font-medium leading-tight text-[var(--muted)]">
          {isRanker ? `${partnerName} will guess your order.` : `How did ${partnerName} rank these?`}
        </span>
      </span>
    </div>
  );
}

const SCALE = `1 = best · ${ITEMS_PER_ROUND} = worst`;

// ---- Ranking / guessing ---------------------------------------------------------------

function Placing({ isRanker, items, prompt, partnerName, partnerColor, usedPrompts, topics, placed, onPlacedChange, onLockIn, onSubmitGuess, onChangePrompt, scoreCard, extras }: RoundBoardProps) {
  const [placement, setPlacement] = useState<Placement>({});
  const [pick, setPick] = useState<Pick>(null);
  const [ghost, setGhost] = useState<{ n: number; x: number; y: number } | null>(null);
  const suppressNextClickRef = useRef(false);
  const handRefs = useRef(new Map<number, HTMLElement>());
  const noteRefs = useRef(new Map<number, HTMLElement>());
  /** A note just placed by tap: where it flew from, animated once it renders in its slot. */
  const flightRef = useRef<{ n: number; from: DOMRect } | null>(null);

  const itemIds = items.map((item) => item.id);
  const hand = handNotes(placement);
  const ready = hand.length === 0;

  // Report which items I've filled - IDs only, never the numbers, since the
  // other player can read the shared round - so they can watch notes appear.
  // Sent only when the set changes, starting from what the round already shows.
  const filledKey = itemIds.filter((id) => placement[id] != null).join("|");
  const lastSentRef = useRef(placed.join("|"));
  useEffect(() => {
    if (filledKey === lastSentRef.current) return;
    lastSentRef.current = filledKey;
    onPlacedChange(filledKey ? filledKey.split("|") : []);
  }, [filledKey, onPlacedChange]);

  // The note flies from the hand (or the item it was lifted off) to its slot
  // and lands with a 2deg wobble.
  useLayoutEffect(() => {
    const flight = flightRef.current;
    flightRef.current = null;
    const el = flight && noteRefs.current.get(flight.n);
    if (!flight || !el) return;
    const to = el.getBoundingClientRect();
    const dx = flight.from.left + flight.from.width / 2 - (to.left + to.width / 2);
    const dy = flight.from.top + flight.from.height / 2 - (to.top + to.height / 2);
    const scale = flight.from.width / to.width;
    const tilt = Number(el.dataset.tilt ?? 0);
    el.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${scale}) rotate(${tilt}deg)` },
        { transform: `rotate(${tilt + 2}deg)`, offset: 0.75 },
        { transform: `rotate(${tilt}deg)` },
      ],
      { duration: 220, easing: "ease-out" },
    );
  }, [placement]);

  const recordFlight = (n: number, from: string | null) => {
    if (reducedMotion()) return;
    const source = from == null ? handRefs.current.get(n) : noteRefs.current.get(n);
    if (source) flightRef.current = { n, from: source.getBoundingClientRect() };
  };

  const onTapItem = (id: string) => {
    if (suppressNextClickRef.current) return;
    if (pick && pick.from !== id) recordFlight(pick.n, pick.from);
    const next = tapItem(placement, pick, id);
    setPlacement(next.placement);
    setPick(next.pick);
  };

  const onTapHand = (n: number) => {
    if (suppressNextClickRef.current) return;
    setPick((current) => tapHandNote(current, n));
  };

  // Number keys 1-5 place that note on the focused item; Escape drops a pick.
  const onItemKeyDown = (id: string, e: KeyboardEvent<HTMLButtonElement>) => {
    const n = Number(e.key);
    if (Number.isInteger(n) && n >= 1 && n <= ITEMS_PER_ROUND) {
      e.preventDefault();
      setPlacement((current) => placeNote(current, n, id));
      setPick(null);
    } else if (e.key === "Escape") {
      setPick(null);
    }
  };

  // Drag to place or rearrange: an addition to tapping, built on Pointer
  // Events (the HTML5 drag API doesn't fire on touch screens). A gesture under
  // the threshold falls through as a normal click. Drops hit-test the rows'
  // data-drop-id; anywhere else (or the note's own item) changes nothing.
  const startDrag = (n: number, e: ReactPointerEvent<HTMLElement>) => {
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
      if (!dragging) return; // a plain tap: let the click through
      setGhost(null);
      // Swallow the click a same-element release still fires; clear on the
      // next tick, since a drop on another element fires no click at all.
      suppressNextClickRef.current = true;
      setTimeout(() => {
        suppressNextClickRef.current = false;
      }, 0);
      const dropId = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>("[data-drop-id]")?.dataset.dropId;
      if (!dropId) return;
      setPlacement((current) => placeNote(current, n, dropId));
      setPick(null);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const submit = () => (isRanker ? onLockIn(rankOrder(placement, itemIds)) : onSubmitGuess(rankOrder(placement, itemIds)));

  const caption = pick
    ? `Note ${pick.n} picked. Now tap an item.`
    : ready
      ? "Tap a note on the sheet to swap it."
      : "Tap a note, then an item.";
  const missing = hand.length;

  const sheet = (
    <Sheet prompt={prompt} caption={SCALE}>
      <ul aria-label="Items" className="m-0 list-none p-0">
        {items.map((item, i) => {
          const n = placement[item.id];
          const lifted = pick?.from === item.id;
          const target = pick != null && !lifted;
          return (
            <li key={item.id}>
              <button
                type="button"
                data-drop-id={item.id}
                aria-label={n != null ? `${item.label}, rank ${n}` : `${item.label}, no rank yet`}
                onClick={() => onTapItem(item.id)}
                onKeyDown={(e) => onItemKeyDown(item.id, e)}
                className={`flex min-h-[62px] w-full cursor-pointer items-center gap-3 border-0 py-1.5 pr-3 text-left min-[900px]:min-h-[82px] min-[900px]:pr-5 ${SHEET_INSET} ${RULED_ROW} ${FOCUS} focus-visible:outline-offset-[-3px]`}
              >
                <span className={`${HAND} min-w-0 flex-1 text-[23px] leading-[1.15] [overflow-wrap:anywhere] text-[var(--ink)] min-[900px]:text-[30px]`}>{item.label}</span>
                <span className="flex h-[50px] w-[50px] shrink-0 items-center justify-center min-[900px]:h-[60px] min-[900px]:w-[60px]">
                  {n != null ? (
                    <span
                      ref={(el) => {
                        if (el) noteRefs.current.set(n, el);
                        else noteRefs.current.delete(n);
                      }}
                      data-tilt={TILTS[i]}
                      onPointerDown={(e) => startDrag(n, e)}
                      style={{ touchAction: "none", transform: `rotate(${TILTS[i]}deg)` }}
                      className={`block rounded-[4px] transition-transform duration-150 ${lifted ? "outline-[3px] outline-offset-[3px] outline-[var(--ink)] [outline-style:solid]" : ""}`}
                    >
                      <StickyNote n={n} size="var(--slot-size)" className="[--slot-size:50px] min-[900px]:[--slot-size:60px]" />
                    </span>
                  ) : (
                    <span
                      aria-hidden="true"
                      className={`block h-full w-full rounded-md ${target ? "border-[3px] border-solid border-[var(--ink)] bg-[rgba(255,233,74,.35)]" : "border-[2.5px] border-dashed border-[var(--slot)]"}`}
                    />
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );

  const dock = (
    <>
      {!isRanker ? (
        <p role="status" className={`${TEXT} m-0 flex items-center justify-center gap-2 text-[15px] font-bold text-[var(--ink)] min-[900px]:justify-start`}>
          <PlayerSquare color={partnerColor} />
          {partnerName} locked in their order
          <CheckIcon size={18} strokeWidth={3} />
        </p>
      ) : null}
      <p aria-live="polite" className={`${TEXT} m-0 text-center text-[15px] font-medium text-[var(--muted)] min-[900px]:text-left`}>
        {caption}
      </p>
      <div className="[container-type:inline-size]">
        <div role="group" aria-label="Your notes" className="flex min-h-[calc(min(60px,(100cqw-56px)/5)+14px)] items-end justify-center gap-3.5 pt-3.5 min-[900px]:justify-start">
          {hand.map((n) => {
            const picked = pick?.n === n && pick.from == null;
            return (
              <button
                key={n}
                ref={(el) => {
                  if (el) handRefs.current.set(n, el);
                  else handRefs.current.delete(n);
                }}
                type="button"
                aria-label={`Note ${n}`}
                aria-pressed={picked}
                onClick={() => onTapHand(n)}
                onPointerDown={(e) => startDrag(n, e)}
                style={{ touchAction: "none" }}
                className={`cursor-pointer rounded-[4px] border-0 bg-transparent p-0 transition-transform duration-150 ease-[cubic-bezier(.34,1.56,.64,1)] motion-reduce:transition-none ${FOCUS} ${
                  picked ? "-translate-y-3 outline-[3px] outline-offset-[3px] outline-[var(--ink)] [outline-style:solid]" : ""
                }`}
              >
                <StickyNote n={n} size={HAND_NOTE} tilt={TILTS[n - 1]} />
              </button>
            );
          })}
        </div>
      </div>
      <PrimaryButton disabled={!ready} onClick={submit} className="mt-1">
        {ready ? (isRanker ? "Lock my ranking" : "Lock my guess") : `Place ${missing} more note${missing === 1 ? "" : "s"}`}
      </PrimaryButton>
    </>
  );

  const rest = (
    <>
      {isRanker ? (
        <div className="flex flex-col items-start gap-1">
          <SmallButton onClick={() => onChangePrompt(randomRound(usedPrompts, topics))}>Shuffle prompt</SmallButton>
          <CustomPromptForm onApply={onChangePrompt} />
        </div>
      ) : null}
      {extras}
    </>
  );

  return (
    <>
      {ghost ? (
        <div className="pointer-events-none fixed z-50 opacity-90" style={{ left: ghost.x - 30, top: ghost.y - 30 }}>
          <StickyNote n={ghost.n} size={60} tilt={-3} />
        </div>
      ) : null}
      <Frame
        top={
          <>
            <div className="hidden min-[900px]:block">{scoreCard}</div>
            <RoleBanner isRanker={isRanker} partnerName={partnerName} />
          </>
        }
        sheet={sheet}
        dock={dock}
        rest={rest}
        dockSticky
      />
    </>
  );
}

// ---- Waiting ----------------------------------------------------------------------------

/**
 * Not this player's move: the ranker after locking (their notes stay on the
 * sheet, read-only) or the guesser while the ranker ranks (the ranker's notes
 * appear face down as they're placed).
 */
function Waiting({ status, isRanker, items, prompt, partnerName, partnerOnline, masterOrder, placed, scoreCard, extras }: RoundBoardProps) {
  const progress = `${placed.length} of ${ITEMS_PER_ROUND} placed`;
  const myNote = (id: string) => (isRanker && status === "GUESSING" && masterOrder ? masterOrder.indexOf(id) + 1 : null);

  const sheet = (
    <Sheet prompt={prompt} caption={SCALE}>
      <ol aria-label="Items" className="m-0 list-none p-0">
        {items.map((item, i) => {
          const n = myNote(item.id);
          const faceDown = !isRanker && placed.includes(item.id);
          return (
            <li
              key={item.id}
              aria-label={n != null ? `${item.label}, rank ${n}` : faceDown ? `${item.label}, ${partnerName} placed a note` : item.label}
              className={`flex min-h-[62px] items-center gap-3 py-1.5 pr-3 min-[900px]:min-h-[82px] min-[900px]:pr-5 ${SHEET_INSET} ${RULED_ROW}`}
            >
              <span className={`${HAND} min-w-0 flex-1 text-[23px] leading-[1.15] [overflow-wrap:anywhere] text-[var(--ink)] min-[900px]:text-[30px]`}>{item.label}</span>
              <span className="flex h-[50px] w-[50px] shrink-0 items-center justify-center [--slot-size:50px] min-[900px]:h-[60px] min-[900px]:w-[60px] min-[900px]:[--slot-size:60px]">
                {n != null ? (
                  <StickyNote n={n} size="var(--slot-size)" tilt={TILTS[i]} />
                ) : faceDown ? (
                  <StickyNote n={null} size="var(--slot-size)" tilt={TILTS[i]} className="pop-in" />
                ) : (
                  <span aria-hidden="true" className="block h-full w-full rounded-md border-[2.5px] border-dashed border-[var(--slot)]" />
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </Sheet>
  );

  const dock = (
    <div role="status" className={`${TEXT} text-center text-[var(--muted)] min-[900px]:text-left`}>
      <p className="m-0 text-base font-bold">Waiting for {partnerName}…</p>
      <p className="m-0 mt-1 text-sm font-medium">
        {!partnerOnline ? `${partnerName} can play later.${isRanker ? " We'll keep your answers." : ""}` : isRanker ? `${partnerName} is guessing. ${progress}` : `${partnerName} is ranking. ${progress}`}
      </p>
    </div>
  );

  return (
    <Frame
      top={
        <>
          <div className="hidden min-[900px]:block">{scoreCard}</div>
          <RoleBanner isRanker={isRanker} partnerName={partnerName} />
        </>
      }
      sheet={sheet}
      dock={dock}
      rest={extras}
    />
  );
}

// ---- Reveal -----------------------------------------------------------------------------

function Reveal({ isRanker, round, items, prompt, partnerName, masterOrder, guessOrder, score, onNextRound, onLeave, scoreCard, extras }: RoundBoardProps) {
  const matches = score ?? 0;
  const [counted, setCounted] = useState(0);

  // The result counts up once the last row has revealed (at once with reduced motion).
  useEffect(() => {
    const reduce = reducedMotion();
    const timers = Array.from({ length: matches }, (_, i) => setTimeout(() => setCounted(i + 1), reduce ? 0 : revealEnd() + i * COUNT_STEP));
    return () => timers.forEach(clearTimeout);
  }, [matches]);

  const { headline, line } = resultHeadline(matches);
  const points = isRanker ? `+${matches} for ${firstName(partnerName)}` : `+${matches} for you`;
  const rankerLabel = isRanker ? "You" : firstName(partnerName);
  const guesserLabel = isRanker ? firstName(partnerName) : "You";
  const afterCount = { animationDelay: `${revealEnd() + matches * COUNT_STEP}ms` };

  const top = (
    <>
      <p className={`${TEXT} m-0 hidden text-[15px] font-bold tracking-[0.06em] text-[var(--muted)] uppercase min-[900px]:block`}>
        Round {round} · {isRanker ? `You ranked, ${partnerName} guessed` : `${partnerName} ranked, you guessed`}
      </p>
      <div role="status" className="text-center text-[var(--ink)] min-[900px]:text-left">
        <p className="sr-only">
          {matches}/{ITEMS_PER_ROUND}. {headline} {line} {points}.
        </p>
        <div aria-hidden="true">
          <div className={`${DISPLAY} text-[64px] leading-none min-[900px]:text-[120px]`}>
            {counted}/{ITEMS_PER_ROUND}
          </div>
          <div className="sp-fade-in" style={afterCount}>
            <div className={`${DISPLAY} mt-1 text-[26px] leading-tight min-[900px]:mt-2 min-[900px]:text-[40px]`}>{headline}</div>
            <div className={`${TEXT} mt-1 text-[15px] font-bold min-[900px]:text-[18px]`}>
              {line} {points}.
            </div>
          </div>
        </div>
      </div>
      <div className="hidden min-[900px]:block">{scoreCard}</div>
    </>
  );

  const sheet = (
    <Sheet prompt={prompt} caption={SCALE}>
      <div aria-hidden="true" className={`flex items-end gap-2 pr-3 pb-1 min-[900px]:gap-3 min-[900px]:pr-5 ${SHEET_INSET}`}>
        <span className="flex-1" />
        <span className={`${TEXT} w-11 truncate text-center text-[13px] font-bold text-[var(--muted)] min-[900px]:w-[60px]`}>{rankerLabel}</span>
        <span className={`${TEXT} w-11 truncate text-center text-[13px] font-bold text-[var(--muted)] min-[900px]:w-[60px]`}>{guesserLabel}</span>
        <span className="w-[26px]" />
      </div>
      <ol aria-label="Results" className="m-0 list-none p-0">
        {items.map((item, i) => {
          const m = masterOrder ? masterOrder.indexOf(item.id) + 1 : 0;
          const g = guessOrder ? guessOrder.indexOf(item.id) + 1 : 0;
          const match = m === g && m > 0;
          const at = REVEAL_START + i * ROW_STEP;
          const ms = (offset: number) => ({ animationDelay: `${at + offset}ms` });
          const rankerSays = isRanker ? `you ${m}` : `${firstName(partnerName)} ${m}`;
          const guesserSays = isRanker ? `${firstName(partnerName)} ${g}` : `you ${g}`;
          return (
            <li
              key={item.id}
              aria-label={`${item.label}: ${rankerSays}, ${guesserSays}, ${match ? "match" : "no match"}`}
              className={`flex min-h-[62px] items-center gap-2 py-1.5 pr-3 min-[900px]:min-h-[82px] min-[900px]:gap-3 min-[900px]:pr-5 ${SHEET_INSET} ${RULED_ROW}`}
            >
              <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                <span
                  className={`${HAND} -mx-1.5 rounded-[3px] px-1.5 text-[23px] leading-[1.15] text-[var(--ink)] [box-decoration-break:clone] min-[900px]:text-[30px] ${match ? "sp-highlight" : ""}`}
                  style={match ? ms(250) : undefined}
                >
                  {item.label}
                </span>
              </span>
              <span className="flex w-11 shrink-0 justify-center [--note:44px] min-[900px]:w-[60px] min-[900px]:[--note:60px]">
                <StickyNote n={m || null} size="var(--note)" tilt={-3} className="sp-flip-in" style={{ ...ms(0), "--tilt": "-3deg" } as CSSProperties} />
              </span>
              <span className="flex w-11 shrink-0 justify-center [--note:44px] min-[900px]:w-[60px] min-[900px]:[--note:60px]">
                <StickyNote n={g || null} size="var(--note)" tilt={3} className="sp-flip-in" style={{ ...ms(120), "--tilt": "3deg" } as CSSProperties} />
              </span>
              <span aria-hidden="true" className="sp-pop flex w-[26px] shrink-0 justify-center" style={ms(350)}>
                {match ? (
                  <span className="text-[var(--match-ink)]">
                    <CheckIcon size={24} strokeWidth={3.2} />
                  </span>
                ) : (
                  <span className={`${TEXT} text-[24px] font-bold leading-none text-[var(--miss)]`}>≠</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </Sheet>
  );

  const dock = (
    <>
      <PrimaryButton onClick={onNextRound}>Next round · {isRanker ? "you guess" : "you rank"}</PrimaryButton>
      <button type="button" onClick={onLeave} className={`${TEXT} cursor-pointer self-center rounded border-0 bg-transparent py-2 text-[15px] font-bold text-[var(--ink)] underline min-[900px]:self-start ${FOCUS}`}>
        Leave room
      </button>
    </>
  );

  return <Frame top={top} sheet={sheet} dock={dock} rest={extras} />;
}
