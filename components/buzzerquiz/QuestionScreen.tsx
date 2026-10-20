"use client";

import { useEffect } from "react";
import type { SeatId } from "@/lib/session/types";
import { TOPIC_LABELS, type TopicId } from "@/lib/games/buzzerquiz/constants";
import { choicesLeft, type Outcome, pointsFor } from "@/lib/games/buzzerquiz/game";
import { NextPill } from "./Screens";
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
}

export default function QuestionScreen({ view, onBuzz, onPick }: { view: QuestionView; onBuzz: () => void; onPick: (bank: number) => void }) {
  const { phase, me, playing, names, buzzer, lastPick, outcome } = view;
  const name = (seat?: SeatId) => (seat ? (names[seat] ?? "Someone") : "Someone");
  const myTurn = phase === "answering" && buzzer === me;
  const lockedOut = me != null && view.locked.includes(me);
  const left = choicesLeft(view);
  const canBuzz = playing && phase === "question" && !lockedOut && !view.buzzedHere;

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
      if (choice && !view.struck.includes(choice.bank)) onPick(choice.bank);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canBuzz, myTurn, onBuzz, onPick, view.choices, view.struck]);

  // The "Worth" line.
  const worth =
    phase === "result"
      ? outcome?.kind === "right"
        ? `Worth ${outcome.points} point${outcome.points === 1 ? "" : "s"}`
        : "No points this time"
      : left <= 1
        ? "No points this time"
        : `${view.struck.length ? "Now worth" : "Worth"} ${pointsFor(left)} point${pointsFor(left) === 1 ? "" : "s"}`;

  // The status banner, if any.
  let banner = null;
  if (phase === "answering" && buzzer && buzzer !== me) {
    banner = <StatusBanner fill={seatColor(buzzer)} color="var(--ink)" icon={<BoltIcon />} text={`${name(buzzer)} buzzed!`} side={`Choosing… ${view.answerSeconds} s`} />;
  } else if (myTurn) {
    banner = (
      <StatusBanner fill={seatColor(me!)} color="var(--ink)" text="Your turn! Pick an answer" side={`${view.answerSeconds} s`}>
        <div role="progressbar" aria-label="Time to answer" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(view.answerFraction * 100)} className="mt-2 h-1.5 overflow-hidden rounded-full bg-[rgba(22,17,58,.25)]">
          <div className="h-full rounded-full bg-[var(--ink)]" style={{ width: `${view.answerFraction * 100}%` }} />
        </div>
      </StatusBanner>
    );
  } else if (phase === "result" && outcome?.kind === "right") {
    banner = <StatusBanner fill="var(--right)" color="var(--right-ink)" icon={<CheckIcon />} text={outcome.seat === me ? "You got it!" : `${name(outcome.seat)} got it!`} side={`+${outcome.points}`} />;
  } else if (phase === "result" && outcome?.kind === "none") {
    const answer = view.choices.find((c) => c.bank === 0)?.text ?? "";
    const why = outcome.reason === "timeout" ? `Time's up. The answer was ${answer}.` : outcome.reason === "one-left" ? `Only one choice was left. The answer was ${answer}.` : `Everyone is out. The answer was ${answer}.`;
    banner = <StatusBanner fill="var(--text)" color="var(--ink)" text={`Nobody scored. ${why}`} />;
  } else if (lastPick && !lastPick.right && lastPick.seat === me && phase === "question") {
    banner = <StatusBanner fill="var(--disabled)" color="var(--text)" icon={<LockIcon />} text="Wrong. You're out for this one." />;
  } else if (lastPick && !lastPick.right && phase === "question") {
    banner = <StatusBanner fill="var(--text)" color="var(--ink)" icon={<span className="text-[var(--buzz)]"><CrossIcon /></span>} text={`${name(lastPick.seat)} was wrong.${playing && !lockedOut ? " Buzz again!" : ""}`} />;
  } else if (lockedOut && phase === "question") {
    banner = <StatusBanner fill="var(--disabled)" color="var(--text)" icon={<LockIcon />} text="Too slow. You're out for this one." />;
  }

  // Each choice's look.
  const lookOf = (bank: number): ChoiceLook => {
    if (view.struck.includes(bank)) return "struck";
    if (phase === "result") {
      if (outcome?.kind === "right") return bank === 0 ? "right" : "dimmed";
      return bank === 0 ? "answer" : "dimmed";
    }
    return myTurn ? "pickable" : "default";
  };
  const struckBy = (bank: number) => (lastPick && lastPick.choice === bank ? (lastPick.seat === me ? "your pick" : name(lastPick.seat)) : undefined);

  // The buzzer area.
  let buzzerState: BuzzerState = "ready";
  let caption = "Tap as soon as you know it";
  if (lockedOut) {
    buzzerState = "locked";
    caption = "The others can still buzz";
  } else if (phase === "answering") {
    buzzerState = "wait";
    caption = buzzer === me ? "Pick an answer above" : `${name(buzzer)} is answering`;
  } else if (phase === "buzzing" || view.buzzedHere) {
    buzzerState = "pressed";
    caption = "Buzzed!";
  }

  const timer = (
    <TimerRing
      seconds={view.questionSeconds}
      fraction={view.questionFraction}
      paused={phase === "buzzing" || phase === "answering"}
      label={`${view.questionSeconds} seconds left`}
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
          <span className={`${LABEL} min-w-0 flex-1 truncate`}>{view.topic ? TOPIC_LABELS[view.topic].en : ""}</span>
          {phase !== "result" ? timer : null}
        </header>
        <div className="flex flex-col gap-3 min-[900px]:grid min-[900px]:grid-cols-[minmax(240px,300px)_1fr] min-[900px]:items-start min-[900px]:gap-6">
          <ScoreBoard rows={view.scores} />
          <main className="flex flex-col gap-3 min-[900px]:gap-4">
            <section className="rounded-[20px] bg-[var(--surface)] p-4 min-[900px]:rounded-3xl min-[900px]:p-7">
              <p className={`${TEXT} m-0 mb-1.5 text-[14px] font-bold text-[var(--points)] min-[900px]:text-[16px]`}>{worth}</p>
              <h1 className={`${DISPLAY} m-0 text-[24px] font-bold leading-[1.2] min-[900px]:text-[36px]`}>{view.question}</h1>
            </section>
            {banner}
            <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 min-[900px]:grid-cols-2 min-[900px]:gap-3.5">
              {view.choices.map((choice, i) => (
                <li key={choice.bank}>
                  <ChoiceTile
                    letter={LETTERS[i]}
                    text={choice.text}
                    look={lookOf(choice.bank)}
                    note={view.struck.includes(choice.bank) ? struckBy(choice.bank) : undefined}
                    myColor={me ? seatColor(me) : "var(--p1)"}
                    onPick={() => onPick(choice.bank)}
                    compact={banner != null}
                  />
                </li>
              ))}
            </ul>
            <div className="mt-2 flex min-h-[200px] flex-col items-center justify-center gap-3">
              {phase === "result" ? (
                <NextPill text={view.index + 1 >= view.total ? `Results in ${view.nextSeconds}` : `Next question in ${view.nextSeconds}`} />
              ) : playing ? (
                <>
                  <Buzzer state={buzzerState} caption={caption} onBuzz={onBuzz} small={banner != null} />
                  <p className={`${TEXT} m-0 hidden items-center gap-2 text-[14px] text-[var(--text-muted)] min-[900px]:flex`}>
                    Press <kbd className="rounded-md border-2 border-[var(--text-muted)] px-1.5 font-bold">Space</kbd> or click to buzz · Then pick with{" "}
                    <kbd className="rounded-md border-2 border-[var(--text-muted)] px-1.5 font-bold">A–D</kbd>
                  </p>
                </>
              ) : (
                <p className={`${TEXT} m-0 rounded-2xl bg-[var(--surface)] px-4 py-3 text-[16px] font-bold text-[var(--text-muted)]`}>You&apos;re watching. Join at the next rematch.</p>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
