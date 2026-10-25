/**
 * Matchmaking for games played with strangers (docs/matchmaking.md): the
 * pure decisions - which public room to try, when a lone waiting player
 * should move to another room, and when a public room starts by itself.
 * The async side (reading the queue, claiming a seat) is `findMatch.ts`; the
 * room side (keeping the queue entry fresh, the auto-start) is
 * `lib/session/usePublicRoom.ts`.
 *
 * A public room is an ordinary room whose `meta.publicLang` is set (`"en"`,
 * `"fr"`, or `ANY_LANG` for a game without words). While its
 * game sits in the lobby with seats to fill, it's listed at
 * `queue/{slug}/{lang}/{room}`, which any signed-in guest may read.
 */

/** One public room in the queue: how many seated players are online, and when a member last refreshed that. */
export interface QueueEntry {
  players: number;
  updatedAt: number;
}

export type Queue = Partial<Record<string, QueueEntry>>;

/** A seated member re-writes its room's entry at least this often while it's listed. */
export const QUEUE_REFRESH_MS = 20_000;
/** An entry older than this is ignored, and anyone may delete it (the rules check the same number). */
export const QUEUE_STALE_MS = 60_000;
/** Once a public room has enough players online, it starts this long after... */
export const AUTO_START_MS = 20_000;
/** ...or this soon once every seat is taken. */
export const AUTO_START_FULL_MS = 5_000;
/** How many rooms one search tries before creating its own. */
export const MAX_TRIES = 5;

/** The queue "language" of a game with no content language (Night Highway): everyone waits in one queue. */
export const ANY_LANG = "any";

export const queuePath = (slug: string, lang: string) => `queue/${slug}/${lang}`;

const isFresh = (entry: QueueEntry | undefined, now: number): entry is QueueEntry =>
  entry != null && typeof entry.updatedAt === "number" && entry.updatedAt >= now - QUEUE_STALE_MS;

/**
 * The rooms worth trying, best first: fresh, with a free seat, fullest first
 * (so waiting players start sooner), then by code for a stable order.
 */
export function rankRooms(queue: Queue | null, opts: { now: number; maxPlayers: number; exclude?: string }): string[] {
  const { now, maxPlayers, exclude } = opts;
  return Object.entries(queue ?? {})
    .filter((pair): pair is [string, QueueEntry] => pair[0] !== exclude && isFresh(pair[1], now) && pair[1].players < maxPlayers)
    .sort(([a, x], [b, y]) => y.players - x.players || (a < b ? -1 : a > b ? 1 : 0))
    .map(([code]) => code);
}

/** Entries nobody has refreshed for a while - left behind by rooms whose players are gone. */
export function staleRooms(queue: Queue | null, now: number): string[] {
  return Object.entries(queue ?? {})
    .filter(([, entry]) => !isFresh(entry, now))
    .map(([code]) => code);
}

/**
 * For a player waiting ALONE in public room `mine`: another waiting room to
 * move to, or null to stay. Two people who search at the same moment can
 * each create a room; this brings them together. A room with company always
 * wins; between two lone rooms the lower code wins, so exactly one of the
 * two players moves.
 */
export function betterRoom(queue: Queue | null, opts: { mine: string; now: number; maxPlayers: number }): string | null {
  const { mine, now, maxPlayers } = opts;
  const candidates = rankRooms(queue, { now, maxPlayers, exclude: mine });
  return candidates.find((code) => {
    const players = queue?.[code]?.players ?? 0;
    return players > 1 || (players === 1 && code < mine);
  }) ?? null;
}

/**
 * The public room's auto-start deadline (server ms), given the current one:
 * none until the game is `ready` (enough players online, e.g. even teams),
 * `AUTO_START_MS` from the moment it gets there, brought forward to
 * `AUTO_START_FULL_MS` from now once the room is full. Null means "no
 * countdown"; returning `current` unchanged means "leave it".
 */
export function nextAutoStart(opts: { current: number | null; ready: boolean; full: boolean; now: number }): number | null {
  const { current, ready, full, now } = opts;
  if (!ready) return null;
  if (full) return current != null && current <= now + AUTO_START_FULL_MS ? current : now + AUTO_START_FULL_MS;
  return current ?? now + AUTO_START_MS;
}
