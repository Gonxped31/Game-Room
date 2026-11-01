"use client";

import type { ReactNode } from "react";
import HowToPlay, { type HowToPlayLook } from "@/components/HowToPlay";
import { ANSWER_MS, BUZZ_WINDOW_MS, CHOICES, COUNTDOWN_MS, LENGTHS, MAX_PLAYERS, MIN_PLAYERS, QUESTION_MS, RESULT_MS, TOPICS } from "@/lib/games/buzzerquiz/constants";
import { pointsFor } from "@/lib/games/buzzerquiz/game";
import { DISPLAY, FOCUS, PrimaryButton, TEXT } from "./ui";

/** Buzzer Quiz's look for the shared dialog: the violet surface, Bricolage headings, the buzzer-red Got it. */
const LOOK: HowToPlayLook = {
  iconClassName: `${DISPLAY} ${FOCUS} flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-[var(--text-muted)] bg-[var(--surface)] text-[19px] font-extrabold text-[var(--text)]`,
  linkClassName: `${TEXT} ${FOCUS} cursor-pointer self-start border-0 bg-transparent p-0 text-[15px] font-bold text-[var(--points)] underline`,
  panelClassName: `${TEXT} bg-[var(--surface)] text-[var(--text)]`,
  headerClassName: "border-b-2 border-[var(--surface-2)]",
  titleClassName: `${DISPLAY} text-[22px] font-extrabold`,
  closeClassName: `${FOCUS} flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-0 bg-[var(--surface-2)] text-[20px] text-[var(--text)]`,
  DoneButton: PrimaryButton,
};

const seconds = (ms: number) => ms / 1000;
const LETTERS = ["A", "B", "C", "D"];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-2">
      <h3 className={`${DISPLAY} m-0 text-[18px] font-extrabold`}>{title}</h3>
      {children}
    </section>
  );
}

const P = "m-0 text-[15px] leading-snug text-[var(--text-muted)] [&_b]:text-[var(--text)]";
const LIST = `${P} grid gap-1.5 pl-5`;

/** Four choices, the first `struck` crossed out, and what a right answer is worth then. */
function ScoreLine({ struck }: { struck: number }) {
  const points = pointsFor(CHOICES - struck);
  return (
    <div className="flex items-center gap-2">
      {LETTERS.map((letter, i) => (
        <span
          key={letter}
          className={`${DISPLAY} flex h-8 w-8 items-center justify-center rounded-lg text-[15px] font-extrabold ${
            i < struck ? "bg-[var(--surface-dim)] text-[var(--text-struck)] line-through" : "bg-[var(--surface-2)] text-[var(--text)]"
          }`}
        >
          {letter}
        </span>
      ))}
      <span className={`${DISPLAY} ml-1 text-[16px] font-extrabold text-[var(--points)]`}>
        {points} {points === 1 ? "point" : "points"}
      </span>
    </div>
  );
}

function RulesContent() {
  const [shortest, longest] = [LENGTHS[0], LENGTHS[LENGTHS.length - 1]];
  return (
    <div className="grid gap-5">
      <Section title="The goal">
        <p className={P}>
          <b>Buzz first, pick the right answer, score the most points.</b> The fewer choices left when you get it right, the less it&apos;s worth.
        </p>
      </Section>

      <Section title="Players">
        <ul className={LIST}>
          <li>
            {MIN_PLAYERS} to {MAX_PLAYERS} players, each on their own phone or computer.
          </li>
          <li>
            <b>In a private room</b>, the host (who made the room) picks the language, the topics and how many questions, then starts.
          </li>
          <li>
            <b>In matchmaking</b> there&apos;s no host: every topic, 10 questions, and the quiz starts by itself once at least {MIN_PLAYERS} players are in.
          </li>
        </ul>
      </Section>

      <Section title="A question">
        <ol className={LIST}>
          <li>A {seconds(COUNTDOWN_MS)}-second countdown, then the question and its {CHOICES} choices.</li>
          <li>
            Know it? Tap <b>Buzz</b>. If several of you buzz within {BUZZ_WINDOW_MS / 1000} s of the first, the fastest reaction wins, so a slow connection doesn&apos;t cost you.
          </li>
          <li>The player who buzzed picks a choice. Nobody else can pick.</li>
          <li>
            <b>Right:</b> they score and the question ends. <b>Wrong:</b> that choice is struck out for everyone, that player is out until the next question, and the others
            can buzz again.
          </li>
        </ol>
      </Section>

      <Section title="Scoring">
        <div className="grid gap-2 rounded-xl bg-[var(--surface-dim)] p-3">
          <ScoreLine struck={0} />
          <ScoreLine struck={1} />
          <ScoreLine struck={2} />
        </div>
        <ul className={LIST}>
          <li>
            Right with all {CHOICES} choices left scores {pointsFor(CHOICES)}; each wrong guess before yours takes a point off.
          </li>
          <li>Nobody scores if time runs out, if everyone is out, or once only one choice is left.</li>
          <li>After the last question, the most points wins. Ties share the place.</li>
        </ul>
      </Section>

      <Section title="Time">
        <ul className={LIST}>
          <li>
            <b>{seconds(QUESTION_MS)} s</b> to buzz on each question. The clock stops while someone is picking.
          </li>
          <li>
            <b>{seconds(ANSWER_MS)} s</b> to pick once you&apos;ve buzzed: run out and you&apos;re out until the next question (nothing is struck).
          </li>
          <li>
            The answer stays up for {seconds(RESULT_MS)} s, then the next countdown.
          </li>
        </ul>
      </Section>

      <Section title="Options">
        <ul className={LIST}>
          <li>
            <b>Language:</b> English or French questions.
          </li>
          <li>
            <b>Topics:</b> any of the {TOPICS.length} (geography, cinema &amp; TV, science, sport, music, history).
          </li>
          <li>
            <b>Length:</b> {LENGTHS.join(", ")} questions ({shortest} is a quick round, {longest} a long game).
          </li>
        </ul>
      </Section>

      <Section title="Tips">
        <ul className={LIST}>
          <li>A wrong guess hands the others an easier question. Buzz when you know, not when you hope.</li>
          <li>Waiting is a gamble too: every strike lowers what the question is worth.</li>
          <li>Keep a thumb on the buzzer during the countdown.</li>
        </ul>
      </Section>
    </div>
  );
}

/**
 * Buzzer Quiz's How to play (docs/how-to-play.md, on the shared
 * components/HowToPlay.tsx): `variant` "icon" is the round ? in each screen's
 * title row, "link" the lobby's "How to play".
 */
export default function RulesButton({ variant = "icon" }: { variant?: "icon" | "link" }) {
  return (
    <HowToPlay look={LOOK} variant={variant}>
      <RulesContent />
    </HowToPlay>
  );
}
