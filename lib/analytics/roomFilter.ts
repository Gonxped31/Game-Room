import type { RoomRow } from "./types";

/**
 * The dashboard's room filters, applied in the browser to the room list the
 * stats route returns. Pure, so the matching rules are tested on their own.
 */

export type StatusFilter = "live" | "open" | "closed" | "all";
export type PlayersFilter = "any" | "empty" | "under2" | "2plus" | "full";

export interface RoomFilter {
  /** Part of a room's name or code; a pasted room link works too (only what follows `#` counts). */
  query: string;
  status: StatusFilter;
  /** null: every game. */
  gameSlug: string | null;
  /** By seats taken: the people in the room, online or not. */
  players: PlayersFilter;
}

export const DEFAULT_FILTER: RoomFilter = { query: "", status: "live", gameSlug: null, players: "any" };

export const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "live", label: "Live now" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "all", label: "All rooms" },
];

export const PLAYERS_OPTIONS: { value: PlayersFilter; label: string }[] = [
  { value: "any", label: "Any number" },
  { value: "empty", label: "Empty" },
  { value: "under2", label: "Fewer than 2" },
  { value: "2plus", label: "2 or more" },
  { value: "full", label: "Full" },
];

export function matchesStatus(room: RoomRow, status: StatusFilter): boolean {
  switch (status) {
    case "live":
      return room.status === "playing" || room.status === "waiting";
    case "open":
      return room.status !== "closed";
    case "closed":
      return room.status === "closed";
    case "all":
      return true;
  }
}

function matchesPlayers(room: RoomRow, players: PlayersFilter): boolean {
  switch (players) {
    case "any":
      return true;
    case "empty":
      return room.seatsFilled === 0;
    case "under2":
      return room.seatsFilled < 2;
    case "2plus":
      return room.seatsFilled >= 2;
    case "full":
      return room.seatsFilled >= room.maxPlayers;
  }
}

/** The search text as it's matched: lowercased, trimmed, and only the part after `#` of a pasted link. */
export function normalizeQuery(query: string): string {
  return (query.split("#").pop() ?? "").trim().toLowerCase();
}

function matchesQuery(room: RoomRow, q: string): boolean {
  return !q || room.code.includes(q) || (room.name?.toLowerCase().includes(q) ?? false);
}

/** Everything but the status test, so the status picker can show how many rooms each status would give. */
function matchesRest(room: RoomRow, filter: RoomFilter, q: string): boolean {
  return matchesQuery(room, q) && (filter.gameSlug == null || room.gameSlug === filter.gameSlug) && matchesPlayers(room, filter.players);
}

/** The rooms that pass every filter, in the list's own order. */
export function filterRooms(rooms: RoomRow[], filter: RoomFilter): RoomRow[] {
  const q = normalizeQuery(filter.query);
  return rooms.filter((room) => matchesStatus(room, filter.status) && matchesRest(room, filter, q));
}

/** How many rooms each status would show with the other filters as they are. */
export function countByStatus(rooms: RoomRow[], filter: RoomFilter): Record<StatusFilter, number> {
  const q = normalizeQuery(filter.query);
  const rest = rooms.filter((room) => matchesRest(room, filter, q));
  return {
    live: rest.filter((room) => matchesStatus(room, "live")).length,
    open: rest.filter((room) => matchesStatus(room, "open")).length,
    closed: rest.filter((room) => matchesStatus(room, "closed")).length,
    all: rest.length,
  };
}
