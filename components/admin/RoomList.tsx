"use client";

import { useRef, useState } from "react";
import { formatDuration } from "@/lib/analytics/format";
import { countByStatus, DEFAULT_FILTER, filterRooms, PLAYERS_OPTIONS, type RoomFilter, STATUS_OPTIONS } from "@/lib/analytics/roomFilter";
import type { RoomRow, RoomStatus } from "@/lib/analytics/types";
import { gameBySlug, roomHref } from "@/lib/games/registry";

/** Rows shown at first, and added by each "Show more". */
const PAGE_SIZE = 50;
/** The list scrolls inside this height, so the filters and the rest of the page stay in reach however many rooms there are. */
const LIST_HEIGHT = "max-h-[min(65vh,36rem)]";

const gameTitle = (slug: string) => gameBySlug(slug)?.title ?? slug;
// text-base on phones: iOS Safari zooms into any field under 16px when it's focused.
const fieldClass = "w-full rounded-lg border border-black/25 bg-white px-2.5 py-2 text-base font-normal text-black min-[760px]:text-sm";
const labelClass = "flex min-w-0 flex-col gap-1 text-xs font-semibold text-black/60";

/**
 * Every room, with filters: a search over names and codes (a pasted room
 * link works), status, game, and how many people hold a seat. Opens on the
 * live rooms; each row can close an open room or delete a closed one.
 */
export default function RoomList({ rooms, games, onChanged }: { rooms: RoomRow[]; games: string[]; onChanged: () => void }) {
  const [filter, setFilter] = useState<RoomFilter>(DEFAULT_FILTER);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const listRef = useRef<HTMLDivElement>(null);
  const reset = (next: RoomFilter | ((current: RoomFilter) => RoomFilter)) => {
    setFilter(next);
    setLimit(PAGE_SIZE);
    listRef.current?.scrollTo({ top: 0 });
  };
  const update = (change: Partial<RoomFilter>) => reset((current) => ({ ...current, ...change }));

  const matches = filterRooms(rooms, filter);
  const counts = countByStatus(rooms, filter);
  const filtered = filter.query !== "" || filter.gameSlug != null || filter.players !== DEFAULT_FILTER.players || filter.status !== DEFAULT_FILTER.status;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 min-[760px]:grid-cols-[2fr_1fr_1fr_1fr]">
        <label className={`${labelClass} col-span-2 min-[760px]:col-span-1`}>
          Search
          <input
            type="search"
            value={filter.query}
            onChange={(e) => update({ query: e.target.value })}
            placeholder="Name, code or room link"
            autoComplete="off"
            spellCheck={false}
            className={fieldClass}
          />
        </label>
        <label className={labelClass}>
          Status
          <select value={filter.status} onChange={(e) => update({ status: e.target.value as RoomFilter["status"] })} className={fieldClass}>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} ({counts[option.value]})
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Game
          <select value={filter.gameSlug ?? ""} onChange={(e) => update({ gameSlug: e.target.value || null })} className={fieldClass}>
            <option value="">All games</option>
            {games.map((slug) => (
              <option key={slug} value={slug}>
                {gameTitle(slug)}
              </option>
            ))}
          </select>
        </label>
        <label className={`${labelClass} col-span-2 min-[760px]:col-span-1`}>
          Players
          <select value={filter.players} onChange={(e) => update({ players: e.target.value as RoomFilter["players"] })} className={fieldClass}>
            {PLAYERS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="m-0 text-xs text-black/60" aria-live="polite">
        {matches.length} of {rooms.length} rooms
        {filtered && (
          <>
            {" · "}
            <button
              type="button"
              onClick={() => reset(DEFAULT_FILTER)}
              className="cursor-pointer border-0 bg-transparent p-0 text-xs font-semibold text-[#0F7983] underline"
            >
              Reset filters
            </button>
          </>
        )}
      </p>

      {matches.length === 0 ? (
        <p className="m-0 text-sm text-black/60">{rooms.length === 0 ? "No rooms yet." : "No rooms match these filters."}</p>
      ) : (
        // Focusable so the keyboard can scroll it too.
        <div
          ref={listRef}
          role="region"
          aria-label="Rooms"
          tabIndex={0}
          className={`${LIST_HEIGHT} overflow-y-auto overscroll-contain rounded-lg border border-black/15 px-3`}
        >
          <ul className="m-0 flex list-none flex-col p-0">
            {matches.slice(0, limit).map((room) => (
              <RoomItem key={room.code} room={room} onChanged={onChanged} />
            ))}
          </ul>
          {matches.length > limit && (
            <button
              type="button"
              onClick={() => setLimit((n) => n + PAGE_SIZE)}
              className="my-3 cursor-pointer rounded-lg border-2 border-black/20 bg-white px-3 py-1.5 text-sm font-bold text-black"
            >
              Show {Math.min(PAGE_SIZE, matches.length - limit)} more
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const STATUS_LABEL: Record<RoomStatus, string> = { playing: "Playing", waiting: "Waiting", idle: "Idle", closed: "Closed" };
const STATUS_DOT: Record<RoomStatus, string> = {
  playing: "bg-[#1F8A4C]",
  waiting: "bg-black/30",
  idle: "border border-black/40",
  closed: "bg-[#B3123F]",
};

function RoomItem({ room, onChanged }: { room: RoomRow; onChanged: () => void }) {
  const label = room.name ?? room.code;
  const what = `${gameTitle(room.gameSlug)} room "${label}"`;
  const ago = (ms: number) => `${formatDuration(ms)} ago`;
  const when =
    room.status === "closed"
      ? `closed ${ago(room.closedAgoMs ?? 0)}`
      : room.status === "idle"
        ? room.lastActiveAgoMs != null
          ? `last played ${ago(room.lastActiveAgoMs)}`
          : `opened ${ago(room.createdAgoMs)}`
        : `${room.online} online · opened ${ago(room.createdAgoMs)}`;

  return (
    <li className="flex items-center gap-3 border-b border-black/10 py-2.5 text-sm last:border-0">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-bold">{gameTitle(room.gameSlug)}</span>
        <a href={roomHref(room.gameSlug, room.code)} target="_blank" rel="noreferrer" className="font-semibold text-[#0F7983] underline">
          {label}
        </a>
        {room.name && <span className="text-black/60">{room.code}</span>}
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className={`size-2 rounded-full ${STATUS_DOT[room.status]}`} />
          {STATUS_LABEL[room.status]}
        </span>
        <span className="text-black/60 tabular-nums">
          {room.seatsFilled}/{room.maxPlayers} seats · {when}
        </span>
      </div>
      {room.status === "closed" ? (
        <RoomActionButton
          label="Delete"
          busyLabel="Deleting…"
          ariaLabel={`Delete room ${label}`}
          confirm={`Delete the ${what}? Its game and its name go; its numbers stay on this dashboard. Anyone who opens its link again gets a new, empty room. This can't be undone.`}
          url={`/api/admin/rooms/${room.code}`}
          method="DELETE"
          onDone={onChanged}
        />
      ) : (
        <RoomActionButton
          label="Close"
          busyLabel="Closing…"
          ariaLabel={`Close room ${label}`}
          confirm={`Close the ${what}? Everyone in it sees "This room was closed" and can't play on. This can't be undone.`}
          url={`/api/admin/rooms/${room.code}/close`}
          method="POST"
          onDone={onChanged}
        />
      )}
    </li>
  );
}

/** A confirm-first button that calls an admin room route, then `onDone`. */
function RoomActionButton(props: { label: string; busyLabel: string; ariaLabel: string; confirm: string; url: string; method: "POST" | "DELETE"; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (!window.confirm(props.confirm)) return;
    setBusy(true);
    try {
      const response = await fetch(props.url, { method: props.method });
      if (response.ok) return props.onDone();
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      window.alert(body?.error ?? `The server answered ${response.status}.`);
    } catch {
      window.alert("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      onClick={() => void run()}
      disabled={busy}
      aria-label={props.ariaLabel}
      className="shrink-0 cursor-pointer rounded-lg border-2 border-[#B3123F] bg-white px-3 py-1.5 text-sm font-bold text-[#B3123F] disabled:cursor-wait disabled:opacity-60"
    >
      {busy ? props.busyLabel : props.label}
    </button>
  );
}
