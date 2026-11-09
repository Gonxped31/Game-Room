"use client";

import { useState } from "react";
import { formatCount } from "@/lib/analytics/format";
import { BEFORE_TRACKING, type RangeQuery } from "@/lib/analytics/tracking";
import type { FinishedRow, FinishedStats, SourceRow, SourceStats } from "@/lib/analytics/types";
import { gameBySlug } from "@/lib/games/registry";
import { Num, Panel, StatTile } from "./ui";

/** Games finished (the north star) and the source table (docs/tracking.md). */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-11-09" -> "Nov 9" (no clock involved). */
const dayLabel = (day: string) => `${MONTHS[Number(day.slice(5, 7)) - 1]} ${Number(day.slice(8, 10))}`;

const MODE_LABELS: Record<string, string> = {
  room: "Private room",
  match: "Matchmade",
  solo: "Solo",
  daily: "Daily",
  challenge: "Challenge race",
  survival: "Survival race",
  "challenge-matchmade": "Challenge race (matchmade)",
  "survival-matchmade": "Survival race (matchmade)",
};
const sourceLabel = (src: string) => (src === BEFORE_TRACKING ? "Before tracking" : src);

function change(now: number, before: number): string {
  if (!before) return now ? "new this week" : "none last week either";
  const pct = Math.round(((now - before) / before) * 100);
  return `${pct >= 0 ? "+" : ""}${pct}% vs last week`;
}

export function FinishedSection({ stats }: { stats: FinishedStats }) {
  const { thisWeek, lastWeek, allTime } = stats;
  return (
    <section aria-labelledby="games-finished" className="flex flex-col gap-2">
      <h2 id="games-finished" className="m-0 text-sm font-bold text-white/85">
        Games finished · weeks run Monday to Sunday, Toronto time
      </h2>
      <div className="grid grid-cols-2 gap-3 min-[760px]:grid-cols-4">
        <StatTile label="This week" value={formatCount(thisWeek.games)} note={`${change(thisWeek.games, lastWeek.games)} · since ${dayLabel(thisWeek.start)}`} />
        <StatTile label="Last week" value={formatCount(lastWeek.games)} note={`Week of ${dayLabel(lastWeek.start)}`} />
        <StatTile label="Players this week" value={formatCount(thisWeek.players)} note={`${formatCount(lastWeek.players)} last week`} />
        <StatTile label="Players" value={formatCount(allTime.players)} note={`Finished a game · ${formatCount(allTime.games)} games in all`} />
      </div>
      <Panel title="Games finished, last 12 weeks">
        <Trend weeks={stats.weeks} />
        <div className="mt-4 grid gap-4 min-[960px]:grid-cols-3">
          <Breakdown title="By game" rows={stats.byGame} label={(key) => gameBySlug(key)?.title ?? key} />
          <Breakdown title="By mode" rows={stats.byMode} label={(key) => MODE_LABELS[key] ?? key} />
          <Breakdown title="By source" rows={stats.bySource} label={sourceLabel} note="A game counts once for each source among its players." />
        </div>
      </Panel>
    </section>
  );
}

function Trend({ weeks }: { weeks: FinishedStats["weeks"] }) {
  const max = Math.max(1, ...weeks.map((week) => week.games));
  return (
    <figure className="m-0">
      <ol className="m-0 flex h-36 list-none items-end gap-1 p-0" aria-label="Games finished per week">
        {weeks.map((week, i) => (
          <li key={week.start} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`Week of ${dayLabel(week.start)}: ${week.games} games, ${week.players} players`}>
            <span className="text-[10px] font-bold tabular-nums text-black/70 min-[560px]:text-xs">{formatCount(week.games)}</span>
            <span
              className={`w-full rounded-t ${i === weeks.length - 1 ? "bg-[#0F7983]" : "bg-[#0F7983]/45"}`}
              style={{ height: `${Math.max(2, (week.games / max) * 100)}%` }}
              aria-hidden="true"
            />
            <span className="sr-only">
              Week of {dayLabel(week.start)}: {week.games} games, {week.players} players
            </span>
          </li>
        ))}
      </ol>
      <figcaption className="mt-1 flex justify-between text-[10px] text-black/60 min-[560px]:text-xs" aria-hidden="true">
        <span>{dayLabel(weeks[0].start)}</span>
        <span>This week</span>
      </figcaption>
    </figure>
  );
}

function Breakdown({ title, rows, label, note }: { title: string; rows: FinishedRow[]; label: (key: string) => string; note?: string }) {
  return (
    <div className="min-w-0">
      <h3 className="m-0 mb-1 text-sm font-bold">{title}</h3>
      {rows.length === 0 ? (
        <p className="m-0 text-sm text-black/60">No games finished yet.</p>
      ) : (
        <table className="w-full border-collapse text-xs min-[560px]:text-sm">
          <thead>
            <tr className="border-b-2 border-black/10 text-left text-black/60">
              <th className="py-2 pr-2 font-semibold"></th>
              <Num head>This wk</Num>
              <Num head>Last wk</Num>
              <Num head className="hidden min-[400px]:table-cell">
                12 wk
              </Num>
              <Num head>All</Num>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b border-black/10 last:border-0">
                <td className="py-2 pr-2 font-bold break-words">{label(row.key)}</td>
                <Num>{formatCount(row.thisWeek)}</Num>
                <Num>{formatCount(row.lastWeek)}</Num>
                <Num className="hidden min-[400px]:table-cell">{formatCount(row.weeks12)}</Num>
                <Num>{formatCount(row.allTime)}</Num>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {note && <p className="m-0 mt-1 text-xs text-black/60">{note}</p>}
    </div>
  );
}

const PRESETS: { preset: "7d" | "30d" | "week" | "lastweek" | "all"; label: string }[] = [
  { preset: "week", label: "This week" },
  { preset: "lastweek", label: "Last week" },
  { preset: "7d", label: "7 days" },
  { preset: "30d", label: "30 days" },
  { preset: "all", label: "All time" },
];

/** The days the source table covers, as the stats request's query string. */
export function rangeQueryString(range: RangeQuery): string {
  return "preset" in range ? `range=${range.preset}` : `from=${range.from}&to=${range.to}`;
}

export function SourceSection({ stats, range, onRange }: { stats: SourceStats; range: RangeQuery; onRange: (range: RangeQuery) => void }) {
  const span = stats.from ? `${dayLabel(stats.from)} to ${dayLabel(stats.to)}` : `Up to ${dayLabel(stats.to)}`;
  return (
    <Panel title="Where players come from">
      <p className="m-0 text-sm leading-relaxed text-black/75">
        Each guest counts for the first link that brought them (its utm_source or ref, and utm_campaign); no tag is direct. Guests from before tracking have
        their own row. {span}, Toronto days.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Days counted">
        {PRESETS.map((choice) => {
          const on = "preset" in range && range.preset === choice.preset;
          return (
            <button
              key={choice.preset}
              type="button"
              aria-pressed={on}
              onClick={() => onRange({ preset: choice.preset })}
              className={`cursor-pointer rounded-lg border-2 border-[#0F7983] px-3 py-1 text-sm font-bold ${on ? "bg-[#0F7983] text-white" : "bg-white text-[#0F7983]"}`}
            >
              {choice.label}
            </button>
          );
        })}
      </div>
      {/* Keyed by the days shown, so picking a preset fills the dates in. */}
      <RangeForm key={`${stats.from ?? ""}|${stats.to}`} initialFrom={stats.from ?? ""} initialTo={stats.to} onRange={onRange} />
      <SourceTable title="By source" rows={stats.sources} name={(row) => sourceLabel(row.src)} />
      <SourceTable title="By campaign" rows={stats.campaigns} name={(row) => `${sourceLabel(row.src)} · ${row.cmp ?? "no campaign"}`} />
    </Panel>
  );
}

function RangeForm({ initialFrom, initialTo, onRange }: { initialFrom: string; initialTo: string; onRange: (range: RangeQuery) => void }) {
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  return (
    <form
      className="mt-2 flex flex-wrap items-end gap-2 text-sm"
      onSubmit={(event) => {
        event.preventDefault();
        if (from && to) onRange({ from, to });
      }}
    >
      <label className="flex flex-col gap-0.5 font-semibold text-black/60">
        From
        <input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} className="rounded-lg border-2 border-black/15 px-2 py-1 text-black" />
      </label>
      <label className="flex flex-col gap-0.5 font-semibold text-black/60">
        To
        <input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} className="rounded-lg border-2 border-black/15 px-2 py-1 text-black" />
      </label>
      <button type="submit" disabled={!from || !to} className="cursor-pointer rounded-lg border-2 border-[#0F7983] bg-white px-3 py-1 font-bold text-[#0F7983] disabled:opacity-50">
        Show these days
      </button>
    </form>
  );
}

function SourceTable({ title, rows, name }: { title: string; rows: SourceRow[]; name: (row: SourceRow) => string }) {
  return (
    <div className="mt-4">
      <h3 className="m-0 mb-1 text-sm font-bold">{title}</h3>
      {rows.length === 0 ? (
        <p className="m-0 text-sm text-black/60">Nothing in these days.</p>
      ) : (
        <>
          {/* Phones: one block per row; the table needs more width than they have. */}
          <ul className="m-0 flex list-none flex-col p-0 min-[760px]:hidden">
            {rows.map((row) => (
              <li key={name(row)} className="border-b border-black/10 py-2 text-sm last:border-0">
                <p className="m-0 font-bold break-words">{name(row)}</p>
                <p className="m-0 mt-0.5 text-black/60">
                  {row.newGuests} new · {row.roomsCreated} rooms · {row.gamesFinished} games finished · {row.finishers} players
                </p>
              </li>
            ))}
          </ul>
          <table className="hidden w-full border-collapse text-sm min-[760px]:table">
            <thead>
              <tr className="border-b-2 border-black/10 text-left text-black/60">
                <th className="py-2 pr-3 font-semibold">{title === "By source" ? "Source" : "Source · campaign"}</th>
                <Num head>New guests</Num>
                <Num head>Rooms created</Num>
                <Num head>Games finished</Num>
                <Num head>Players who finished</Num>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={name(row)} className="border-b border-black/10 last:border-0">
                  <td className="py-2 pr-3 font-bold break-words">{name(row)}</td>
                  <Num>{formatCount(row.newGuests)}</Num>
                  <Num>{formatCount(row.roomsCreated)}</Num>
                  <Num>{formatCount(row.gamesFinished)}</Num>
                  <Num>{formatCount(row.finishers)}</Num>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
