/**
 * Pure builders for every multi-path update the session layer sends - one
 * `{ path: value }` map per action, written from the database root in a
 * single `updateRoot()` call. They are the client-side half of
 * database.rules.json, and must match it:
 *
 * - The rules keep `seats/{seat} -> uid` and `members/{uid} -> seat` in sync,
 *   so the two are ALWAYS written together, in the same update.
 * - The rules only allow writes at these specific child paths, never at
 *   `games/{room}` itself.
 * - `ts` is the server-timestamp placeholder (`serverTimestamp()` from
 *   lib/store) - passed in rather than imported so these stay pure and the
 *   rules tests can feed the emulator's own placeholder through them.
 *
 * Used by the session hook (useSession, whatever the game's size): a seat is
 * just a string here (`"p1".."p8"`).
 */

export const room = (code: string, sub: string) => `games/${code}/${sub}`;

export interface RoomMeta {
  gameSlug: string;
  maxPlayers: number;
  createdAt: number;
  createdBy: string;
  /** Display name, set (and changeable) only by the creator. Absent means "show the code". */
  name?: string;
  /** `name` normalized - the key of its `roomsByName` entry. Always set together with `name`. */
  nameKey?: string;
  /**
   * Set only on a public room (one made by matchmaking, for strangers): the
   * language of its queue, `queue/{gameSlug}/{publicLang}`. Write-once, with
   * the rest of meta.
   */
  publicLang?: string;
}

/** One guest's entry in their own room list (`users/{uid}/rooms/{code}`). */
export interface UserRoomEntry {
  gameSlug: string;
  addedAt: number;
  createdByMe?: boolean;
  name?: string;
}

/**
 * `games/{room}/activeMinutes`: how many minutes a game was in progress
 * (the dashboard's play time). Every seated device tries to count once a
 * minute; the rules let one count through per minute, so the total doesn't
 * grow with the number of players.
 */
export interface ActiveMinutes {
  n: number;
  /** When the last minute was counted (server ms). */
  at: number;
}

/** The rules refuse a count less than 50 s after the last; the client waits a little longer, so clock drift doesn't make it try. */
export const ACTIVE_MINUTE_GAP_MS = 55_000;

/** The next `activeMinutes`, for a transaction: undefined (no write) while another device's count for this minute is fresh. */
export function nextActiveMinutes(current: ActiveMinutes | null, now: number, ts: unknown): ActiveMinutes | undefined {
  if (current && now - current.at < ACTIVE_MINUTE_GAP_MS) return undefined;
  return { n: (current?.n ?? 0) + 1, at: ts as number };
}

export interface PresenceEntry {
  online: boolean;
  lastSeen: number;
}

/**
 * A room name's index key: lowercase, trimmed, spaces to `-`, anything else
 * not `a-z 0-9 -` dropped. Null when that leaves fewer than 3 or more than 40
 * characters - the rules' limits for a `roomsByName` key.
 */
export function nameKey(name: string): string | null {
  const key = name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  return key.length >= 3 && key.length <= 40 ? key : null;
}

/**
 * A brand-new room: meta (write-once), the game's initial state, and the
 * creator's own room-list entry. Nobody is seated yet - the creator claims a
 * seat through the game's picker afterwards, like everyone else (a game like
 * Co-Counsel lets the creator choose p2). A public room (`publicLang`) is
 * also listed in its matchmaking queue, with nobody in it yet.
 */
export function createRoomUpdate(opts: { code: string; uid: string; gameSlug: string; maxPlayers: number; initialState: unknown; ts: unknown; publicLang?: string }) {
  const { code, uid, gameSlug, maxPlayers, initialState, ts, publicLang } = opts;
  return {
    [room(code, "meta")]: { gameSlug, maxPlayers, createdAt: ts, createdBy: uid, ...(publicLang ? { publicLang } : {}) },
    [room(code, gameSlug)]: initialState,
    [`users/${uid}/rooms/${code}`]: { gameSlug, addedAt: ts, createdByMe: true },
    ...(publicLang ? queueEntryUpdate({ code, gameSlug, lang: publicLang, players: 0, ts }) : {}),
  };
}

/** Lists (or refreshes) a public room in its matchmaking queue: `players` is how many seated players are online. */
export function queueEntryUpdate(opts: { code: string; gameSlug: string; lang: string; players: number; ts: unknown }) {
  const { code, gameSlug, lang, players, ts } = opts;
  return { [`queue/${gameSlug}/${lang}/${code}`]: { players, updatedAt: ts } };
}

/** Takes a room out of its matchmaking queue - it's full, under way, or (anyone may do this) its entry went stale. */
export function queueRemoveUpdate(opts: { code: string; gameSlug: string; lang: string }) {
  const { code, gameSlug, lang } = opts;
  return { [`queue/${gameSlug}/${lang}/${code}`]: null };
}

function userRoomEntry(meta: Pick<RoomMeta, "gameSlug" | "createdBy" | "name">, uid: string, ts: unknown) {
  return {
    gameSlug: meta.gameSlug,
    addedAt: ts,
    ...(meta.createdBy === uid ? { createdByMe: true } : {}),
    ...(meta.name ? { name: meta.name } : {}),
  };
}

/** Claims an empty seat, with a display name, and adds the room to this guest's list. */
export function claimSeatUpdate(opts: { code: string; seat: string; uid: string; name: string; meta: RoomMeta; ts: unknown }) {
  const { code, seat, uid, name, meta, ts } = opts;
  return {
    [room(code, `seats/${seat}`)]: uid,
    [room(code, `members/${uid}`)]: seat,
    [room(code, `players/${seat}`)]: { name },
    [`users/${uid}/rooms/${code}`]: userRoomEntry(meta, uid, ts),
  };
}

/** Moves this guest from the seat it holds to an empty one. */
export function switchSeatUpdate(opts: { code: string; uid: string; from: string; to: string; name: string }) {
  const { code, uid, from, to, name } = opts;
  return {
    [room(code, `seats/${from}`)]: null,
    [room(code, `seats/${to}`)]: uid,
    [room(code, `members/${uid}`)]: to,
    [room(code, `players/${to}`)]: { name },
  };
}

/**
 * Two seated guests trade seats - Co-Counsel's "Switch role instead". The
 * rules allow it only between guests who are BOTH already members, as a pure
 * permutation (nobody leaves, nobody new sits down). Display names stay with
 * the seat: for Co-Counsel they're the case's fixed character names, which
 * belong to the role, not the person.
 */
export function swapSeatsUpdate(opts: { code: string; a: { uid: string; seat: string }; b: { uid: string; seat: string } }) {
  const { code, a, b } = opts;
  return {
    [room(code, `seats/${a.seat}`)]: b.uid,
    [room(code, `seats/${b.seat}`)]: a.uid,
    [room(code, `members/${a.uid}`)]: b.seat,
    [room(code, `members/${b.uid}`)]: a.seat,
  };
}

/**
 * Gives up this guest's seat ("Leave room"). Presence goes too - a non-member
 * has none - and so does the room's entry in their "Your rooms": they left it.
 */
export function leaveRoomUpdate(opts: { code: string; uid: string; seat: string }) {
  const { code, uid, seat } = opts;
  return {
    [room(code, `seats/${seat}`)]: null,
    [room(code, `members/${uid}`)]: null,
    [room(code, `presence/${uid}`)]: null,
    [`users/${uid}/rooms/${code}`]: null,
  };
}

/**
 * Takes over a seat whose holder has been offline for over 2 minutes (the
 * rules check that) - how a player who lost their guest ID (wiped storage,
 * a different browser) gets back in. The old holder's membership goes in the
 * same update; if this guest held another seat, it's vacated too.
 */
export function takeOverSeatUpdate(opts: { code: string; seat: string; uid: string; oldUid: string; mySeat: string | null; name: string; meta: RoomMeta; ts: unknown }) {
  const { code, seat, uid, oldUid, mySeat, name, meta, ts } = opts;
  return {
    ...(mySeat && mySeat !== seat ? { [room(code, `seats/${mySeat}`)]: null } : {}),
    [room(code, `seats/${seat}`)]: uid,
    [room(code, `members/${uid}`)]: seat,
    [room(code, `members/${oldUid}`)]: null,
    [room(code, `players/${seat}`)]: { name },
    [`users/${uid}/rooms/${code}`]: userRoomEntry(meta, uid, ts),
  };
}

/**
 * Names, renames or (given `name: null`) un-names a room - creator only.
 * Moves the `roomsByName` entry in the same update: the new key is claimed
 * first-come-first-served, so a taken name makes the whole update fail.
 */
export function roomNameUpdate(opts: { code: string; name: string | null; key: string | null; previousKey: string | undefined }) {
  const { code, name, key, previousKey } = opts;
  const update: Record<string, unknown> = {
    [room(code, "meta/name")]: name && key ? name : null,
    [room(code, "meta/nameKey")]: name && key ? key : null,
  };
  if (previousKey && previousKey !== key) update[`roomsByName/${previousKey}`] = null;
  if (name && key && key !== previousKey) update[`roomsByName/${key}`] = code;
  return update;
}
