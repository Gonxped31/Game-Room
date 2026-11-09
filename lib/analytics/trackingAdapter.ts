import { MODES, readFirstTouch } from "@/lib/tracking/events";
import type { CreatedRoomSnap, FinishedGameSnap, FinisherSnap, TrackedGuestSnap, TrackingSnapshot } from "./types";

/**
 * Partyfox's side of the games-finished and source numbers: turns the raw
 * trees (read with firebase-admin) into a TrackingSnapshot. `finished/games`,
 * `finished/players`, each guest's `firstTouch`, and the rooms' creators and
 * the guests' earliest activity from `games`, `users` and `analytics/archive`.
 * Malformed entries are skipped.
 */

export interface RawTracking {
  games: unknown;
  users: unknown;
  archive: unknown;
  /** `finished/games` */
  finishedGames: unknown;
  /** `finished/players` */
  finishedPlayers: unknown;
}

const isTime = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;
const isText = (value: unknown): value is string => typeof value === "string" && value.length > 0;
const entries = (tree: unknown): [string, Record<string, unknown>][] =>
  tree && typeof tree === "object"
    ? Object.entries(tree as Record<string, unknown>).filter((pair): pair is [string, Record<string, unknown>] => !!pair[1] && typeof pair[1] === "object")
    : [];

export function toTrackingSnapshot(raw: RawTracking, now: number, statsSince?: number): TrackingSnapshot {
  const firstActive = new Map<string, number>();
  const active = (uid: string, at: unknown) => {
    if (!isTime(at)) return;
    const known = firstActive.get(uid);
    if (known == null || at < known) firstActive.set(uid, at);
  };

  const rooms: CreatedRoomSnap[] = [];
  for (const [code, room] of entries(raw.games)) {
    const meta = room.meta as Record<string, unknown> | undefined;
    if (!meta || !isTime(meta.createdAt)) continue;
    rooms.push({ code, createdAt: meta.createdAt, ...(isText(meta.createdBy) ? { createdBy: meta.createdBy } : {}) });
  }
  for (const [code, room] of entries(raw.archive)) {
    if (!isTime(room.createdAt)) continue;
    rooms.push({ code, createdAt: room.createdAt, ...(isText(room.createdBy) ? { createdBy: room.createdBy } : {}) });
    for (const [uid, guest] of entries(room.guests)) active(uid, guest.addedAt);
  }

  const touches = new Map<string, NonNullable<TrackedGuestSnap["touch"]>>();
  for (const [uid, user] of entries(raw.users)) {
    const touch = readFirstTouch(user.firstTouch);
    if (touch) touches.set(uid, { src: touch.src, ...(touch.cmp ? { cmp: touch.cmp } : {}), at: touch.at });
    for (const [, room] of entries(user.rooms)) active(uid, room.addedAt);
    for (const [, day] of entries(user.visits)) for (const [, visit] of entries(day)) active(uid, visit.at);
  }

  const games: FinishedGameSnap[] = [];
  for (const [key, game] of entries(raw.finishedGames)) {
    if (!isText(game.slug) || !MODES.includes(game.mode as never) || !isTime(game.at)) continue;
    games.push({ key, slug: game.slug, mode: game.mode as string, matchmade: game.matchmade === true, at: game.at });
  }
  const finishers: FinisherSnap[] = [];
  for (const [, entry] of entries(raw.finishedPlayers)) {
    if (!isText(entry.game) || !isText(entry.uid) || !isText(entry.src) || !isTime(entry.at)) continue;
    finishers.push({ game: entry.game, uid: entry.uid, src: entry.src, ...(isText(entry.cmp) ? { cmp: entry.cmp } : {}), at: entry.at });
    active(entry.uid, entry.at);
  }

  const uids = new Set([...touches.keys(), ...firstActive.keys()]);
  const guests: TrackedGuestSnap[] = [...uids].map((uid) => ({
    uid,
    ...(touches.has(uid) ? { touch: touches.get(uid) } : {}),
    ...(firstActive.has(uid) ? { firstActiveAt: firstActive.get(uid) } : {}),
  }));
  return { games, finishers, guests, rooms, now, ...(statsSince != null ? { statsSince } : {}) };
}
