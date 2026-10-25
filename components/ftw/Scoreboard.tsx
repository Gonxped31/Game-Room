import { GAME_TITLE } from "@/lib/games/ftw/constants";
import { DISPLAY, PlayerSquare, TEXT } from "./ui";

export interface ScorePlayer {
  name: string;
  score: number;
  color: string;
  isMe: boolean;
}

/** "Scores: Samir (you) 10, Léa 5" - the viewer first. */
const scoresLabel = (players: ScorePlayer[]) => `Scores: ${players.map((p) => `${p.name}${p.isMe ? " (you)" : ""} ${p.score}`).join(", ")}`;

/** "Same Page", with a yellow highlighter bar behind "Page". */
export function Wordmark({ className = "" }: { className?: string }) {
  const [first, ...rest] = GAME_TITLE.split(" ");
  return (
    <span className={`${DISPLAY} leading-none text-[var(--ink)] ${className}`}>
      {first} <span className="bg-[linear-gradient(transparent_55%,#FFE94A_55%_92%,transparent_92%)]">{rest.join(" ")}</span>
    </span>
  );
}

/**
 * The game header (references/ftw/first-to-worst-game-design.md, "Header with
 * scores"). Phones: the wordmark and "Round 3" on the left, a score chip per
 * player on the right. From 900px: the larger wordmark and the room name on
 * the right (the scores move to the aside's score card).
 */
export function GameHeader({ round, players, roomLabel }: { round?: number; players?: ScorePlayer[]; roomLabel: string }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <div className="shrink-0">
        <h1 className="m-0">
          <Wordmark className="text-[22px] min-[900px]:text-[30px]" />
        </h1>
        {round != null ? <p className={`${TEXT} m-0 mt-1 text-[13px] font-bold text-[var(--ink)] opacity-80 min-[900px]:hidden`}>Round {round}</p> : null}
      </div>
      {players ? (
        <div role="group" aria-label={scoresLabel(players)} className="ml-auto flex min-w-0 justify-end gap-1.5 min-[900px]:hidden">
          {players.map((p) => (
            <span
              key={p.name + p.isMe}
              aria-hidden="true"
              className={`${TEXT} flex h-[34px] min-w-0 max-w-32 items-center gap-1.5 rounded-full bg-white pr-2.5 pl-2 text-[var(--ink)] ${p.isMe ? "shadow-[inset_0_0_0_2px_var(--ink)]" : ""}`}
            >
              <PlayerSquare color={p.color} />
              <span className="min-w-0 truncate text-sm font-bold">{p.name}</span>
              <span className="shrink-0 text-base font-bold">{p.score}</span>
            </span>
          ))}
        </div>
      ) : null}
      <p className={`${TEXT} m-0 hidden min-w-0 truncate text-[15px] font-bold text-[var(--ink)] opacity-80 min-[900px]:block`}>{roomLabel}</p>
    </header>
  );
}

/** The desktop aside's white score card, with full names. */
export function ScoreCard({ round, players }: { round: number; players: ScorePlayer[] }) {
  return (
    <div role="group" aria-label={scoresLabel(players)} className={`${TEXT} rounded-2xl border-2 border-[var(--ink)] bg-white px-4 py-3 text-[var(--ink)]`}>
      <p aria-hidden="true" className="m-0 mb-1.5 text-[13px] font-bold tracking-[0.06em] text-[var(--muted)] uppercase">
        Round {round}
      </p>
      <ul aria-hidden="true" className="m-0 grid list-none gap-1.5 p-0">
        {players.map((p) => (
          <li key={p.name + p.isMe} className="flex items-center gap-2.5">
            <PlayerSquare color={p.color} size={12} />
            <span className="min-w-0 flex-1 truncate text-base font-bold">
              {p.name}
              {p.isMe ? <span className="font-medium text-[var(--muted)]"> (you)</span> : null}
            </span>
            <span className="text-xl font-bold">{p.score}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
