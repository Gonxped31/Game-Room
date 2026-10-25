import { createPathStore, isLocalMode, serverTimestamp, updateRoot } from "@/lib/store";
import { generateRoomCode } from "../room";
import { createRoomUpdate, nameKey, room, roomNameUpdate, type RoomMeta } from "./updates";

const MAX_CREATE_ATTEMPTS = 5;

/**
 * Creates a room and returns its code. With no `code`, generates one and
 * retries up to 5 times if it collides with an existing room (the rules
 * refuse to overwrite an existing `meta`). With a `code` - a link to a room
 * that doesn't exist yet - tries just that one. `publicLang` makes it a
 * public room, listed in that language's matchmaking queue.
 */
export async function createRoom(opts: { uid: string; gameSlug: string; maxPlayers: number; initialState: unknown; code?: string; publicLang?: string }): Promise<string> {
  const { uid, gameSlug, maxPlayers, initialState, code, publicLang } = opts;
  const attempts = code ? 1 : MAX_CREATE_ATTEMPTS;
  for (let i = 0; i < attempts; i++) {
    const candidate = code ?? generateRoomCode();
    // No rules in local mode to refuse an overwrite - check first instead.
    if (isLocalMode && (await readRoomMeta(candidate))) continue;
    try {
      await updateRoot(createRoomUpdate({ code: candidate, uid, gameSlug, maxPlayers, initialState, ts: serverTimestamp(), publicLang }));
      return candidate;
    } catch {
      // taken (or an invalid code) - try another
    }
  }
  throw new Error("Couldn't create a room.");
}

/**
 * One-off lookup of a room's meta - which game it belongs to, its name -
 * independent of whichever room (if any) the current page is subscribed to.
 * Null for a room that doesn't exist, or a code the rules refuse to read.
 */
export function readRoomMeta(code: string): Promise<RoomMeta | null> {
  if (!/^[a-z0-9]{1,12}$/.test(code)) return Promise.resolve(null); // not a path we can even address
  return createPathStore<RoomMeta>(room(code, "meta")).readOnce();
}

/**
 * The room registered under a name (room names are unique, first come first
 * served), or null. Reads the single `roomsByName/{nameKey}` entry - the
 * rules never allow listing the index - then that room's meta, so a stale
 * entry for a room that's gone reads as "not found".
 */
export async function findRoomByName(name: string): Promise<{ room: string; meta: RoomMeta } | null> {
  const key = nameKey(name);
  if (!key) return null;
  const code = await createPathStore<string>(`roomsByName/${key}`).readOnce();
  if (!code) return null;
  const meta = await readRoomMeta(code);
  return meta ? { room: code, meta } : null;
}

/** Shown on a game page whose #code doesn't lead to a room of that game. */
export const ROOM_MISSING_MESSAGE = "We can't find that room. Check the link, or go back and start a new one.";

/** Asked before "Leave room" in a private room while a game is under way. */
export const LEAVE_CONFIRM = "Leave this room? Your seat goes to whoever joins next.";

/**
 * "Leave room" in a private room: asks first when `confirmText` is given, gives
 * up the seat (`leave`, which also drops the room from "Your rooms"), then goes
 * to the hub - even if the write failed, since the player asked to go. Public
 * rooms use `usePublicRoom`'s `leave`, which also unlists the room.
 */
export async function leaveToHub(leave: () => Promise<void>, confirmText?: string): Promise<void> {
  if (confirmText && !window.confirm(confirmText)) return;
  await leave().catch(() => {});
  window.location.href = "/";
}

export const NAME_TAKEN_MESSAGE = "That name is taken. Try another.";
export const NAME_TOO_SHORT_MESSAGE = "Use at least 3 letters or numbers.";

/**
 * Names, renames or (given an empty name) un-names a room. Resolves to an
 * error message to show, or null on success. Only the creator may do this -
 * the rules refuse anyone else.
 */
export async function renameRoom(code: string, meta: RoomMeta, rawName: string): Promise<string | null> {
  const name = rawName.trim().slice(0, 40);
  const key = name ? nameKey(name) : null;
  if (name && !key) return NAME_TOO_SHORT_MESSAGE;
  if (isLocalMode && key && key !== meta.nameKey) {
    const holder = await createPathStore<string>(`roomsByName/${key}`).readOnce();
    if (holder && holder !== code) return NAME_TAKEN_MESSAGE;
  }
  try {
    await updateRoot(roomNameUpdate({ code, name: name || null, key, previousKey: meta.nameKey }));
    return null;
  } catch {
    return NAME_TAKEN_MESSAGE;
  }
}
