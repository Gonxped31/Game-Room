import { type Lang, langOfPath, localizePath } from "@/lib/i18n/lang";
import { texts } from "@/lib/i18n/text";
import { createPathStore, isLocalMode, serverTimestamp, updateRoot } from "@/lib/store";
import { generateRoomCode } from "../room";
import { CONNECTION_ERROR_TEXT } from "./auth";
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

/** A question a room asks before an action, in the app's own dialog (`components/RoomDialog`), never the browser's confirm(). */
export interface RoomQuestion {
  title: string;
  message: string;
  /** The safe choice; the dialog opens on it. */
  cancelLabel: string;
  confirmLabel: string;
  /** Shown on the confirm button while the action runs. */
  busyLabel: string;
}

/**
 * Every room's shared words, in both languages (docs/i18n.md). Pages read
 * `ROOM_TEXT[lang]` (lang from `useLang()`); the English-only exports below
 * stay for callers not yet passing a language.
 */
export const ROOM_TEXT = texts({
  en: {
    /** Shown on a game page whose #code doesn't lead to a room of that game. */
    missing: "We can't find that room. Check the link, or go back and start a new one.",
    /** Shown on a game page whose room was closed from /admin (`closedAt` is set): it can be read, never changed. */
    closed: "This room was closed. Go back to start a new one.",
    nameTaken: "That name is taken. Try another.",
    nameTooShort: "Use at least 3 letters or numbers.",
    /** Asked before "Leave room" in a private room while a game is under way. */
    leaveConfirm: {
      title: "Leave this room?",
      message: "Your seat goes to whoever joins next.",
      cancelLabel: "Stay",
      confirmLabel: "Leave room",
      busyLabel: "Leaving…",
    } as RoomQuestion,
    /** Asked before "New room": it leaves this room (`newRoom` gives up the seat first). */
    newRoomConfirm: {
      title: "Start a new room?",
      message: "You'll leave this one: your seat goes to whoever joins next.",
      cancelLabel: "Stay",
      confirmLabel: "New room",
      busyLabel: "Starting…",
    } as RoomQuestion,
  },
  fr: {
    missing: "Impossible de trouver ce salon. Vérifie le lien, ou reviens en arrière pour en créer un nouveau.",
    closed: "Ce salon a été fermé. Reviens en arrière pour en créer un nouveau.",
    nameTaken: "Ce nom est déjà pris. Essaie-en un autre.",
    nameTooShort: "Utilise au moins 3 lettres ou chiffres.",
    leaveConfirm: {
      title: "Quitter ce salon ?",
      message: "Ta place ira à la prochaine personne qui arrive.",
      cancelLabel: "Rester",
      confirmLabel: "Quitter le salon",
      busyLabel: "Départ…",
    },
    newRoomConfirm: {
      title: "Créer un nouveau salon ?",
      message: "Tu quitteras celui-ci : ta place ira à la prochaine personne qui arrive.",
      cancelLabel: "Rester",
      confirmLabel: "Nouveau salon",
      busyLabel: "Création…",
    },
  },
});

export const ROOM_MISSING_MESSAGE = ROOM_TEXT.en.missing;
export const ROOM_CLOSED_MESSAGE = ROOM_TEXT.en.closed;
export const LEAVE_CONFIRM: RoomQuestion = ROOM_TEXT.en.leaveConfirm;
export const NEW_ROOM_CONFIRM: RoomQuestion = ROOM_TEXT.en.newRoomConfirm;
export const NAME_TAKEN_MESSAGE = ROOM_TEXT.en.nameTaken;
export const NAME_TOO_SHORT_MESSAGE = ROOM_TEXT.en.nameTooShort;

/**
 * "Leave room" in a private room: gives up the seat (`leave`, which also drops
 * the room from "Your rooms"), then goes to the hub, in the page's language -
 * even if the write failed, since the player asked to go. Where leaving ends a
 * game, pages ask first (`ROOM_TEXT[lang].leaveConfirm`). Public rooms use
 * `usePublicRoom`'s `leave`, which also unlists the room.
 */
export async function leaveToHub(leave: () => Promise<void>): Promise<void> {
  await leave().catch(() => {});
  window.location.href = localizePath("/", langOfPath(window.location.pathname));
}

/** The message a game page shows instead of the game, or null when the room is usable. */
export function roomProblemMessage(session: { connectionError: boolean; roomMissing: boolean; roomClosed: boolean }, lang: Lang = "en"): string | null {
  if (session.connectionError) return CONNECTION_ERROR_TEXT[lang];
  if (session.roomClosed) return ROOM_TEXT[lang].closed;
  if (session.roomMissing) return ROOM_TEXT[lang].missing;
  return null;
}

/**
 * Names, renames or (given an empty name) un-names a room. Resolves to an
 * error message to show (in `lang`), or null on success. Only the creator may
 * do this - the rules refuse anyone else.
 */
export async function renameRoom(code: string, meta: RoomMeta, rawName: string, lang: Lang = "en"): Promise<string | null> {
  const name = rawName.trim().slice(0, 40);
  const key = name ? nameKey(name) : null;
  if (name && !key) return ROOM_TEXT[lang].nameTooShort;
  if (isLocalMode && key && key !== meta.nameKey) {
    const holder = await createPathStore<string>(`roomsByName/${key}`).readOnce();
    if (holder && holder !== code) return ROOM_TEXT[lang].nameTaken;
  }
  try {
    await updateRoot(roomNameUpdate({ code, name: name || null, key, previousKey: meta.nameKey }));
    return null;
  } catch {
    return ROOM_TEXT[lang].nameTaken;
  }
}
