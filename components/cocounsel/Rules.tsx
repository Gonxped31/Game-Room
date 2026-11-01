"use client";

import type { ReactNode } from "react";
import HowToPlay, { type HowToPlayLook } from "@/components/HowToPlay";
import { MAX_CASE_ATTEMPTS } from "@/lib/games/cocounsel/constants";
import { COLOR } from "@/lib/games/cocounsel/theme";
import Button from "./Button";

const ARCHIVO = "font-[family-name:var(--font-archivo)]";
const FOCUS = "focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--cc-ink)]";

/**
 * Co-Counsel's look for the shared dialog: docket paper, Archivo, the yellow
 * Got it. Colours are the theme's `--cc-*` variables (light and dark), never
 * fixed colours, so the dialog follows the theme toggle.
 */
const LOOK: HowToPlayLook = {
  // The same round button as ThemeToggle, beside it in every header.
  iconClassName: `${ARCHIVO} ${FOCUS} flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-black/40 text-lg font-extrabold leading-none text-white`,
  linkClassName: `${ARCHIVO} ${FOCUS} cursor-pointer self-start border-0 bg-transparent p-0 text-[15px] font-bold text-[var(--cc-ink)] underline`,
  panelClassName: ARCHIVO,
  panelStyle: { backgroundColor: COLOR.paper, color: COLOR.ink },
  headerClassName: "border-b-2 border-[var(--cc-rule-blue)]",
  titleClassName: "text-[22px] font-extrabold tracking-[-0.02em]",
  closeClassName: `${FOCUS} flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-0 bg-[var(--cc-disabled-bg)] text-[20px] text-[var(--cc-ink)]`,
  DoneButton: Button,
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-2">
      <h3 className="m-0 text-[18px] font-extrabold tracking-[-0.01em]">{title}</h3>
      {children}
    </section>
  );
}

const P = "m-0 text-[15px] leading-snug text-[var(--cc-text2)] [&_b]:text-[var(--cc-ink)]";
const LIST = `${P} grid gap-1.5 pl-5 [&:is(ol)]:list-decimal [&:is(ul)]:list-disc`;

/** One player's hand of three cards, `picked` lifted and outlined in yellow. */
function Hand({ color, picked, label }: { color: string; picked: number; label: string }) {
  return (
    <div className="grid justify-items-center gap-1.5">
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="flex h-12 w-8 flex-col gap-1 rounded-md border-2 p-1 min-[480px]:h-14 min-[480px]:w-10 min-[480px]:p-1.5"
            style={{
              backgroundColor: COLOR.white,
              borderColor: i === picked ? COLOR.yellow : color,
              boxShadow: i === picked ? `0 0 0 2px ${COLOR.yellow}` : undefined,
              transform: i === picked ? "translateY(-6px)" : undefined,
            }}
          >
            <span className="h-1.5 rounded-sm" style={{ backgroundColor: color }} />
            <span className="h-1 w-3/4 rounded-sm" style={{ backgroundColor: COLOR.cardEdgeBlue }} />
            <span className="h-1 w-1/2 rounded-sm" style={{ backgroundColor: COLOR.cardEdgeBlue }} />
          </span>
        ))}
      </div>
      <span className="text-[13px] font-bold" style={{ color }}>
        {label}
      </span>
    </div>
  );
}

function RulesContent() {
  return (
    <div className="grid gap-5">
      <Section title="The goal">
        <p className={P}>
          <b>Solve the case together.</b> Each of you sees only half of the story. Talk it through and agree on the one pair of cards, one from each hand, that explains what
          really happened.
        </p>
      </Section>

      <Section title="Players and roles">
        <ul className={LIST}>
          <li>
            Two players, <b>talking out loud</b>: on a call, or side by side. Each plays on their own phone, and you never look at each other&apos;s screen.
          </li>
          <li>
            <b style={{ color: COLOR.investigator }}>The Investigator</b> sees what&apos;s out there: what people saw and found.
          </li>
          <li>
            <b style={{ color: COLOR.defendant }}>The Defendant</b> knows the hidden facts from the inside.
          </li>
          <li>You keep your role for the whole case. Whoever made the room picks the case.</li>
        </ul>
      </Section>

      <Section title="A Part">
        <div aria-hidden="true" className="flex items-end justify-center gap-3 rounded-xl px-3 pt-5 pb-3 min-[480px]:gap-6" style={{ backgroundColor: COLOR.white }}>
          <Hand color={COLOR.investigator} picked={1} label="Investigator" />
          <span className="pb-8 text-[22px] font-extrabold">+</span>
          <Hand color={COLOR.defendant} picked={2} label="Defendant" />
        </div>
        <ol className={LIST}>
          <li>
            <b>Read</b> your screen: what&apos;s new in this Part, and your hand of 3 cards.
          </li>
          <li>
            <b>Talk.</b> Tell your partner what you know. There&apos;s no timer.
          </li>
          <li>
            <b>Lock in</b> one card each, in secret. Nothing shows until you&apos;ve both locked in.
          </li>
          <li>
            <b>Reveal.</b> Both cards flip. The right pair is a <b>working theory</b>: true, but not the whole story yet. The next Part picks up from there.
          </li>
        </ol>
      </Section>

      <Section title="Misses">
        <ul className={LIST}>
          <li>
            <b>&ldquo;Plausible, but something doesn&apos;t fit&rdquo;</b>: a trap, close but wrong. <b>&ldquo;That doesn&apos;t hold up&rdquo;</b>: just wrong. Either way, talk
            it through and pick again.
          </li>
          <li>
            You have <b>{MAX_CASE_ATTEMPTS} misses for the whole case</b>, not per Part. The one after that ends it: the case is adjourned. If that happens on the last Part,
            the judge shows you the right pair first.
          </li>
        </ul>
      </Section>

      <Section title="Winning: Trust and Focus">
        <ul className={LIST}>
          <li>Solve the last Part and you get the verdict. There are no points during the case.</li>
          <li>
            At the end you see two team scores. <b>Trust</b>: how often you played a card that went against what your partner had just told you. <b>Focus</b>: how often
            you played one that went against something you&apos;d both learned in an earlier Part.
          </li>
          <li>Together they give your duo a title, from &ldquo;Still Learning Each Other&rdquo; to &ldquo;Mind-Reading Team&rdquo;.</li>
        </ul>
      </Section>

      <Section title="Cases">
        <ul className={LIST}>
          <li>
            <b>Easy</b> cases have 3 Parts, <b>Medium</b> 4 or 5, <b>Hard</b> 6. Longer cases ask more of your memory: the game never recaps earlier Parts while you play.
          </li>
          <li>After a case, see the full case file, or pick another case.</li>
        </ul>
      </Section>

      <Section title="Tips">
        <ul className={LIST}>
          <li>Read your screen out loud, word for word. Details matter.</li>
          <li>Notes are fine: it&apos;s a listening game, not a memory exam.</li>
          <li>A trap usually fits your half and breaks your partner&apos;s. Ask what doesn&apos;t fit for them.</li>
        </ul>
      </Section>
    </div>
  );
}

/**
 * Co-Counsel's How to play (docs/how-to-play.md, on the shared
 * components/HowToPlay.tsx): `variant` "icon" is the round ? beside the theme
 * toggle in every header (Wordmark, HeaderBand, ResultsHeader), "link" the
 * case picker's "How to play".
 */
export default function RulesButton({ variant = "icon" }: { variant?: "icon" | "link" }) {
  return (
    <HowToPlay look={LOOK} variant={variant}>
      <RulesContent />
    </HowToPlay>
  );
}
