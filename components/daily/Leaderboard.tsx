import type { BoardEntry } from "@/lib/daily/client";

/** m:ss.t: a daily board separates times by tenths. */
export function formatBoardTime(ms: number): string {
  const tenths = Math.floor(ms / 100);
  const m = Math.floor(tenths / 600);
  const s = Math.floor((tenths % 600) / 10);
  return `${m}:${String(s).padStart(2, "0")}.${tenths % 10}`;
}

/**
 * A daily leaderboard, shared by every daily game (lib/daily/). Unstyled
 * beyond its `daily-*` class names: each game styles them in its own CSS.
 * Shows the first `show` rows, plus your row if you're further down.
 */
export default function Leaderboard({ board, rank, players, show = 10 }: { board: BoardEntry[]; rank: number | null; players: number; show?: number }) {
  if (players === 0) return <p className="daily-empty">Nobody has solved today&apos;s puzzle yet. Be the first.</p>;
  const top = board.slice(0, show);
  const mine = board.findIndex((row) => row.me);
  const extra = mine >= show ? board[mine] : null;
  return (
    <div className="daily-board">
      <ol className="daily-rows">
        {top.map((row, i) => (
          <li key={i} className="daily-row" data-me={row.me ? "" : undefined}>
            <span className="daily-rank">{i + 1}</span>
            <span className="daily-name">{row.name}</span>
            <span className="daily-time">{formatBoardTime(row.ms)}</span>
          </li>
        ))}
      </ol>
      {extra || (rank !== null && rank > board.length) ? (
        <p className="daily-row daily-row-you" data-me="">
          <span className="daily-rank">{rank}</span>
          <span className="daily-name">{extra?.name ?? "You"}</span>
          <span className="daily-time">{extra ? formatBoardTime(extra.ms) : ""}</span>
        </p>
      ) : null}
      <p className="daily-count">
        {players} {players === 1 ? "player" : "players"} ranked today
      </p>
    </div>
  );
}
