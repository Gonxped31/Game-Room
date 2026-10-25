import type { DashboardStats, GameStats, LiveRoom, Rate, RoomSnap, Snapshot } from "./types";

export const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_MS = 30 * DAY_MS;
/** `lastActive` is refreshed every minute during a game; older than this, the game has stopped. */
export const PLAYING_FRESH_MS = 2 * 60 * 1000;
/**
 * Play time is estimated as created → last active. A room reused days later
 * would count the whole gap, so one room's estimate is capped here. Exact
 * play time needs a per-minute counter (T-059).
 */
export const PLAY_ESTIMATE_CAP_MS = 3 * 60 * 60 * 1000;

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

/**
 * Everything the dashboard shows, from one snapshot. `gameOrder` lists the
 * games to report, in display order; a slug found in the data but not listed
 * is appended, so nothing is silently dropped.
 */
export function computeDashboard(snapshot: Snapshot, gameOrder: string[] = []): DashboardStats {
  const { rooms, guests, now } = snapshot;
  const since = now - WINDOW_MS;
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

  // Rooms: live now, created, and estimated play time.
  const liveRooms: LiveRoom[] = [];
  const onlineGuests = new Set<string>();
  const playByGame = new Map<string, number[]>();
  const allPlay: number[] = [];
  let roomsCreated30d = 0;
  for (const room of rooms) {
    const stats = statsFor(room.gameSlug);
    stats.roomsAllTime++;
    if (room.createdAt >= since) {
      stats.roomsCreated30d++;
      roomsCreated30d++;
    }
    const play = estimatePlayMs(room);
    if (play != null && room.lastActive! >= since) {
      stats.playedRooms30d++;
      stats.playMs30d += play;
      allPlay.push(play);
      playByGame.set(room.gameSlug, [...(playByGame.get(room.gameSlug) ?? []), play]);
    }
    if (room.onlineUids.length && room.closedAt == null) {
      stats.liveRooms++;
      room.onlineUids.forEach((uid) => onlineGuests.add(uid));
      liveRooms.push({
        code: room.code,
        gameSlug: room.gameSlug,
        name: room.name,
        seatsFilled: room.seatsFilled,
        maxPlayers: room.maxPlayers,
        online: room.onlineUids.length,
        status: room.lastActive != null && now - room.lastActive <= PLAYING_FRESH_MS ? "playing" : "waiting",
        createdAgoMs: Math.max(now - room.createdAt, 0),
      });
    }
  }
  for (const [slug, plays] of playByGame) statsFor(slug).medianPlayMs30d = median(plays);
  liveRooms.sort((a, b) => (a.status === b.status ? a.createdAgoMs - b.createdAgoMs : a.status === "playing" ? -1 : 1));

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
    const days = [...new Set(guest.rooms.map((entry) => dayOf(entry.addedAt)))].sort((a, b) => a - b);
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
    totals: {
      liveRooms: liveRooms.length,
      playingRooms: liveRooms.filter((room) => room.status === "playing").length,
      onlineGuests: onlineGuests.size,
      players30d: players30d.size,
      playersAllTime: playersAllTime.size,
      roomsCreated30d,
      playedRooms30d: allPlay.length,
      playMs30d: allPlay.reduce((sum, ms) => sum + ms, 0),
      medianPlayMs30d: median(allPlay),
      returning: rate(returning, seenBeforeToday),
      returnedWithin7d: rate(returnedWithin7d, firstSeenWeekAgo),
    },
    perGame: slugs.map((slug) => statsBySlug.get(slug)!),
    liveRooms,
  };
}
