"use client";

import { useRef, useState } from "react";
import { formatDuration } from "@/lib/analytics/format";
import { countByStatus, DEFAULT_FILTER, filterRooms, PLAYERS_OPTIONS, type RoomFilter, STATUS_OPTIONS } from "@/lib/analytics/roomFilter";
import type { RoomRow, RoomStatus } from "@/lib/analytics/types";
import { gameBySlug, roomHref } from "@/lib/games/registry";
import { callAdmin } from "./callAdmin";
import ConfirmDialog, { type ConfirmRequest } from "./ConfirmDialog";

/** Rows shown at first, and added by each "Show more". */
const PAGE_SIZE = 50;
/** The list scrolls inside this height, so the filters and the rest of the page stay in reach however many rooms there are. */
const LIST_HEIGHT = "max-h-[min(65vh,36rem)]";
/** Rooms named in a bulk close or delete's confirm box before "and N more". */
const NAMED_IN_CONFIRM = 5;

const gameTitle = (slug: string) => gameBySlug(slug)?.title ?? slug;
const rooms = (n: number) => `${n} room${n === 1 ? "" : "s"}`;
// text-base on phones: iOS Safari zooms into any field under 16px when it's focused.
const fieldClass = "w-full rounded-lg border border-black/25 bg-white px-2.5 py-2 text-base font-normal text-black min-[760px]:text-sm";
const labelClass = "flex min-w-0 flex-col gap-1 text-xs font-semibold text-black/60";
const checkboxClass = "size-5 shrink-0 cursor-pointer accent-[#0F7983]";
const bulkButtonClass = "cursor-pointer rounded-lg border-2 border-[#B3123F] bg-[#B3123F] px-3 py-1.5 text-sm font-bold text-white";

/** The filters in words, for the confirm box ("Live now · Buzzer Quiz · fewer than 2 players"). */
function describeFilter(filter: RoomFilter): string {
  const status = STATUS_OPTIONS.find((option) => option.value === filter.status);
  const players = PLAYERS_OPTIONS.find((option) => option.value === filter.players);
  return [
    filter.status !== "all" && status?.label,
    filter.gameSlug && gameTitle(filter.gameSlug),
    filter.players !== "any" && players && `${players.label.toLowerCase()} players`,
    filter.query.trim() && `"${filter.query.trim()}"`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Every room, with filters: a search over names and codes (a pasted room
 * link works), status, game, and how many people hold a seat. Opens on the
 * live rooms. Rooms can be selected (or all those the filters match) to close
 * the open ones or delete the closed ones together; each row can also close
 * an open room or delete a closed one.
 */
export default function RoomList({ rooms: all, games, onChanged }: { rooms: RoomRow[]; games: string[]; onChanged: () => void }) {
  const [filter, setFilter] = useState<RoomFilter>(DEFAULT_FILTER);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [confirming, setConfirming] = useState<ConfirmRequest | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // A new filter starts over: first page, top of the list, nothing selected (so nothing hidden gets closed).
  const reset = (next: RoomFilter | ((current: RoomFilter) => RoomFilter)) => {
    setFilter(next);
    setLimit(PAGE_SIZE);
    setSelected(new Set());
    listRef.current?.scrollTo({ top: 0 });
  };
  const update = (change: Partial<RoomFilter>) => reset((current) => ({ ...current, ...change }));
  // After closing (one room or a selection), the filters go back to their defaults; deleting keeps them, for deleting several closed rooms in a row.
  const afterClose = () => reset(DEFAULT_FILTER);

  const matches = filterRooms(all, filter);
  const counts = countByStatus(all, filter);
  const filtered = filter.query !== "" || filter.gameSlug != null || filter.players !== DEFAULT_FILTER.players || filter.status !== DEFAULT_FILTER.status;
  // "Select all" takes exactly the rooms these filters match, loaded by "Show more" or not. The
  // selection's open rooms can be closed, its closed ones deleted; a deleted room drops out on the next refresh.
  const chosen = matches.filter((room) => selected.has(room.code));
  const allChosen = matches.length > 0 && chosen.length === matches.length;
  const chosenOpen = chosen.filter((room) => room.status !== "closed");
  const chosenClosed = chosen.filter((room) => room.status === "closed");

  const toggle = (code: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(code)) next.add(code);
      return next;
    });
  const toggleAll = () => setSelected(allChosen ? new Set() : new Set(matches.map((room) => room.code)));

  const confirmBulk = (verb: "Close" | "Delete", picked: RoomRow[], consequence: string, url: string, after: () => void) => {
    const codes = picked.map((room) => room.code);
    const names = picked.slice(0, NAMED_IN_CONFIRM).map((room) => room.name ?? room.code);
    const more = codes.length - names.length;
    // Every room the filters match: say which filters those are.
    const everyMatch = allChosen && picked.length === matches.length && picked.length > 1;
    const criteria = describeFilter(filter);
    setConfirming({
      title: everyMatch ? `${verb} all ${codes.length} matching rooms?` : `${verb} ${rooms(codes.length)}?`,
      message: `${everyMatch && criteria ? `Every room matching ${criteria}: ` : ""}${names.join(", ")}${more ? ` and ${more} more` : ""}. ${consequence}`,
      confirmLabel: `${verb} ${rooms(codes.length)}`,
      busyLabel: verb === "Close" ? "Closing…" : "Deleting…",
      run: async () => {
        const error = await callAdmin(url, "POST", { codes });
        if (!error) after();
        return error;
      },
    });
  };
  const closeChosen = () =>
    confirmBulk(
      "Close",
      chosenOpen,
      `Everyone in them sees "This room was closed" and can't play on. This can't be undone.`,
      "/api/admin/rooms/close",
      afterClose,
    );
  const deleteChosen = () =>
    confirmBulk(
      "Delete",
      chosenClosed,
      "They and their names go; their numbers stay on this dashboard. Anyone who opens one of their links again gets a new, empty room. This can't be undone.",
      "/api/admin/rooms/delete",
      () => setSelected(new Set()),
    );

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
        {matches.length} of {all.length} rooms
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
        <p className="m-0 text-sm text-black/60">{all.length === 0 ? "No rooms yet." : "No rooms match these filters."}</p>
      ) : (
        // Focusable so the keyboard can scroll it too.
        <div
          ref={listRef}
          role="region"
          aria-label="Rooms"
          tabIndex={0}
          className={`${LIST_HEIGHT} overflow-y-auto overscroll-contain rounded-lg border border-black/15 px-3`}
        >
          {/* Stays at the top while the list scrolls, so the selection can be acted on from anywhere in it. */}
          <div className="sticky top-0 z-10 -mx-3 flex min-h-12 flex-wrap items-center gap-x-3 gap-y-2 border-b border-black/15 bg-[#F4F8F8] px-3 py-2 text-sm">
            <label className="flex cursor-pointer items-center gap-2.5 font-semibold">
              <input
                type="checkbox"
                checked={allChosen}
                ref={(box) => {
                  if (box) box.indeterminate = chosen.length > 0 && !allChosen;
                }}
                onChange={toggleAll}
                className={checkboxClass}
              />
              Select all {matches.length} matching
            </label>
            {chosen.length > 0 && (
              <>
                <span className="text-black/60 tabular-nums">{chosen.length} selected</span>
                <span className="ml-auto flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelected(new Set())}
                    className="cursor-pointer border-0 bg-transparent p-0 text-sm font-semibold text-[#0F7983] underline"
                  >
                    Clear
                  </button>
                  {chosenOpen.length > 0 && (
                    <button type="button" onClick={closeChosen} className={bulkButtonClass}>
                      Close {rooms(chosenOpen.length)}
                    </button>
                  )}
                  {chosenClosed.length > 0 && (
                    <button type="button" onClick={deleteChosen} className={bulkButtonClass}>
                      Delete {rooms(chosenClosed.length)}
                    </button>
                  )}
                </span>
              </>
            )}
          </div>
          <ul className="m-0 flex list-none flex-col p-0">
            {matches.slice(0, limit).map((room) => (
              <RoomItem
                key={room.code}
                room={room}
                selected={selected.has(room.code)}
                onToggle={() => toggle(room.code)}
                onConfirm={setConfirming}
                onClosed={afterClose}
              />
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

      {confirming && (
        <ConfirmDialog
          request={confirming}
          onFinish={(done) => {
            setConfirming(null);
            if (done) onChanged();
          }}
        />
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

function RoomItem(props: { room: RoomRow; selected: boolean; onToggle: () => void; onConfirm: (request: ConfirmRequest) => void; onClosed: () => void }) {
  const { room, onConfirm } = props;
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
  const closed = room.status === "closed";

  return (
    <li className="flex items-center gap-3 border-b border-black/10 py-2.5 text-sm last:border-0">
      <input type="checkbox" checked={props.selected} onChange={props.onToggle} aria-label={`Select room ${label}`} className={checkboxClass} />
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
      <button
        type="button"
        aria-label={`${closed ? "Delete" : "Close"} room ${label}`}
        onClick={() =>
          onConfirm(
            closed
              ? {
                  title: `Delete room "${label}"?`,
                  message: `The ${what} and its name go; its numbers stay on this dashboard. Anyone who opens its link again gets a new, empty room. This can't be undone.`,
                  confirmLabel: "Delete room",
                  busyLabel: "Deleting…",
                  run: () => callAdmin(`/api/admin/rooms/${room.code}`, "DELETE"),
                }
              : {
                  title: `Close room "${label}"?`,
                  message: `Everyone in the ${what} sees "This room was closed" and can't play on. This can't be undone.`,
                  confirmLabel: "Close room",
                  busyLabel: "Closing…",
                  run: async () => {
                    const error = await callAdmin(`/api/admin/rooms/${room.code}/close`, "POST");
                    if (!error) props.onClosed();
                    return error;
                  },
                },
          )
        }
        className="shrink-0 cursor-pointer rounded-lg border-2 border-[#B3123F] bg-white px-3 py-1.5 text-sm font-bold text-[#B3123F]"
      >
        {closed ? "Delete" : "Close"}
      </button>
    </li>
  );
}
