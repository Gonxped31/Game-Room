"use client";

import type { ReactNode } from "react";
import HowToPlay, { type HowToPlayLook } from "@/components/HowToPlay";
import { MAX_CASE_ATTEMPTS } from "@/lib/games/cocounsel/constants";
import { COLOR } from "@/lib/games/cocounsel/theme";
import Button from "./Button";
import { texts } from "@/lib/i18n/text";
import { useLang } from "@/lib/i18n/useLang";
import { CC_TEXT } from "./text";

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

interface RulesText {
  goalTitle: string;
  goal: ReactNode;
  rolesTitle: string;
  roles: ReactNode[];
  partTitle: string;
  steps: ReactNode[];
  missesTitle: string;
  misses: ReactNode[];
  winTitle: string;
  win: ReactNode[];
  casesTitle: string;
  cases: ReactNode[];
  tipsTitle: string;
  tips: ReactNode[];
}

const DUO_EN = CC_TEXT.en.duo;
const DUO_FR = CC_TEXT.fr.duo;

/** The rules in both languages (docs/i18n.md); a rules change updates both. */
const RULES = texts<RulesText>({
  en: {
    goalTitle: "The goal",
    goal: (
      <>
        <b>Solve the case together.</b> Each of you sees only half of the story. Talk it through and agree on the one pair of cards, one from each hand, that explains what
        really happened.
      </>
    ),
    rolesTitle: "Players and roles",
    roles: [
      <>
        Two players, <b>talking out loud</b>: on a call, or side by side. Each plays on their own phone, and you never look at each other&apos;s screen.
      </>,
      <>
        <b style={{ color: COLOR.investigator }}>The Investigator</b> sees what&apos;s out there: what people saw and found.
      </>,
      <>
        <b style={{ color: COLOR.defendant }}>The Defendant</b> knows the hidden facts from the inside.
      </>,
      "You keep your role for the whole case. Whoever made the room picks the case.",
    ],
    partTitle: "A Part",
    steps: [
      <>
        <b>Read</b> your screen: what&apos;s new in this Part, and your hand of 3 cards.
      </>,
      <>
        <b>Talk.</b> Tell your partner what you know. There&apos;s no timer.
      </>,
      <>
        <b>Lock in</b> one card each, in secret. Nothing shows until you&apos;ve both locked in.
      </>,
      <>
        <b>Reveal.</b> Both cards flip. The right pair is a <b>working theory</b>: true, but not the whole story yet. The next Part picks up from there.
      </>,
    ],
    missesTitle: "Misses",
    misses: [
      <>
        <b>&ldquo;Plausible, but something doesn&apos;t fit&rdquo;</b>: a trap, close but wrong. <b>&ldquo;That doesn&apos;t hold up&rdquo;</b>: just wrong. Either way, talk it
        through and pick again.
      </>,
      <>
        You have <b>{MAX_CASE_ATTEMPTS} misses for the whole case</b>, not per Part. The one after that ends it: the case is adjourned. If that happens on the last Part, the
        judge shows you the right pair first.
      </>,
    ],
    winTitle: "Winning: Trust and Focus",
    win: [
      "Solve the last Part and you get the verdict. There are no points during the case.",
      <>
        At the end you see two team scores. <b>Trust</b>: how often you played a card that went against what your partner had just told you. <b>Focus</b>: how often you
        played one that went against something you&apos;d both learned in an earlier Part.
      </>,
      <>
        Together they give your duo a title, from &ldquo;{DUO_EN["Still Learning Each Other"]}&rdquo; to &ldquo;{DUO_EN["Mind-Reading Team"]}&rdquo;.
      </>,
    ],
    casesTitle: "Cases",
    cases: [
      <>
        <b>Easy</b> cases have 3 Parts, <b>Medium</b> 4 or 5, <b>Hard</b> 6. Longer cases ask more of your memory: the game never recaps earlier Parts while you play.
      </>,
      "After a case, see the full case file, or pick another case.",
    ],
    tipsTitle: "Tips",
    tips: [
      "Read your screen out loud, word for word. Details matter.",
      "Notes are fine: it's a listening game, not a memory exam.",
      "A trap usually fits your half and breaks your partner's. Ask what doesn't fit for them.",
    ],
  },
  fr: {
    goalTitle: "Le but",
    goal: (
      <>
        <b>On résout l&apos;affaire ensemble.</b> Tu ne vois que la moitié de l&apos;histoire, l&apos;autre joueur a le reste. On en parle, et on s&apos;entend sur la seule
        paire de cartes (une dans chaque main) qui explique ce qui s&apos;est vraiment passé.
      </>
    ),
    rolesTitle: "Joueurs et rôles",
    roles: [
      <>
        Deux joueurs qui <b>se parlent à voix haute</b>&nbsp;: en appel, ou côte à côte. Chaque joueur a son propre téléphone, et on ne regarde jamais l&apos;écran de
        l&apos;autre.
      </>,
      <>
        <b style={{ color: COLOR.investigator }}>Côté enquête</b>, on voit ce qui se passe à l&apos;extérieur&nbsp;: ce que les gens ont vu et trouvé.
      </>,
      <>
        <b style={{ color: COLOR.defendant }}>Côté défense</b>, on connaît les faits cachés, de l&apos;intérieur.
      </>,
      "Tu gardes ton rôle pendant toute l'affaire. La personne qui a créé le salon choisit l'affaire.",
    ],
    partTitle: "Un acte",
    steps: [
      <>
        <b>Lis</b> ton écran&nbsp;: ce qui est nouveau dans cet acte, et tes 3 cartes.
      </>,
      <>
        <b>Parle.</b> Dis à l&apos;autre ce que tu sais. Il n&apos;y a pas de chrono.
      </>,
      <>
        <b>Valide</b> une carte, en secret. Rien ne s&apos;affiche tant que les deux cartes ne sont pas validées.
      </>,
      <>
        <b>Révélation.</b> Les deux cartes se retournent. La bonne paire est une <b>hypothèse de travail</b>&nbsp;: vraie, mais pas encore toute l&apos;histoire.
        L&apos;acte suivant repart de là.
      </>,
    ],
    missesTitle: "Les erreurs",
    misses: [
      <>
        <b>«&nbsp;Plausible, mais quelque chose cloche&nbsp;»</b>&nbsp;: un piège, presque juste, mais faux. <b>«&nbsp;Ça ne tient pas la route&nbsp;»</b>&nbsp;: tout
        simplement faux. Dans les deux cas, on en reparle et on choisit de nouveau.
      </>,
      <>
        Les erreurs comptent pour toute l&apos;affaire, pas par acte&nbsp;: à la <b>{MAX_CASE_ATTEMPTS}e erreur</b>, l&apos;affaire est ajournée. Si ça arrive au dernier
        acte, le juge te montre d&apos;abord la bonne paire.
      </>,
    ],
    winTitle: "Gagner : Confiance et Concentration",
    win: [
      "Résous le dernier acte et le verdict tombe. Pas de points pendant l'affaire.",
      <>
        À la fin, deux scores d&apos;équipe s&apos;affichent. <b>Confiance</b>&nbsp;: combien de fois tu as joué une carte qui contredisait ce que l&apos;autre venait de te
        dire. <b>Concentration</b>&nbsp;: combien de fois tu en as joué une qui contredisait un fait appris ensemble dans un acte précédent.
      </>,
      <>
        Ensemble, ils donnent un titre à ton duo, de «&nbsp;{DUO_FR["Still Learning Each Other"]}&nbsp;» à «&nbsp;{DUO_FR["Mind-Reading Team"]}&nbsp;».
      </>,
    ],
    casesTitle: "Les affaires",
    cases: [
      <>
        Les affaires <b>faciles</b> ont 3 actes, les <b>moyennes</b> 4 ou 5, les <b>difficiles</b> 6. Plus l&apos;affaire est longue, plus elle sollicite ta
        mémoire&nbsp;: le jeu ne résume jamais les actes précédents en cours de partie.
      </>,
      "Après une affaire, consulte le dossier complet ou choisis-en une autre.",
    ],
    tipsTitle: "Astuces",
    tips: [
      "Lis ton écran à voix haute, mot pour mot. Les détails comptent.",
      "Tu peux prendre des notes : c'est un jeu d'écoute, pas un examen de mémoire.",
      "Un piège colle souvent à ta moitié et contredit celle de l'autre. Demande-lui ce qui cloche de son côté.",
    ],
  },
});

function Items({ items }: { items: ReactNode[] }) {
  return items.map((item, i) => <li key={i}>{item}</li>);
}

function RulesContent() {
  const lang = useLang();
  const r = RULES[lang];
  const role = CC_TEXT[lang].role;
  return (
    <div className="grid gap-5">
      <Section title={r.goalTitle}>
        <p className={P}>{r.goal}</p>
      </Section>

      <Section title={r.rolesTitle}>
        <ul className={LIST}>
          <Items items={r.roles} />
        </ul>
      </Section>

      <Section title={r.partTitle}>
        <div aria-hidden="true" className="flex items-end justify-center gap-3 rounded-xl px-3 pt-5 pb-3 min-[480px]:gap-6" style={{ backgroundColor: COLOR.white }}>
          <Hand color={COLOR.investigator} picked={1} label={role.investigator} />
          <span className="pb-8 text-[22px] font-extrabold">+</span>
          <Hand color={COLOR.defendant} picked={2} label={role.defendant} />
        </div>
        <ol className={LIST}>
          <Items items={r.steps} />
        </ol>
      </Section>

      <Section title={r.missesTitle}>
        <ul className={LIST}>
          <Items items={r.misses} />
        </ul>
      </Section>

      <Section title={r.winTitle}>
        <ul className={LIST}>
          <Items items={r.win} />
        </ul>
      </Section>

      <Section title={r.casesTitle}>
        <ul className={LIST}>
          <Items items={r.cases} />
        </ul>
      </Section>

      <Section title={r.tipsTitle}>
        <ul className={LIST}>
          <Items items={r.tips} />
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
