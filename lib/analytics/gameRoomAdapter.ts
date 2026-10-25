import type { PresenceEntry, RoomMeta, UserRoomEntry, VisitEntry } from "@/lib/session/shared/updates";
import type { GuestRoomSnap, GuestSnap, RoomSnap, Snapshot } from "./types";

/**
 * Game Room's side of the analytics: turns the raw `games` and `users` trees
 * (read with firebase-admin) into a platform-neutral `Snapshot`. Only the
 * room-level nodes are used; game state is never looked at. Malformed
 * entries are skipped rather than trusted.
 */

export interface RawRoom {
  meta?: Partial<RoomMeta>;
  seats?: Record<string, string | null>;
  presence?: Record<string, Partial<PresenceEntry>>;
  lastActive?: unknown;
  activeMinutes?: { n?: unknown };
  closedAt?: unknown;
}

interface RawUser {
  rooms?: Record<string, Partial<UserRoomEntry>>;
  /** `{yyyymmdd: {roomCode: VisitEntry}}` */
  visits?: Record<string, unknown>;
}

/** A room's creator, by code, for rooms a guest knows only from visits (no `createdByMe` there). */
type CreatorOf = (code: string) => string | undefined;

const isTime = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;
const entries = <T>(tree: unknown) => (tree && typeof tree === "object" ? Object.entries(tree as Record<string, T>) : []);

export function toRoomSnap(code: string, raw: RawRoom): RoomSnap | null {
  const meta = raw?.meta;
  if (!meta || typeof meta.gameSlug !== "string" || !isTime(meta.createdAt)) return null;
  return {
    code,
    gameSlug: meta.gameSlug,
    createdAt: meta.createdAt,
    lastActive: isTime(raw.lastActive) ? raw.lastActive : undefined,
    name: typeof meta.name === "string" ? meta.name : undefined,
    seatsFilled: entries<string | null>(raw.seats).filter(([, uid]) => typeof uid === "string" && uid).length,
    maxPlayers: typeof meta.maxPlayers === "number" ? meta.maxPlayers : 2,
    onlineUids: entries<Partial<PresenceEntry>>(raw.presence)
      .filter(([, entry]) => entry?.online === true)
      .map(([uid]) => uid),
    ...(typeof raw.activeMinutes?.n === "number" && raw.activeMinutes.n >= 0 ? { activeMinutes: raw.activeMinutes.n } : {}),
    ...(isTime(raw.closedAt) ? { closedAt: raw.closedAt } : {}),
    ...(typeof meta.publicLang === "string" ? { matchmade: true } : {}),
  };
}

/**
 * One guest's rooms, from their room list (`users/{uid}/rooms`, which "Leave
 * room" and the hub clear) and their visits (`users/{uid}/visits`, which
 * stay), so leaving a room never drops it from the numbers. A room's first
 * day is the earliest of the two.
 */
export function toGuestSnap(uid: string, raw: RawUser, creatorOf: CreatorOf = () => undefined): GuestSnap {
  const rooms = new Map<string, GuestRoomSnap>();
  for (const [code, entry] of entries<Partial<UserRoomEntry> | null>(raw?.rooms)) {
    if (!entry || typeof entry.gameSlug !== "string" || !isTime(entry.addedAt)) continue;
    rooms.set(code, { code, gameSlug: entry.gameSlug, addedAt: entry.addedAt, createdByMe: entry.createdByMe === true || creatorOf(code) === uid });
  }
  const visits: number[] = [];
  for (const [, day] of entries<unknown>(raw?.visits)) {
    for (const [code, visit] of entries<Partial<VisitEntry> | null>(day)) {
      if (!visit || typeof visit.gameSlug !== "string" || !isTime(visit.at)) continue;
      visits.push(visit.at);
      const known = rooms.get(code);
      if (!known) rooms.set(code, { code, gameSlug: visit.gameSlug, addedAt: visit.at, createdByMe: creatorOf(code) === uid });
      else if (visit.at < known.addedAt) known.addedAt = visit.at;
    }
  }
  return { uid, rooms: [...rooms.values()], ...(visits.length ? { visits } : {}) };
}

/**
 * What's kept of a deleted room at `analytics/archive/{code}` (admin only),
 * so its history still counts: no game state, no names.
 */
export interface ArchivedRoom {
  gameSlug: string;
  maxPlayers: number;
  createdAt: number;
  seatsFilled: number;
  lastActive?: number;
  activeMinutes?: number;
  closedAt?: number;
  matchmade?: true;
  /** The creating guest's uid (meta.createdBy), for the invite loop. */
  createdBy?: string;
  deletedAt: number;
  /** Each guest's entry for the room, since the hub drops `users/{uid}/rooms/{code}` once the room is gone. */
  guests?: Record<string, { addedAt: number; createdByMe?: true }>;
}

/** The archive entry for a room about to be deleted, from its raw node and the `users` tree. Optional fields are left out, never undefined (firebase-admin refuses undefined). */
export function toArchivedRoom(code: string, raw: RawRoom, users: unknown, deletedAt: number): ArchivedRoom | null {
  const room = toRoomSnap(code, raw);
  if (!room) return null;
  const guests: NonNullable<ArchivedRoom["guests"]> = {};
  for (const [uid, user] of entries<RawUser>(users)) {
    const entry = toGuestSnap(uid, user, () => raw.meta?.createdBy).rooms.find((r) => r.code === code);
    if (entry) guests[uid] = { addedAt: entry.addedAt, ...(entry.createdByMe ? { createdByMe: true as const } : {}) };
  }
  return {
    gameSlug: room.gameSlug,
    maxPlayers: room.maxPlayers,
    createdAt: room.createdAt,
    seatsFilled: room.seatsFilled,
    deletedAt,
    ...(room.lastActive != null ? { lastActive: room.lastActive } : {}),
    ...(room.activeMinutes != null ? { activeMinutes: room.activeMinutes } : {}),
    ...(room.closedAt != null ? { closedAt: room.closedAt } : {}),
    ...(room.matchmade ? { matchmade: true as const } : {}),
    ...(typeof raw.meta?.createdBy === "string" ? { createdBy: raw.meta.createdBy } : {}),
    ...(Object.keys(guests).length ? { guests } : {}),
  };
}

const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : undefined);

/** An archive entry back as a room (never live), or null if malformed. */
export function fromArchivedRoom(code: string, raw: Partial<ArchivedRoom> | null): RoomSnap | null {
  if (!raw || typeof raw.gameSlug !== "string" || !isTime(raw.createdAt)) return null;
  return {
    code,
    gameSlug: raw.gameSlug,
    createdAt: raw.createdAt,
    ...(isTime(raw.lastActive) ? { lastActive: raw.lastActive } : {}),
    ...(num(raw.activeMinutes) != null ? { activeMinutes: raw.activeMinutes } : {}),
    seatsFilled: num(raw.seatsFilled) ?? 0,
    maxPlayers: num(raw.maxPlayers) ?? 2,
    onlineUids: [],
    ...(isTime(raw.closedAt) ? { closedAt: raw.closedAt } : {}),
    ...(raw.matchmade === true ? { matchmade: true } : {}),
    deleted: true,
  };
}

/**
 * `games`, `users` and `analytics/archive` as read from the database root
 * (any may be null when empty). An archived room's guest entries fill in
 * the ones the hub has since dropped from `users`.
 */
export function toSnapshot(games: unknown, users: unknown, now: number, archive: unknown = null): Snapshot {
  const creators = new Map<string, string>();
  for (const [code, raw] of entries<Partial<ArchivedRoom> | null>(archive)) if (typeof raw?.createdBy === "string") creators.set(code, raw.createdBy);
  for (const [code, raw] of entries<RawRoom | null>(games)) if (typeof raw?.meta?.createdBy === "string") creators.set(code, raw.meta.createdBy);
  const guests = entries<RawUser>(users).map(([uid, raw]) => toGuestSnap(uid, raw, (code) => creators.get(code)));
  const byUid = new Map(guests.map((guest) => [guest.uid, guest]));
  const archived = entries<Partial<ArchivedRoom> | null>(archive).flatMap(([code, raw]) => {
    const room = fromArchivedRoom(code, raw);
    if (!room) return [];
    for (const [uid, entry] of entries<{ addedAt?: unknown; createdByMe?: unknown } | null>(raw?.guests)) {
      if (!entry || !isTime(entry.addedAt)) continue;
      let guest = byUid.get(uid);
      if (!guest) {
        guest = { uid, rooms: [] };
        byUid.set(uid, guest);
        guests.push(guest);
      }
      const kept: GuestRoomSnap = { code, gameSlug: room.gameSlug, addedAt: entry.addedAt, createdByMe: entry.createdByMe === true };
      if (!guest.rooms.some((r) => r.code === code)) guest.rooms.push(kept);
    }
    return [room];
  });
  return {
    rooms: [...entries<RawRoom>(games).flatMap(([code, raw]) => toRoomSnap(code, raw) ?? []), ...archived],
    guests,
    now,
  };
}
