import type { DashboardStats, GameStats, GuestSnap, InviteLoop, Rate, RoomRow, RoomSnap, RoomStatus, Snapshot } from "./types";

export const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_MS = 30 * DAY_MS;
/** `lastActive` is refreshed every minute during a game; older than this, the game has stopped. */
export const PLAYING_FRESH_MS = 2 * 60 * 1000;
/**
 * A room from before the per-minute counter has its play time estimated as
 * created → last active. A room reused days later would count the whole
 * gap, so one room's estimate is capped here.
 */
export const PLAY_ESTIMATE_CAP_MS = 3 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

const dayOf = (t: number) => Math.floor(t / DAY_MS);
const rate = (count: number, of: number): Rate => ({ count, of, rate: of > 0 ? count / of : null });

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Estimated play time for a room, or null if it never reached a playable game. */
export function estimatePlayMs(room: RoomSnap): number | null {
  if (room.lastActive == null) return null;
  return Math.min(Math.max(room.lastActive - room.createdAt, 0), PLAY_ESTIMATE_CAP_MS);
}

const STATUS_ORDER: RoomStatus[] = ["playing", "waiting", "idle", "closed"];

/** How long ago a row's status began, for sorting most recent first: opened (live), last played (idle), closed. */
const sinceMs = (row: RoomRow) =>
  row.status === "closed" ? (row.closedAgoMs ?? 0) : row.status === "idle" ? (row.lastActiveAgoMs ?? row.createdAgoMs) : row.createdAgoMs;

/** A room's play time: its counted minutes, else the estimate (null if it never reached a playable game). */
export function playMs(room: RoomSnap): number | null {
  return room.activeMinutes != null ? room.activeMinutes * MINUTE_MS : estimatePlayMs(room);
}

/**
 * The invite loop since `since`: did created rooms bring in another guest,
 * how many per creator, and did invited newcomers go on to create rooms of
 * their own. A guest's entry for a room says whether they created it or came
 * from a link; matchmade rooms are left out (nobody was invited to them).
 */
export function computeInviteLoop(rooms: RoomSnap[], guests: GuestSnap[], since: number): InviteLoop {
  const matchmade = new Set(rooms.filter((room) => room.matchmade).map((room) => room.code));
  const byRoom = new Map<string, { creator?: string; createdAt: number; joiners: Set<string> }>();
  for (const guest of guests) {
    for (const entry of guest.rooms) {
      if (matchmade.has(entry.code)) continue;
      const room = byRoom.get(entry.code) ?? { createdAt: 0, joiners: new Set<string>() };
      byRoom.set(entry.code, room);
      if (entry.createdByMe) {
        room.creator = guest.uid;
        room.createdAt = entry.addedAt;
      } else room.joiners.add(guest.uid);
    }
  }

  let created = 0;
  let converted = 0;
  const creators = new Set<string>();
  const invited = new Set<string>();
  for (const room of byRoom.values()) {
    if (room.creator == null || room.createdAt < since) continue;
    created++;
    creators.add(room.creator);
    if (room.joiners.size) converted++;
    room.joiners.forEach((uid) => invited.add(uid));
  }

  let newcomers = 0;
  let looped = 0;
  for (const guest of guests) {
    const [first, ...later] = [...guest.rooms].sort((a, b) => a.addedAt - b.addedAt);
    if (!first || first.createdByMe || matchmade.has(first.code) || first.addedAt < since) continue;
    newcomers++;
    if (later.some((entry) => entry.createdByMe && !matchmade.has(entry.code))) looped++;
  }

  return { converted: rate(converted, created), invitedGuests: invited.size, creators: creators.size, loop: rate(looped, newcomers) };
}

/**
 * Everything the dashboard shows, from one snapshot. `gameOrder` lists the
 * games to report, in display order; a slug found in the data but not listed
 * is appended, so nothing is silently dropped.
 */
export function computeDashboard(snapshot: Snapshot, gameOrder: string[] = []): DashboardStats {
  const { rooms, now } = snapshot;
  // After a stats clear, history starts there; the live rooms and the room list don't.
  const from = snapshot.statsSince ?? 0;
  const since = Math.max(now - WINDOW_MS, from);
  const guests = from
    ? snapshot.guests.map((guest) => ({
        ...guest,
        rooms: guest.rooms.filter((entry) => entry.addedAt >= from),
        ...(guest.visits ? { visits: guest.visits.filter((at) => at >= from) } : {}),
      }))
    : snapshot.guests;
  const slugs = [...gameOrder];
  const statsBySlug = new Map<string, GameStats>();
  const statsFor = (gameSlug: string) => {
    let stats = statsBySlug.get(gameSlug);
    if (!stats) {
      stats = { gameSlug, liveRooms: 0, roomsCreated30d: 0, roomsAllTime: 0, players30d: 0, playersAllTime: 0, playedRooms30d: 0, playMs30d: 0, medianPlayMs30d: null };
      statsBySlug.set(gameSlug, stats);
      if (!slugs.includes(gameSlug)) slugs.push(gameSlug);
    }
    return stats;
  };
  gameOrder.forEach(statsFor);

  // Rooms: the list, live now, created, and play time.
  const rows: RoomRow[] = [];
  const onlineGuests = new Set<string>();
  const playByGame = new Map<string, number[]>();
  const allPlay: number[] = [];
  let roomsCreated30d = 0;
  let estimatedPlayRooms30d = 0;
  for (const room of rooms) {
    const stats = statsFor(room.gameSlug);
    const counted = room.createdAt >= from;
    if (counted) stats.roomsAllTime++;
    if (room.createdAt >= since) {
      stats.roomsCreated30d++;
      roomsCreated30d++;
    }
    const play = playMs(room);
    if (counted && play != null && room.lastActive != null && room.lastActive >= since) {
      if (room.activeMinutes == null) estimatedPlayRooms30d++;
      stats.playedRooms30d++;
      stats.playMs30d += play;
      allPlay.push(play);
      playByGame.set(room.gameSlug, [...(playByGame.get(room.gameSlug) ?? []), play]);
    }
    const live = room.onlineUids.length > 0 && room.closedAt == null;
    if (live) {
      stats.liveRooms++;
      room.onlineUids.forEach((uid) => onlineGuests.add(uid));
    }
    if (room.deleted) continue;
    const ago = (t: number) => Math.max(now - t, 0);
    rows.push({
      code: room.code,
      gameSlug: room.gameSlug,
      name: room.name,
      seatsFilled: room.seatsFilled,
      maxPlayers: room.maxPlayers,
      online: room.onlineUids.length,
      status:
        room.closedAt != null ? "closed" : !live ? "idle" : room.lastActive != null && now - room.lastActive <= PLAYING_FRESH_MS ? "playing" : "waiting",
      createdAgoMs: ago(room.createdAt),
      ...(room.lastActive != null ? { lastActiveAgoMs: ago(room.lastActive) } : {}),
      ...(room.closedAt != null ? { closedAgoMs: ago(room.closedAt) } : {}),
    });
  }
  for (const [slug, plays] of playByGame) statsFor(slug).medianPlayMs30d = median(plays);
  rows.sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || sinceMs(a) - sinceMs(b));
  const liveRows = rows.filter((row) => row.status === "playing" || row.status === "waiting");

  // Guests: players per game, and who came back.
  const players30d = new Set<string>();
  const playersAllTime = new Set<string>();
  const gamePlayers = new Map<string, { all: Set<string>; recent: Set<string> }>();
  const today = dayOf(now);
  let seenBeforeToday = 0;
  let returning = 0;
  let firstSeenWeekAgo = 0;
  let returnedWithin7d = 0;
  for (const guest of guests) {
    if (!guest.rooms.length) continue;
    playersAllTime.add(guest.uid);
    for (const entry of guest.rooms) {
      const sets = gamePlayers.get(entry.gameSlug) ?? { all: new Set<string>(), recent: new Set<string>() };
      gamePlayers.set(entry.gameSlug, sets);
      sets.all.add(guest.uid);
      if (entry.addedAt >= since) {
        sets.recent.add(guest.uid);
        players30d.add(guest.uid);
      }
    }
    const activeAt = [...guest.rooms.map((entry) => entry.addedAt), ...(guest.visits ?? [])];
    const days = [...new Set(activeAt.map(dayOf))].sort((a, b) => a - b);
    const first = days[0];
    if (first < today) {
      seenBeforeToday++;
      if (days.length > 1) returning++;
    }
    if (first <= today - 7) {
      firstSeenWeekAgo++;
      if (days.some((day) => day > first && day <= first + 7)) returnedWithin7d++;
    }
  }
  for (const [slug, sets] of gamePlayers) {
    const stats = statsFor(slug);
    stats.playersAllTime = sets.all.size;
    stats.players30d = sets.recent.size;
  }

  return {
    generatedAt: now,
    ...(from ? { statsSince: from } : {}),
    totals: {
      liveRooms: liveRows.length,
      playingRooms: liveRows.filter((row) => row.status === "playing").length,
      onlineGuests: onlineGuests.size,
      players30d: players30d.size,
      playersAllTime: playersAllTime.size,
      roomsCreated30d,
      playedRooms30d: allPlay.length,
      playMs30d: allPlay.reduce((sum, ms) => sum + ms, 0),
      medianPlayMs30d: median(allPlay),
      estimatedPlayRooms30d,
      returning: rate(returning, seenBeforeToday),
      returnedWithin7d: rate(returnedWithin7d, firstSeenWeekAgo),
    },
    perGame: slugs.map((slug) => statsBySlug.get(slug)!),
    inviteLoop: computeInviteLoop(rooms, guests, since),
    rooms: rows,
  };
}
