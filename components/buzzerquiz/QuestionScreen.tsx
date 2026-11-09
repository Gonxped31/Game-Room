"use client";

import { useEffect } from "react";
import type { SeatId } from "@/lib/session/types";
import { TOPIC_LABELS, type TopicId } from "@/lib/games/buzzerquiz/constants";
import { choicesLeft, type Outcome, pointsFor } from "@/lib/games/buzzerquiz/game";
import { useLang } from "@/lib/i18n/useLang";
import { NextPill } from "./Screens";
import { WORDS } from "./text";
import {
  BoltIcon,
  Buzzer,
  type BuzzerState,
  CheckIcon,
  ChoiceTile,
  type ChoiceLook,
  CrossIcon,
  DISPLAY,
  LABEL,
  LockIcon,
  ScoreBoard,
  type ScoreRow,
  seatColor,
  StatusBanner,
  TEXT,
  TimerRing,
} from "./ui";
import RulesButton from "./Rules";
import { PlayedRow, PowerHand } from "./PowerCards";
import type { Card } from "@/lib/games/buzzerquiz/constants";

const LETTERS = ["A", "B", "C", "D"];

/** Everything the question screen shows, derived by the page from the game state and the clock. */
export interface QuestionView {
  /** "question" covers the countdown's end before anyone has committed the reveal. */
  phase: "question" | "buzzing" | "answering" | "result";
  index: number;
  total: number;
  topic?: TopicId;
  question: string;
  /** In display order: bank index and text. */
  choices: { bank: number; text: string }[];
  struck: number[];
  lastPick?: { seat: SeatId; choice: number; right: boolean };
  outcome?: Outcome;
  buzzer?: SeatId;
  locked: SeatId[];
  me: SeatId | null;
  /** `me` plays this game (not a spectator). */
  playing: boolean;
  names: Partial<Record<SeatId, string>>;
  scores: ScoreRow[];
  /** Question timer: seconds left and the fraction of the 15 s left; paused while someone answers. */
  questionSeconds: number;
  questionFraction: number;
  /** Answer timer, while answering. */
  answerSeconds: number;
  answerFraction: number;
  /** Seconds until the next countdown, on the result. */
  nextSeconds: number;
  /** This device already buzzed this round (waiting for the window to close). */
  buzzedHere: boolean;
  /** Power cards, when the host turned them on. */
  cards?: CardsView;
}

export interface CardsView {
  /** This player's hand (empty for a spectator). */
  hand: Card[];
  /** They may play one now: none played yet this question, not buzzed, not locked out. */
  canPlay: boolean;
  played: Partial<Record<SeatId, Card>>;
  players: SeatId[];
  /** Seconds this player's buzzer stays frozen by someone else's Freeze (0: not frozen). */
  frozenSeconds: number;
  /** Wrong choices (bank indices) their 50/50 hides on this screen. */
  hidden: number[];
  /** On a right answer: who took a point from it with Steal. */
  stealers: SeatId[];
}

export default function QuestionScreen({ view, onBuzz, onPick, onPlay }: { view: QuestionView; onBuzz: () => void; onPick: (bank: number) => void; onPlay: (card: Card) => void }) {
  const lang = useLang();
  const t = WORDS[lang];
  const { phase, me, playing, names, buzzer, lastPick, outcome } = view;
  const name = (seat?: SeatId) => (seat ? (names[seat] ?? t.someone) : t.someone);
  const myTurn = phase === "answering" && buzzer === me;
  const lockedOut = me != null && view.locked.includes(me);
  const left = choicesLeft(view);
  const frozenFor = view.cards?.frozenSeconds ?? 0;
  const canBuzz = playing && phase === "question" && !lockedOut && !view.buzzedHere && frozenFor === 0;

  // Desktop keys: Space buzzes, A-D or 1-4 picks.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === " " && canBuzz) {
        e.preventDefault();
        onBuzz();
        return;
      }
      if (!myTurn) return;
      const key = e.key.toUpperCase();
      const position = LETTERS.indexOf(key) >= 0 ? LETTERS.indexOf(key) : ["1", "2", "3", "4"].indexOf(key);
      const choice = view.choices[position];
      if (choice && !view.struck.includes(choice.bank) && !(view.cards?.hidden ?? []).includes(choice.bank)) onPick(choice.bank);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canBuzz, myTurn, onBuzz, onPick, view.choices, view.struck, view.cards?.hidden]);

  // The "Worth" line.
  const worth =
    phase === "result"
      ? outcome?.kind === "right"
        ? t.worth(outcome.points)
        : t.noPoints
      : left <= 1
        ? t.noPoints
        : view.struck.length
          ? t.nowWorth(pointsFor(left))
          : t.worth(pointsFor(left));

  // The status banner, if any.
  let banner = null;
  if (phase === "answering" && buzzer && buzzer !== me) {
    banner = <StatusBanner fill={seatColor(buzzer)} color="var(--ink)" icon={<BoltIcon />} text={t.buzzed(name(buzzer))} side={t.choosing(view.answerSeconds)} />;
  } else if (myTurn) {
    banner = (
      <StatusBanner fill={seatColor(me!)} color="var(--ink)" text={t.yourTurn} side={`${view.answerSeconds} s`}>
        <div role="progressbar" aria-label={t.timeToAnswer} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(view.answerFraction * 100)} className="mt-2 h-1.5 overflow-hidden rounded-full bg-[rgba(22,17,58,.25)]">
          <div className="h-full rounded-full bg-[var(--ink)]" style={{ width: `${view.answerFraction * 100}%` }} />
        </div>
      </StatusBanner>
    );
  } else if (phase === "result" && outcome?.kind === "right") {
    const thieves = view.cards?.stealers ?? [];
    const stolen = thieves.length ? t.stole(thieves.map((seat) => ({ name: name(seat), me: seat === me }))) : "";
    banner = <StatusBanner fill="var(--right)" color="var(--right-ink)" icon={<CheckIcon />} text={`${t.gotIt(outcome.seat === me ? null : name(outcome.seat))}${stolen}`} side={`+${outcome.points}`} />;
  } else if (phase === "result" && outcome?.kind === "none") {
    const answer = view.choices.find((c) => c.bank === 0)?.text ?? "";
    banner = <StatusBanner fill="var(--text)" color="var(--ink)" text={t.nobodyScored(outcome.reason, answer)} />;
  } else if (lastPick && !lastPick.right && lastPick.seat === me && phase === "question") {
    banner = <StatusBanner fill="var(--disabled)" color="var(--text)" icon={<LockIcon />} text={t.wrongMe} />;
  } else if (lastPick && !lastPick.right && phase === "question") {
    banner = <StatusBanner fill="var(--text)" color="var(--ink)" icon={<span className="text-[var(--buzz)]"><CrossIcon /></span>} text={t.wrongOther(name(lastPick.seat), playing && !lockedOut)} />;
  } else if (lockedOut && phase === "question") {
    banner = <StatusBanner fill="var(--disabled)" color="var(--text)" icon={<LockIcon />} text={t.tooSlow} />;
  }

  // Each choice's look.
  const hidden = (bank: number) => (view.cards?.hidden ?? []).includes(bank);
  const lookOf = (bank: number): ChoiceLook => {
    if (view.struck.includes(bank)) return "struck";
    if (phase === "result") {
      if (outcome?.kind === "right") return bank === 0 ? "right" : "dimmed";
      return bank === 0 ? "answer" : "dimmed";
    }
    // 50/50: gone from this screen (dimmed, and not pickable).
    if (hidden(bank)) return "dimmed";
    return myTurn ? "pickable" : "default";
  };
  const struckBy = (bank: number) => (lastPick && lastPick.choice === bank ? (lastPick.seat === me ? t.yourPick : name(lastPick.seat)) : undefined);

  // The buzzer area.
  let buzzerState: BuzzerState = "ready";
  let caption = t.tapCaption;
  if (frozenFor > 0 && phase === "question" && !lockedOut) {
    buzzerState = "wait";
    caption = t.frozen(frozenFor);
  } else if (lockedOut) {
    buzzerState = "locked";
    caption = t.othersCanBuzz;
  } else if (phase === "answering") {
    buzzerState = "wait";
    caption = buzzer === me ? t.pickAbove : t.isAnswering(name(buzzer));
  } else if (phase === "buzzing" || view.buzzedHere) {
    buzzerState = "pressed";
    caption = t.buzzedCaption;
  }

  const timer = (
    <TimerRing
      seconds={view.questionSeconds}
      fraction={view.questionFraction}
      paused={phase === "buzzing" || phase === "answering"}
      label={t.secondsLeft(view.questionSeconds)}
    />
  );

  return (
    <div className="min-h-screen bg-[var(--stage)] px-4 pb-8 pt-3 text-[var(--text)] min-[900px]:px-8 min-[900px]:pt-6">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-3 min-[900px]:gap-5">
        <header className="flex items-center gap-3">
          <span className={`${DISPLAY} hidden text-[22px] font-extrabold min-[900px]:inline`}>Buzzer Quiz</span>
          <span className={`${DISPLAY} rounded-full bg-[var(--surface)] px-3 py-1.5 text-[15px] font-extrabold`}>
            {view.index + 1} / {view.total}
          </span>
          <span className={`${LABEL} min-w-0 flex-1 truncate`}>{view.topic ? TOPIC_LABELS[view.topic][lang] : ""}</span>
          {phase !== "result" ? timer : null}
          <RulesButton />
        </header>
        <div className="flex flex-col gap-3 min-[900px]:grid min-[900px]:grid-cols-[minmax(240px,300px)_1fr] min-[900px]:items-start min-[900px]:gap-6">
          <ScoreBoard rows={view.scores} />
          <main className="flex flex-col gap-3 min-[900px]:gap-4">
            <section className="rounded-[20px] bg-[var(--surface)] p-4 min-[900px]:rounded-3xl min-[900px]:p-7">
              <p className={`${TEXT} m-0 mb-1.5 text-[14px] font-bold text-[var(--points)] min-[900px]:text-[16px]`}>{worth}</p>
              <h1 className={`${DISPLAY} m-0 text-[24px] font-bold leading-[1.2] min-[900px]:text-[36px]`}>{view.question}</h1>
            </section>
            {banner}
            {view.cards ? <PlayedRow played={view.cards.played} players={view.cards.players} names={names} me={me} /> : null}
            <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 min-[900px]:grid-cols-2 min-[900px]:gap-3.5">
              {view.choices.map((choice, i) => (
                <li key={choice.bank}>
                  <ChoiceTile
                    letter={LETTERS[i]}
                    text={choice.text}
                    look={lookOf(choice.bank)}
                    note={view.struck.includes(choice.bank) ? struckBy(choice.bank) : hidden(choice.bank) && phase !== "result" ? "50/50" : undefined}
                    myColor={me ? seatColor(me) : "var(--p1)"}
                    onPick={() => onPick(choice.bank)}
                    compact={banner != null}
                  />
                </li>
              ))}
            </ul>
            <div className="mt-2 flex min-h-[200px] flex-col items-center justify-center gap-3">
              {phase === "result" ? (
                <NextPill text={view.index + 1 >= view.total ? t.resultsIn(view.nextSeconds) : t.nextQuestionIn(view.nextSeconds)} />
              ) : playing ? (
                <>
                  <Buzzer state={buzzerState} caption={caption} onBuzz={onBuzz} small={banner != null} />
                  {view.cards ? <PowerHand hand={view.cards.hand} canPlay={view.cards.canPlay} freezeOk={false} onPlay={onPlay} /> : null}
                  <p className={`${TEXT} m-0 hidden items-center gap-2 text-[14px] text-[var(--text-muted)] min-[900px]:flex`}>
                    {t.keysPress} <kbd className="rounded-md border-2 border-[var(--text-muted)] px-1.5 font-bold">{t.keysSpace}</kbd> {t.keysThen}{" "}
                    <kbd className="rounded-md border-2 border-[var(--text-muted)] px-1.5 font-bold">A–D</kbd>
                  </p>
                </>
              ) : (
                <p className={`${TEXT} m-0 rounded-2xl bg-[var(--surface)] px-4 py-3 text-[16px] font-bold text-[var(--text-muted)]`}>{t.watching}</p>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
