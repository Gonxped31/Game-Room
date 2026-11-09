import type { Lang } from "@/lib/i18n/lang";
import { entryKey, FINISHED_GAMES, FINISHED_PLAYERS, finishedEntry, finishedHeader, gameKey } from "./events";

/**
 * "Game finished" events: the north-star metric, games finished per week
 * (docs/tracking.md). A game reports once when it reaches its REAL end (a
 * match result, a final score, the end of a race, a finished solo game).
 * Abandoned or unfinished games never report. Daily puzzles are recorded by
 * the server when the result is submitted (app/api/daily/), so daily pages
 * don't call this.
 *
 * Every seated player's device calls it; one finished game is still counted
 * once (the event is created once per key), and each player's device adds its
 * own participation, with that guest's first-touch source.
 */

/** room: a private room; match: a matchmade room; challenge/survival: a race (matchmade or not, see `matchmade`). */
export type FinishMode = "room" | "match" | "solo" | "daily" | "challenge" | "survival";

export interface FinishedGame {
  /** The data slug (`ftw`, `regions`, ...). */
  slug: string;
  mode: FinishMode;
  /**
   * Identifies this one game, the same on every player's device: for a room
   * game, something in the shared state that changes with each new match in
   * the room (a match number, its start time); for a solo game, an id made
   * once per game on this device. Letters, digits and "-" only, 1-40 chars.
   */
  id: string;
  /** A room game's code (the database checks the reporter is seated there). Omitted for solo games. */
  room?: string;
  /** Players who took part in this game. */
  players: number;
  /** The game's content language if it has one (Buzzer Quiz, Word Scramble, Same Page), else the interface language. */
  lang: Lang;
  /** A race (challenge/survival) filled by matchmaking. */
  matchmade?: boolean;
}

/** Games this device already reported (localStorage), so a reload or a re-render never posts twice. */
const REPORTED_KEY = "partyfox.finished";
const REPORTED_MAX = 300;
const reportedHere = new Set<string>();

/** Marks `key` reported; false when it already was. */
function claim(key: string): boolean {
  if (reportedHere.has(key)) return false;
  reportedHere.add(key);
  try {
    const list = JSON.parse(window.localStorage.getItem(REPORTED_KEY) ?? "[]") as unknown;
    const keys = Array.isArray(list) ? list.filter((k): k is string => typeof k === "string") : [];
    if (keys.includes(key)) return false;
    window.localStorage.setItem(REPORTED_KEY, JSON.stringify([...keys, key].slice(-REPORTED_MAX)));
  } catch {
    // Storage blocked: the in-memory set covers this page load, the rules the rest.
  }
  return true;
}

async function report(game: FinishedGame) {
  const [{ ensureGuestUid }, store, { localFirstTouch }] = await Promise.all([
    import("@/lib/session/shared/auth"),
    import("@/lib/store"),
    import("./firstTouch"),
  ]);
  // Local mode has no dashboard: nothing to record.
  if (!store.hasFirebaseConfig) return;
  const header = finishedHeader(game, store.serverTimestamp());
  if (!header) {
    if (process.env.NODE_ENV !== "production") console.warn("reportFinished: malformed report, not sent", game);
    return;
  }
  const uid = await ensureGuestUid();
  const key = gameKey(game.room ?? uid, game.id);
  if (!claim(key)) return;
  // Two writes, in order: the header is created once (another device's is
  // refused by the rules, which is fine), then this guest's own entry.
  await store.updateRoot({ [`${FINISHED_GAMES}/${key}`]: header }).catch(() => {});
  await store.updateRoot({ [`${FINISHED_PLAYERS}/${entryKey(key, uid)}`]: finishedEntry(key, uid, localFirstTouch(), store.serverTimestamp()) }).catch(() => {});
}

/**
 * Records a finished game: fire-and-forget, never throws, a no-op when the
 * same game was already reported from this device. Call it from an effect or
 * an event handler, never during render.
 */
export function reportFinished(game: FinishedGame): void {
  // Daily puzzles are recorded by the server (lib/daily/service.ts).
  if (typeof window === "undefined" || game.mode === "daily") return;
  void report(game).catch(() => {});
}
