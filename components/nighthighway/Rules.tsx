"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import HowToPlay, { type HowToPlayLook } from "@/components/HowToPlay";
import { useLang } from "@/lib/i18n/useLang";
import { COUNTDOWN_SECONDS, RUN_SECONDS } from "@/lib/games/nighthighway/constants";
import { COMBO_SECONDS, MAX_COMBO, nearMissPoints } from "@/lib/games/nighthighway/game";

/** "Got it": the title card's call to action. */
function DoneButton({ className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={`cta nh-rules-done ${className}`} {...rest} />;
}

/**
 * Night Highway's look for the shared dialog: the title card's night panel,
 * Big Shoulders headings, the cta. The classes live in ./screens.css (the
 * dialog sits inside the page's .nh root, so its variables apply).
 */
const LOOK: HowToPlayLook = {
  iconClassName: "nh-rules-btn",
  linkClassName: "nh-linkbtn",
  panelClassName: "nh-rules-panel",
  headerClassName: "nh-rules-head",
  titleClassName: "nh-rules-title",
  closeClassName: "nh-rules-btn",
  DoneButton,
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-2">
      <h3 className="nh-rules-h3">{title}</h3>
      {children}
    </section>
  );
}

const P = "m-0 text-[15px] leading-snug text-[var(--ink-dim)] [&_b]:text-[var(--ink)]";
const LIST = `${P} grid gap-1.5 pl-5 [&:is(ol)]:list-decimal [&:is(ul)]:list-disc`;

/** A key, as on the title card. */
const Key = ({ children }: { children: ReactNode }) => <kbd className="nh-rules-key">{children}</kbd>;

/** Your car squeezing past another, the gap marked: a near miss. */
function NearMissPicture({ gap }: { gap: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 220 96" className="mx-auto block h-24 w-auto">
      <path d="M40 0 L10 96 M110 0 V96 M180 0 L210 96" stroke="var(--rule)" strokeWidth="2" strokeDasharray="8 8" fill="none" />
      <rect x="62" y="18" width="34" height="56" rx="7" fill="#2b3a5c" stroke="var(--ink-faint)" strokeWidth="2" />
      <rect x="118" y="30" width="34" height="56" rx="7" fill="var(--nitro)" />
      <rect x="66" y="66" width="10" height="5" rx="2" fill="var(--taillight)" />
      <rect x="82" y="66" width="10" height="5" rx="2" fill="var(--taillight)" />
      <path d="M99 50 H115" stroke="#ffd36a" strokeWidth="3" strokeLinecap="round" />
      <text x="107" y="44" textAnchor="middle" fontSize="11" fontWeight="800" fill="#ffd36a">
        {gap}
      </text>
    </svg>
  );
}

function RulesEn() {
  return (
    <div className="grid gap-5">
      <Section title="The goal">
        <p className={P}>
          <b>
            {RUN_SECONDS} seconds, one road: drive as far as you can and weave close past traffic for points.
          </b>{" "}
          In a race, the higher score wins.
        </p>
      </Section>

      <Section title="Solo or race">
        <ul className={LIST}>
          <li>
            <b>Solo</b>: just you. Your best score is saved on this device.
          </li>
          <li>
            <b>Race</b>: two drivers on the same road at the same time, through the exact same traffic. You see each other as a ghost car: you can&apos;t crash into it.
            The room keeps a tally of who&apos;s won.
          </li>
          <li>
            In a race, both tap <b>Ready</b>. Either driver can flip the switches in the lobby, and that clears both Readys so nobody races with settings they
            didn&apos;t see. <b>Matchmaking</b> finds you a driver instead.
          </li>
        </ul>
      </Section>

      <Section title="A run">
        <ol className={LIST}>
          <li>A {COUNTDOWN_SECONDS}-second countdown, then {RUN_SECONDS} seconds of driving. The clock never stops in a race.</li>
          <li>Every metre you drive is a point.</li>
          <li>
            <b>Near miss</b>: pass a car with almost no gap, at speed, for {nearMissPoints(1, 1)} points. Under half a metre it&apos;s a <b>close call</b>, worth half again.
          </li>
          <li>
            Near misses within {COMBO_SECONDS} seconds of each other build a <b>combo</b>, up to ×{MAX_COMBO}: each one is worth {nearMissPoints(1, 1)} × the combo. Wait
            too long and it resets.
          </li>
          <li>
            <b>Crash</b> into a car and you slow down and lose your combo.
          </li>
        </ol>
        <div className="rounded-lg border border-[var(--rule)] p-3">
          <NearMissPicture gap="gap" />
        </div>
      </Section>

      <Section title="Nitro and pickups">
        <ul className={LIST}>
          <li>
            <b>Nitro</b> starts full, burns while you hold it, and refills slowly. Every near miss tops it up.
          </li>
          <li>
            With <b>Pickups</b> on, drive over them: <b>nitro</b> (a big refill), <b>phase</b> (5 seconds driving straight through traffic, and your combo can&apos;t break),{" "}
            <b>shield</b> (your next crash costs nothing). In a race, both drivers find the same ones.
          </li>
        </ul>
      </Section>

      <Section title="Controls">
        <ul className={LIST}>
          <li>
            <b>Keyboard</b>: <Key>W</Key> or <Key>↑</Key> gas, <Key>S</Key> or <Key>↓</Key> brake, <Key>A</Key> <Key>D</Key> or <Key>←</Key> <Key>→</Key> steer,{" "}
            <Key>Shift</Key> nitro.
          </li>
          <li>
            <b>Touch</b>: the gas is automatic. ◀ ▶ steer, plus <b>Brake</b> and <b>Nitro</b>.
          </li>
          <li>
            Extras: <Key>V</Key> camera, <Key>C</Key> paint, <Key>M</Key> sound, <Key>H</Key> hide the HUD. Solo only: <Key>P</Key> pause, <Key>R</Key> restart.
          </li>
        </ul>
      </Section>

      <Section title="Options">
        <ul className={LIST}>
          <li>
            <b>Pickups</b> (on by default): nitro, phase and shield on the road.
          </li>
          <li>
            <b>Rain</b>: a wet road. The car slides after you steer, brakes less and gets pushed harder in the bends.
          </li>
          <li>
            <b>Desert</b>: a dirt track through a canyon at sunset, with hills, instead of the city.
          </li>
          <li>Curves are always on.</li>
        </ul>
      </Section>

      <Section title="Tips">
        <ul className={LIST}>
          <li>Keep the combo alive: a ×{MAX_COMBO} near miss is worth more than a long straight.</li>
          <li>Save nitro for open road, and brake early in a jam: a crash costs more than a slow second.</li>
          <li>Night Highway is heavy 3D: it runs best on a computer. On a phone it may lag.</li>
        </ul>
      </Section>
    </div>
  );
}

/**
 * The same rules in French. The words match the game's (./text.ts): Bonus for
 * Pickups, Passe-muraille for phase, « C'est parti » for Ready. The engine reads
 * keys by position, so AZERTY's Z and Q do W's and A's job.
 */
function RulesFr() {
  return (
    <div className="grid gap-5">
      <Section title="Le but">
        <p className={P}>
          <b>
            {RUN_SECONDS} secondes, une route&nbsp;: roule le plus loin possible et frôle la circulation pour marquer des points.
          </b>{" "}
          En course, le meilleur score gagne.
        </p>
      </Section>

      <Section title="Solo ou course">
        <ul className={LIST}>
          <li>
            <b>Solo</b>&nbsp;: toi et la route. Ton record est gardé sur cet appareil.
          </li>
          <li>
            <b>Course</b>&nbsp;: deux pilotes sur la même route en même temps, dans exactement la même circulation. Chacun voit l&apos;autre en voiture fantôme&nbsp;:
            impossible de la percuter. Le salon garde le compte des victoires.
          </li>
          <li>
            En course, les deux pilotes appuient sur <b>C&apos;est parti</b>. Chacun peut changer les options dans la salle d&apos;attente, ce qui annule les deux
            départs, pour que personne ne parte avec des réglages surprises. Avec la <b>partie rapide</b>, on te trouve un adversaire.
          </li>
        </ul>
      </Section>

      <Section title="Une course">
        <ol className={LIST}>
          <li>
            Un compte à rebours de {COUNTDOWN_SECONDS} secondes, puis {RUN_SECONDS} secondes de conduite. En course, le chrono ne s&apos;arrête jamais.
          </li>
          <li>Chaque mètre parcouru rapporte un point.</li>
          <li>
            <b>Frôlement</b>&nbsp;: double une voiture presque à la toucher, à bonne vitesse, pour {nearMissPoints(1, 1)} points. À moins d&apos;un demi-mètre, c&apos;est
            un passage <b>de justesse</b>, qui vaut moitié plus.
          </li>
          <li>
            Des frôlements à moins de {COMBO_SECONDS} secondes d&apos;intervalle forment un <b>combo</b>, jusqu&apos;à ×{MAX_COMBO}&nbsp;: chacun vaut{" "}
            {nearMissPoints(1, 1)} × le combo. Attends trop et il retombe à zéro.
          </li>
          <li>
            Une <b>collision</b> avec une voiture te ralentit et te fait perdre ton combo.
          </li>
        </ol>
        <div className="rounded-lg border border-[var(--rule)] p-3">
          <NearMissPicture gap="écart" />
        </div>
      </Section>

      <Section title="Nitro et bonus">
        <ul className={LIST}>
          <li>
            La <b>nitro</b> est pleine au départ, se vide tant que tu appuies et se recharge lentement. Chaque frôlement en rajoute.
          </li>
          <li>
            Avec les <b>Bonus</b> activés, roule dessus&nbsp;: <b>nitro</b> (une grosse recharge), <b>passe-muraille</b> (5 secondes à traverser la circulation, sans
            que ton combo puisse casser), <b>bouclier</b> (ta prochaine collision ne coûte rien). En course, les deux pilotes trouvent les mêmes.
          </li>
        </ul>
      </Section>

      <Section title="Commandes">
        <ul className={LIST}>
          <li>
            <b>Clavier</b>&nbsp;: <Key>W</Key> ou <Key>↑</Key> pour accélérer, <Key>S</Key> ou <Key>↓</Key> pour freiner, <Key>A</Key> <Key>D</Key> ou <Key>←</Key>{" "}
            <Key>→</Key> pour tourner, <Key>Maj</Key> pour la nitro. Sur un clavier AZERTY, <Key>Z</Key> et <Key>Q</Key> remplacent <Key>W</Key> et <Key>A</Key>.
          </li>
          <li>
            <b>Tactile</b>&nbsp;: l&apos;accélération est automatique. ◀ ▶ pour tourner, plus <b>Frein</b> et <b>Nitro</b>.
          </li>
          <li>
            En plus&nbsp;: <Key>V</Key> caméra, <Key>C</Key> peinture, <Key>M</Key> son, <Key>H</Key> masquer l&apos;affichage. En solo seulement&nbsp;: <Key>P</Key> pause,{" "}
            <Key>R</Key> recommencer.
          </li>
        </ul>
      </Section>

      <Section title="Options">
        <ul className={LIST}>
          <li>
            <b>Bonus</b> (activés par défaut)&nbsp;: nitro, passe-muraille et bouclier sur la route.
          </li>
          <li>
            <b>Pluie</b>&nbsp;: route mouillée. La voiture glisse après un coup de volant, freine moins bien et se fait davantage déporter dans les virages.
          </li>
          <li>
            <b>Désert</b>&nbsp;: une piste en terre dans un canyon au coucher du soleil, avec du relief, au lieu de la ville.
          </li>
          <li>Les virages sont toujours là.</li>
        </ul>
      </Section>

      <Section title="Astuces">
        <ul className={LIST}>
          <li>Garde ton combo en vie&nbsp;: un frôlement à ×{MAX_COMBO} vaut plus qu&apos;une longue ligne droite.</li>
          <li>Garde la nitro pour la route dégagée et freine tôt dans les bouchons&nbsp;: une collision coûte plus cher qu&apos;une seconde au ralenti.</li>
          <li>Night Highway est un jeu 3D gourmand&nbsp;: il tourne mieux sur ordinateur. Sur téléphone, il peut saccader.</li>
        </ul>
      </Section>
    </div>
  );
}

/**
 * Night Highway's How to play (docs/how-to-play.md, on the shared
 * components/HowToPlay.tsx): `variant` "icon" is the round ? in the top
 * corner of every race card and of the solo page, "link" the two lobbies' "How
 * to play". Wrap the icon in `.nh-rules` (screens.css), which turns pointer
 * events back on: the page's layers turn them off. It stays out of `Stage`, so
 * the offline download (no Tailwind utilities) doesn't get it.
 */
export default function RulesButton({ variant = "icon" }: { variant?: "icon" | "link" }) {
  const lang = useLang();
  return (
    <HowToPlay look={LOOK} variant={variant}>
      {lang === "fr" ? <RulesFr /> : <RulesEn />}
    </HowToPlay>
  );
}
