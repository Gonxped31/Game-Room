"use client";

import type { Team } from "@/lib/games/wordscramble/teams";
import {
  BulbIcon,
  CheckIcon,
  DISPLAY,
  EyeIcon,
  FOCUS,
  LABEL,
  LockIcon,
  ScorePill,
  Slot,
  teamColor,
  teamText,
  TEXT,
  Tile,
  TimerRing,
} from "./ui";
import { SCREEN } from "./Screens";
import TileBoard from "./TileBoard";

/** Everything a turn shows, derived by the page from the game state and the clock. */
export interface TurnView {
  phase: "turn" | "result";
  team: Team;
  /** This device's player is on the playing team. */
  playing: boolean;
  /** This device's player's team (spectators: undefined). */
  myTeam?: Team;
  teamNames: string[];
  turnLabel: string;
  scores: Record<Team, number>;
  /** The scrambled letters, in order. */
  scrambled: string[];
  /** The answer's letters (uppercase, no accents). */
  answer: string[];
  /** The real spelling, for the reveal. */
  word: string;
  hints: number;
  worth: number;
  canHint: boolean;
  guesses: { name: string; text: string }[];
  typing: string[];
  found?: { name: string; seconds: number; points: number };
  seconds: number;
  fraction: number;
  nextTeam: Team;
  nextSeconds: number;
  /** "+4 Team A · 5 letters − 1 hint". */
  pointsLine?: string;
}

export default function TurnScreen({ view, onGuess, onHint, onTyping }: {
  view: TurnView;
  /** Returns whether the guess was right. */
  onGuess: (text: string) => boolean;
  onHint: () => void;
  onTyping: () => void;
}) {
  const { team, playing, phase } = view;
  const done = phase === "result";
  const right = done && view.found != null;

  // Which scrambled tiles the hints have already used (35% opacity in the row).
  const placed = view.answer.slice(0, view.hints);
  const used = new Set<number>();
  for (const letter of placed) {
    const i = view.scrambled.findIndex((l, j) => l === letter && !used.has(j));
    if (i >= 0) used.add(i);
  }

  // Phones: 56 px tiles, shrunk so an 8-letter word still fits one row at 375 px (343 px of content).
  const phoneTile = Math.min(56, Math.floor((340 - (view.answer.length - 1) * 6) / view.answer.length));

  const tiles = (size: number) => {
    if (right) {
      return view.answer.map((l, i) => <Tile key={i} letter={l} look="right" size={size} lift={i % 2 ? -4 : 2} />);
    }
    if (done) {
      return view.answer.map((l, i) => <Tile key={i} letter={l} look={i < view.hints ? "team" : "revealed"} team={team} size={size} />);
    }
    return view.answer.map((l, i) => (i < view.hints ? <Tile key={i} letter={l} look="team" team={team} size={size} hintMark={size < 70} /> : <Slot key={i} size={size} />));
  };

  const board = (size: number) => (
    <div className="flex flex-col items-center gap-5">
      {!done ? (
        <div role="img" aria-label={`Scrambled letters ${view.scrambled.join(" ")}`} className={`flex justify-center ${size < 70 ? "gap-1.5" : "gap-2"}`}>
          {view.scrambled.map((l, i) => (
            <Tile key={i} letter={l} look={used.has(i) ? "used" : "wood"} size={size} tilt={((i * 37) % 11) - 5} />
          ))}
        </div>
      ) : null}
      <div role="img" aria-label={done ? `The word was ${view.word}` : `Answer: ${placed.join(" ")}${placed.length ? " and " : ""}${view.answer.length - view.hints} blanks`} className={`flex justify-center ${size < 70 ? "gap-1.5" : "gap-2"}`}>
        {tiles(size)}
      </div>
    </div>
  );

  const banner = playing ? (
    <div className="flex items-center justify-between gap-3 rounded-[18px] border-[3px] border-[var(--ink)] px-4 py-2.5" style={{ background: teamColor(team), color: teamText(team) }}>
      <span className={`${DISPLAY} text-[22px] min-[900px]:text-[28px]`}>Your team&apos;s turn</span>
      <span className={`${TEXT} truncate text-[14px] font-extrabold`}>{view.teamNames.join(" · ")}</span>
    </div>
  ) : (
    <div className="flex items-center gap-2.5 rounded-[18px] border-[3px] bg-white px-4 py-2.5" style={{ borderColor: teamColor(team) }}>
      <span style={{ color: teamColor(team) }}>
        <EyeIcon />
      </span>
      <span className={`${DISPLAY} flex-1 text-[20px] min-[900px]:text-[26px]`}>Team {team} is playing</span>
      {view.myTeam ? <span className={`${TEXT} text-[14px] font-extrabold text-[var(--muted)]`}>{view.myTeam === view.nextTeam ? "You're next" : ""}</span> : null}
    </div>
  );

  const worth = (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className={`${DISPLAY} m-0 text-[24px] min-[900px]:text-[26px]`}>Worth {view.worth} points</p>
        <p className={`${TEXT} m-0 text-[14px] font-bold text-[var(--muted)]`}>
          {view.answer.length} letters · {view.hints} hint{view.hints === 1 ? "" : "s"} used
        </p>
      </div>
      {playing ? (
        <button
          type="button"
          onClick={onHint}
          disabled={!view.canHint}
          className={`${TEXT} ${FOCUS} flex h-12 cursor-pointer items-center gap-1.5 rounded-xl border-2 border-[var(--ink)] bg-white px-3.5 text-[16px] font-extrabold shadow-[0_4px_0_var(--ink)] active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none`}
        >
          <BulbIcon /> Hint <span className="text-[var(--wrong)]">−1</span>
        </button>
      ) : null}
    </div>
  );

  const locked = (
    <p className={`${TEXT} m-0 flex min-h-14 items-center justify-center gap-2 rounded-2xl border-[3px] border-dashed border-[var(--slot)] px-3 text-center text-[15px] font-bold text-[var(--muted)]`}>
      <LockIcon /> {view.myTeam ? `You can guess on Team ${view.myTeam}'s turn` : "You're watching. Join a team at the next rematch."}
    </p>
  );

  const feed = (
    <section className="flex flex-col gap-2 rounded-[20px] border-2 border-[var(--line)] bg-white p-3.5">
      <h2 className={LABEL}>{playing ? "Team guesses" : `Team ${team}'s guesses`}</h2>
      <ul aria-live="polite" className="m-0 flex list-none flex-col gap-1.5 p-0">
        {view.guesses.map((g, i) => (
          <li key={i} className={`${TEXT} flex items-center gap-2 text-[15px] font-bold`}>
            <span className="w-16 shrink-0 truncate text-[var(--muted)]">{g.name}</span>
            <span className={`${DISPLAY} flex-1 truncate text-[18px] tracking-[0.08em] line-through decoration-[var(--wrong)] decoration-2`}>{g.text}</span>
            <span className="text-[13px] text-[var(--wrong)]">not it</span>
          </li>
        ))}
        {view.found ? (
          <li className={`${TEXT} flex items-center gap-2 rounded-xl bg-[var(--right-tint)] px-2 py-1.5 text-[15px] font-bold text-[var(--right-ink)]`}>
            <CheckIcon />
            <span className="w-16 shrink-0 truncate">{view.found.name}</span>
            <span className={`${DISPLAY} flex-1 text-[18px] tracking-[0.08em]`}>{view.answer.join("")}</span>
          </li>
        ) : null}
        {!done && view.typing.length ? <li className={`${TEXT} text-[14px] italic text-[var(--muted)]`}>{view.typing.join(", ")} {view.typing.length === 1 ? "is" : "are"} arranging…</li> : null}
        {!view.guesses.length && !view.found && !view.typing.length ? <li className={`${TEXT} text-[14px] text-[var(--muted)]`}>No guesses yet.</li> : null}
      </ul>
      <p className={`${TEXT} m-0 hidden text-[13px] text-[var(--muted)] min-[900px]:block`}>Wrong guesses cost nothing. Keep trying until the timer runs out.</p>
    </section>
  );

  const result = done ? (
    <div role="status" className="flex flex-col items-center gap-2 text-center">
      <p className={`${DISPLAY} m-0 text-[34px] min-[900px]:text-[48px]`}>{right ? "Got it!" : "Time's up"}</p>
      <p className={`${TEXT} m-0 text-[16px] font-bold text-[var(--muted)]`}>
        {right ? `Found by ${view.found!.name} in ${view.found!.seconds} s` : `The word was ${view.word.toUpperCase()}`}
      </p>
      <p className={`${TEXT} m-0 rounded-2xl border-[3px] border-[var(--ink)] bg-white px-4 py-2 text-[17px] font-extrabold`}>{right ? view.pointsLine : `No points for Team ${team}`}</p>
      <p className={`${DISPLAY} m-0 rounded-full px-4 py-2 text-[18px]`} style={{ background: teamColor(view.nextTeam), color: teamText(view.nextTeam) }}>
        Team {view.nextTeam} plays next
      </p>
    </div>
  ) : null;

  return (
    <div className={SCREEN}>
      <div className="mx-auto flex max-w-[1100px] flex-col gap-3 min-[900px]:gap-5">
        <header className="flex items-center gap-2">
          <ScorePill team="A" score={view.scores.A} glow={right && team === "A"} />
          <span className={`${TEXT} flex-1 text-center text-[14px] font-extrabold text-[var(--muted)]`}>{view.turnLabel}</span>
          <ScorePill team="B" score={view.scores.B} glow={right && team === "B"} />
          {!done ? <TimerRing seconds={view.seconds} fraction={view.fraction} team={team} size={46} label={`${view.seconds} seconds left`} /> : null}
        </header>
        {banner}
        <div className="flex flex-col gap-4 min-[900px]:grid min-[900px]:grid-cols-[1fr_minmax(260px,340px)] min-[900px]:items-start min-[900px]:gap-6">
          <main className="flex flex-col gap-4 min-[900px]:rounded-[26px] min-[900px]:bg-[var(--board)] min-[900px]:p-8">
            {playing && !done ? (
              <TileBoard
                key={`${view.scrambled.join("")}:${view.hints}`}
                scrambled={view.scrambled}
                answer={view.answer}
                hints={view.hints}
                team={team}
                phoneTile={phoneTile}
                onConfirm={onGuess}
                onArrange={onTyping}
              />
            ) : (
              <>
                <div className="min-[900px]:hidden">{board(phoneTile)}</div>
                <div className="hidden min-[900px]:block">{board(76)}</div>
              </>
            )}
            {result}
            {!done ? (
              <div className="mx-auto flex w-full max-w-[560px] flex-col gap-3">
                {worth}
                {playing ? null : locked}
              </div>
            ) : null}
          </main>
          {feed}
        </div>
      </div>
    </div>
  );
}
