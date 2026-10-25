"use client";

import { useEffect, useState, type ReactNode } from "react";
import { formatCount, formatDuration, formatRate } from "@/lib/analytics/format";
import { PLAY_ESTIMATE_CAP_MS } from "@/lib/analytics/metrics";
import type { DashboardStats, InviteLoop, LiveRoom } from "@/lib/analytics/types";
import { gameBySlug, roomHref } from "@/lib/games/registry";

const REFRESH_MS = 30_000;

type Load = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; stats: DashboardStats; stale?: string };

async function fetchStats(): Promise<{ stats: DashboardStats } | { error: string; signedOut?: boolean }> {
  try {
    const response = await fetch("/api/admin/stats", { cache: "no-store" });
    if (response.status === 401) return { error: "Signed out.", signedOut: true };
    const body = (await response.json().catch(() => null)) as (DashboardStats & { error?: string }) | null;
    if (!response.ok || !body) return { error: body?.error ?? `The server answered ${response.status}.` };
    return { stats: body };
  } catch {
    return { error: "Couldn't reach the server." };
  }
}

const gameTitle = (slug: string) => gameBySlug(slug)?.title ?? slug;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Live rooms, players per game, play time and return rate, refreshed every
 * 30 s. The numbers come computed from /api/admin/stats; durations arrive as
 * ages relative to the server's clock, so nothing here reads the time.
 */
export default function AdminDashboard({ onSignedOut }: { onSignedOut: () => void }) {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  // Bumped after closing a room, to refetch at once instead of on the next tick.
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const refresh = () =>
      fetchStats().then((result) => {
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
  }, [onSignedOut, reloads]);

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
  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-sm text-white/85">
        Updated {new Date(stats.generatedAt).toLocaleTimeString()} · refreshes every 30 s
        {stale && <span className="font-bold text-white"> · last refresh failed: {stale}</span>}
      </p>

      <div className="grid grid-cols-2 gap-3 min-[760px]:grid-cols-4">
        <StatTile label="Live now" value={formatCount(totals.liveRooms)} note={`${totals.playingRooms} playing · ${totals.onlineGuests} guests online`} />
        <StatTile label="Players, last 30 days" value={formatCount(totals.players30d)} note={`${formatCount(totals.playersAllTime)} all time`} />
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

      <Panel title={`Rooms live now (${stats.liveRooms.length})`}>
        {stats.liveRooms.length === 0 ? (
          <p className="m-0 text-sm text-black/60">No rooms live right now.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {stats.liveRooms.map((room) => (
              <LiveRoomRow key={room.code} room={room} onClosed={() => setReloads((n) => n + 1)} />
            ))}
          </ul>
        )}
      </Panel>

      <p className="m-0 text-xs leading-relaxed text-white/85">
        Play time counts the minutes a game was in progress. Rooms played before that count existed are estimated from when they were created to their last
        activity, at most {formatDuration(PLAY_ESTIMATE_CAP_MS)} each. The invite loop leaves out matchmade rooms. A guest is one browser: someone who clears
        their browser data, or switches device, counts as a new guest (and joining their own room from a second device looks like an invite).
      </p>
    </div>
  );
}

function LiveRoomRow({ room, onClosed }: { room: LiveRoom; onClosed: () => void }) {
  const [closing, setClosing] = useState(false);
  const label = room.name ?? room.code;

  const close = async () => {
    const what = `${gameTitle(room.gameSlug)} room "${label}"`;
    if (!window.confirm(`Close the ${what}? Everyone in it sees "This room was closed" and can't play on. This can't be undone.`)) return;
    setClosing(true);
    try {
      const response = await fetch(`/api/admin/rooms/${room.code}/close`, { method: "POST" });
      if (response.ok) return onClosed();
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      window.alert(body?.error ?? `Couldn't close the room (${response.status}).`);
    } catch {
      window.alert("Couldn't reach the server.");
    } finally {
      setClosing(false);
    }
  };

  return (
    <li className="flex items-center gap-3 border-b border-black/10 py-2.5 text-sm last:border-0">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-bold">{gameTitle(room.gameSlug)}</span>
        <a href={roomHref(room.gameSlug, room.code)} target="_blank" rel="noreferrer" className="font-semibold text-[#0F7983] underline">
          {label}
        </a>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className={`size-2 rounded-full ${room.status === "playing" ? "bg-[#1F8A4C]" : "bg-black/30"}`} />
          {room.status === "playing" ? "Playing" : "Waiting"}
        </span>
        <span className="text-black/60 tabular-nums">
          {room.seatsFilled}/{room.maxPlayers} seats · {room.online} online · opened {formatDuration(room.createdAgoMs)} ago
        </span>
      </div>
      <button
        type="button"
        onClick={() => void close()}
        disabled={closing}
        aria-label={`Close room ${label}`}
        className="shrink-0 cursor-pointer rounded-lg border-2 border-[#B3123F] bg-white px-3 py-1.5 text-sm font-bold text-[#B3123F] disabled:cursor-wait disabled:opacity-60"
      >
        {closing ? "Closing…" : "Close"}
      </button>
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

function StatTile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <section className="flex flex-col gap-1 rounded-2xl bg-white p-4 shadow-[0_4px_0_rgba(0,0,0,.25)]">
      <h2 className="m-0 text-sm font-semibold text-black/60">{label}</h2>
      <p className="m-0 text-2xl font-bold whitespace-nowrap text-black min-[760px]:text-3xl">{value}</p>
      <p className="m-0 text-xs text-black/60">{note}</p>
    </section>
  );
}

function Panel({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-[0_4px_0_rgba(0,0,0,.25)] min-[760px]:p-5">
      {title && <h2 className="m-0 mb-2 text-lg font-bold">{title}</h2>}
      {children}
    </section>
  );
}

function Num({ children, head }: { children: ReactNode; head?: boolean }) {
  const Cell = head ? "th" : "td";
  return <Cell className={`py-2 pl-3 text-right tabular-nums ${head ? "font-semibold" : ""}`}>{children}</Cell>;
}
