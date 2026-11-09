"use client";

import { useEffect, useState } from "react";
import { formatCount, formatDuration, formatRate } from "@/lib/analytics/format";
import { PLAY_ESTIMATE_CAP_MS } from "@/lib/analytics/metrics";
import type { RangeQuery } from "@/lib/analytics/tracking";
import type { AdminStats, InviteLoop } from "@/lib/analytics/types";
import { gameBySlug } from "@/lib/games/registry";
import { SOLO_GAMES, soloDownloadHref, soloDownloadName } from "@/lib/games/soloDownloads";
import { callAdmin } from "./callAdmin";
import ConfirmDialog from "./ConfirmDialog";
import { FinishedSection, rangeQueryString, SourceSection } from "./FinishedStats";
import RoomList from "./RoomList";
import { Num, Panel, StatTile } from "./ui";

const REFRESH_MS = 30_000;

type Load = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; stats: AdminStats; stale?: string };

async function fetchStats(range: RangeQuery): Promise<{ stats: AdminStats } | { error: string; signedOut?: boolean }> {
  try {
    const response = await fetch(`/api/admin/stats?${rangeQueryString(range)}`, { cache: "no-store" });
    if (response.status === 401) return { error: "Signed out.", signedOut: true };
    const body = (await response.json().catch(() => null)) as (AdminStats & { error?: string }) | null;
    if (!response.ok || !body) return { error: body?.error ?? `The server answered ${response.status}.` };
    return { stats: body };
  } catch {
    return { error: "Couldn't reach the server." };
  }
}

const gameTitle = (slug: string) => gameBySlug(slug)?.title ?? slug;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const formatWhen = (ms: number) => new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * Games finished (the north star), live rooms, players per game, play time,
 * return rate and where players come from, refreshed every 30 s. The numbers come computed from /api/admin/stats; durations arrive as
 * ages relative to the server's clock, so nothing here reads the time.
 */
export default function AdminDashboard({ onSignedOut }: { onSignedOut: () => void }) {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  // Bumped after closing or deleting a room, to refetch at once instead of on the next tick.
  const [reloads, setReloads] = useState(0);
  const [clearing, setClearing] = useState(false);
  // The source table's days; the server resolves them (Toronto days), so nothing here reads the clock.
  const [range, setRange] = useState<RangeQuery>({ preset: "30d" });

  useEffect(() => {
    let cancelled = false;
    const refresh = () =>
      fetchStats(range).then((result) => {
        if (cancelled) return;
        if ("stats" in result) setLoad({ kind: "ready", stats: result.stats });
        // The cookie expired or the password changed: back to the login box.
        else if (result.signedOut) onSignedOut();
        // Keep showing the last good numbers when a refresh fails.
        else setLoad((prev) => (prev.kind === "ready" ? { ...prev, stale: result.error } : { kind: "error", message: result.error }));
      });
    refresh();
    const id = setInterval(refresh, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [onSignedOut, reloads, range]);

  if (load.kind === "loading") return <Panel>Loading the numbers…</Panel>;
  if (load.kind === "error")
    return (
      <Panel>
        <p role="alert" className="m-0 font-bold text-[#B3123F]">
          {load.message}
        </p>
      </Panel>
    );

  const { stats, stale } = load;
  const { totals } = stats;
  // After a stats clear, "all time" means since then.
  const allTime = stats.statsSince != null ? `since ${formatWhen(stats.statsSince)}` : "all time";
  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-sm text-white/85">
        Updated {new Date(stats.generatedAt).toLocaleTimeString()} · refreshes every 30 s
        {stats.statsSince != null && ` · stats counted since ${formatWhen(stats.statsSince)}`}
        {stale && <span className="font-bold text-white"> · last refresh failed: {stale}</span>}
      </p>

      <FinishedSection stats={stats.finished} />

      <div className="grid grid-cols-2 gap-3 min-[760px]:grid-cols-4">
        <StatTile label="Live now" value={formatCount(totals.liveRooms)} note={`${totals.playingRooms} playing · ${totals.onlineGuests} guests online`} />
        <StatTile label="Players, last 30 days" value={formatCount(totals.players30d)} note={`${formatCount(totals.playersAllTime)} ${allTime}`} />
        <StatTile
          label="Play time, last 30 days"
          value={formatDuration(totals.playMs30d)}
          note={
            totals.medianPlayMs30d == null
              ? "No games played yet"
              : `Median ${formatDuration(totals.medianPlayMs30d)} per room${totals.estimatedPlayRooms30d ? ` · ${totals.estimatedPlayRooms30d} estimated` : ""}`
          }
        />
        <StatTile
          label="Return rate"
          value={formatRate(totals.returning)}
          note={`${totals.returning.count} of ${totals.returning.of} guests came back · ${formatRate(totals.returnedWithin7d)} within a week`}
        />
      </div>

      <InviteLoopTiles loop={stats.inviteLoop} />

      <Panel title="By game">
        {/* Phones: one block per game; the table needs more width than they have. */}
        <ul className="m-0 flex list-none flex-col p-0 min-[760px]:hidden">
          {stats.perGame.map((game) => (
            <li key={game.gameSlug} className="border-b border-black/10 py-2.5 text-sm last:border-0">
              <p className="m-0 font-bold">{gameTitle(game.gameSlug)}</p>
              <p className="m-0 mt-0.5 text-black/60">
                {game.liveRooms} live · {plural(game.roomsCreated30d, "room")} · {plural(game.players30d, "player")} · {game.playedRooms30d} played
                {game.medianPlayMs30d != null && ` · median ${formatDuration(game.medianPlayMs30d)}`}
              </p>
            </li>
          ))}
        </ul>
        <p className="m-0 mt-1 text-xs text-black/60 min-[760px]:hidden">Rooms and players: last 30 days.</p>
        <div className="hidden min-[760px]:block">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-black/10 text-left text-black/60">
                <th className="py-2 pr-3 font-semibold">Game</th>
                <Num head>Live</Num>
                <Num head>Rooms (30 d)</Num>
                <Num head>Players (30 d)</Num>
                <Num head>Played rooms</Num>
                <Num head>Median play</Num>
              </tr>
            </thead>
            <tbody>
              {stats.perGame.map((game) => (
                <tr key={game.gameSlug} className="border-b border-black/10 last:border-0">
                  <td className="py-2 pr-3 font-bold">{gameTitle(game.gameSlug)}</td>
                  <Num>{game.liveRooms}</Num>
                  <Num>{game.roomsCreated30d}</Num>
                  <Num>{game.players30d}</Num>
                  <Num>{game.playedRooms30d}</Num>
                  <Num>{game.medianPlayMs30d == null ? "—" : formatDuration(game.medianPlayMs30d)}</Num>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <SourceSection stats={stats.sources} range={range} onRange={setRange} />

      <Panel title="Rooms">
        <RoomList rooms={stats.rooms} games={stats.perGame.map((game) => game.gameSlug)} onChanged={() => setReloads((n) => n + 1)} />
      </Panel>

      <Panel title="Download a solo game">
        <p className="m-0 text-sm leading-relaxed text-black/75">
          The game alone, as one HTML file: open it in a browser and play, offline, with nothing else needed. No rooms or hub; the best score is kept in that
          browser.
        </p>
        <ul className="m-0 mt-2 flex list-none flex-col p-0">
          {SOLO_GAMES.map((game) => (
            <SoloDownload key={game.slug} slug={game.slug} title={game.title} fileName={soloDownloadName(game)} />
          ))}
        </ul>
      </Panel>

      <Panel title="Clear stats">
        <p className="m-0 text-sm leading-relaxed text-black/75">
          Starts every number on this page again from zero: games finished, players, play time, return rate, the invite loop and the source table only count
          what happens afterwards. Live rooms and the Rooms list stay as they are; no room is closed or deleted, and players keep their rooms and where they
          came from.
          {stats.statsSince != null && ` Last cleared ${formatWhen(stats.statsSince)}.`}
        </p>
        <button
          type="button"
          onClick={() => setClearing(true)}
          className="mt-3 cursor-pointer rounded-lg border-2 border-[#B3123F] bg-white px-3 py-1.5 text-sm font-bold text-[#B3123F]"
        >
          Clear all stats…
        </button>
      </Panel>
      {clearing && (
        <ConfirmDialog
          request={{
            title: "Clear all stats?",
            message:
              "Every number on this dashboard starts again from zero. Deleted rooms' summaries, guests' visit days and the finished-game records are erased for good. This can't be undone. Enter the admin password to confirm.",
            password: true,
            confirmLabel: "Clear all stats",
            busyLabel: "Clearing…",
            run: (password) => callAdmin("/api/admin/stats/clear", "POST", { password }),
          }}
          onFinish={(done) => {
            setClearing(false);
            if (done) setReloads((n) => n + 1);
          }}
        />
      )}

      <p className="m-0 text-xs leading-relaxed text-white/85">
        Play time counts the minutes a game was in progress. Rooms played before that count existed are estimated from when they were created to their last
        activity, at most {formatDuration(PLAY_ESTIMATE_CAP_MS)} each. The invite loop leaves out matchmade rooms. A game finished is one that reached its real end
        (a match result, a final score, the standings of a race, a solo game won or lost, a daily result), counted once however many devices report it. A guest
        is one browser: someone who clears their browser data, or switches device, counts as a new guest (and joining their own room from a second device looks
        like an invite).
      </p>
    </div>
  );
}

/** One solo game's file, if this build made it (scripts/export-solo.mjs only warns when it can't). */
function SoloDownload({ slug, title, fileName }: { slug: string; title: string; fileName: string }) {
  const href = soloDownloadHref(slug);
  const [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(href, { method: "HEAD", cache: "no-store" })
      .then((response) => !cancelled && setAvailable(response.ok))
      .catch(() => !cancelled && setAvailable(false));
    return () => {
      cancelled = true;
    };
  }, [href]);
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-black/10 py-2.5 text-sm last:border-0">
      <span className="font-bold">{title}</span>
      <span className="text-black/60">Solo · one HTML file</span>
      <span className="ml-auto">
        {available === false ? (
          <span className="text-black/60">Not in this build (npm run export:solo)</span>
        ) : (
          <a
            href={href}
            download={fileName}
            aria-disabled={available !== true}
            className={`inline-block rounded-lg border-2 border-[#0F7983] bg-[#0F7983] px-3 py-1.5 font-bold text-white no-underline ${available ? "" : "pointer-events-none opacity-60"}`}
          >
            Download
          </a>
        )}
      </span>
    </li>
  );
}

function InviteLoopTiles({ loop }: { loop: InviteLoop }) {
  const perCreator = loop.creators ? (loop.invitedGuests / loop.creators).toFixed(1) : "—";
  return (
    <section aria-labelledby="invite-loop" className="flex flex-col gap-2">
      <h2 id="invite-loop" className="m-0 text-sm font-bold text-white/85">
        Invite loop · last 30 days
      </h2>
      <div className="grid grid-cols-1 gap-3 min-[560px]:grid-cols-3">
        <StatTile label="Invite conversion" value={formatRate(loop.converted)} note={`${loop.converted.count} of ${plural(loop.converted.of, "room")} got a second guest`} />
        <StatTile label="Invited per creator" value={perCreator} note={`${plural(loop.invitedGuests, "guest")} invited by ${plural(loop.creators, "creator")}`} />
        <StatTile label="Loop rate" value={formatRate(loop.loop)} note={`${loop.loop.count} of ${plural(loop.loop.of, "invited newcomer")} created a room`} />
      </div>
    </section>
  );
}
