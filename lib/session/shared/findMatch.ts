import { createPathStore, serverTimestamp, updateRoot, watchServerTimeOffset } from "@/lib/store";
import { seatIds } from "../types";
import { MAX_TRIES, type Queue, queuePath, rankRooms, staleRooms } from "./matchmaking";
import { canTakeOver, type RoomPresence } from "./presence";
import { createRoom } from "./roomActions";
import { claimSeatUpdate, queueRemoveUpdate, type RoomMeta, takeOverSeatUpdate } from "./updates";

/**
 * "Matchmaking": finds strangers to play with (docs/matchmaking.md). There's
 * no matchmaking server - every searching device reads the queue and races
 * for a seat, and the seat write itself is the lock: the rules refuse a seat
 * someone else got first, and the search simply moves on to the next room.
 */

/** What a matchmaking search needs to know about the game. Public games start in their lobby phase. */
export interface MatchGame {
  gameSlug: string;
  maxPlayers: number;
  /** The game state's `phase` before it starts - the only phase a stranger may join in. */
  lobbyPhase: string;
  /** Whether players pick a content language (separate EN/FR queues); without one, everyone waits in the `ANY_LANG` queue. */
  languages: boolean;
  /** A fresh public room's state: fixed default settings, already in the lobby. */
  publicState: (lang: string) => unknown;
}

/** One read of a whole room - small while it's in the lobby, and any signed-in guest may read it. */
interface RoomSnapshot {
  meta?: RoomMeta;
  seats?: Partial<Record<string, string>>;
  members?: Partial<Record<string, string>>;
  presence?: RoomPresence;
  [gameSlug: string]: unknown;
}

/** The server's clock, read once (Firebase's measured offset; the local clock in local mode). */
function serverNow(): Promise<number> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (offset: number) => {
      if (done) return;
      done = true;
      setTimeout(() => stop(), 0); // later: the first callback may come before `stop` is assigned
      resolve(Date.now() + offset);
    };
    const stop = watchServerTimeOffset(finish);
    setTimeout(() => finish(0), 2000);
  });
}

/**
 * Tries to take a seat in public room `code`: the first empty seat, else one
 * whose holder has been offline long enough to take over. True once seated
 * (or already seated there). False if the room isn't a joinable public room
 * of this game and language, or someone else got the seat first.
 */
export async function tryJoinRoom(opts: { code: string; uid: string; name: string; lang: string; game: MatchGame; now: number }): Promise<boolean> {
  const { code, uid, name, lang, game, now } = opts;
  const snapshot = await createPathStore<RoomSnapshot>(`games/${code}`).readOnce();
  const meta = snapshot?.meta;
  if (!snapshot || !meta || meta.gameSlug !== game.gameSlug || meta.publicLang !== lang) return false;
  if (snapshot.members?.[uid]) return true;
  if ((snapshot[game.gameSlug] as { phase?: string } | undefined)?.phase !== game.lobbyPhase) return false;
  const seats = snapshot.seats ?? {};
  const all = seatIds(meta.maxPlayers);
  const empty = all.find((seat) => !seats[seat]);
  const abandoned = all.find((seat) => canTakeOver(snapshot.presence ?? null, seats[seat], now));
  const holder = abandoned ? seats[abandoned] : undefined;
  let update: Record<string, unknown>;
  if (empty) update = claimSeatUpdate({ code, seat: empty, uid, name, meta, ts: serverTimestamp() });
  else if (abandoned && holder) update = takeOverSeatUpdate({ code, seat: abandoned, uid, oldUid: holder, mySeat: null, name, meta, ts: serverTimestamp() });
  else return false;
  try {
    await updateRoot(update);
    return true;
  } catch {
    return false; // someone else got there first
  }
}

/**
 * Seats this guest in a public room of `game` in `lang` and resolves to its
 * code: the fullest waiting room that will take it, or else a new public
 * room of its own, listed for the next searcher. Clears stale queue entries
 * on the way. Rejects only when the database can't be reached.
 */
export async function findMatch(opts: { uid: string; name: string; lang: string; game: MatchGame }): Promise<string> {
  const { uid, lang, game } = opts;
  const name = opts.name.trim().slice(0, 24);
  const now = await serverNow();
  const queue = await createPathStore<Queue>(queuePath(game.gameSlug, lang)).readOnce();

  for (const code of staleRooms(queue, now)) {
    updateRoot(queueRemoveUpdate({ code, gameSlug: game.gameSlug, lang })).catch(() => {});
  }

  for (const code of rankRooms(queue, { now, maxPlayers: game.maxPlayers }).slice(0, MAX_TRIES)) {
    if (await tryJoinRoom({ code, uid, name, lang, game, now })) return code;
  }

  // Listed from the moment it exists, so a searcher may sit down first: take whichever seat is free.
  const code = await createRoom({ uid, gameSlug: game.gameSlug, maxPlayers: game.maxPlayers, initialState: game.publicState(lang), publicLang: lang });
  if (await tryJoinRoom({ code, uid, name, lang, game, now })) return code;
  throw new Error("Couldn't take a seat in the new room.");
}
