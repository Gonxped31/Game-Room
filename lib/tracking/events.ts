import { isLang, type Lang } from "@/lib/i18n/lang";
import { DIRECT, TAG_PATTERN, MAX_TAG_LENGTH, type SourceTags } from "./source";

/**
 * The "game finished" records (docs/tracking.md), shared by the browser
 * (finished.ts) and the daily routes (lib/daily/service.ts). Pure.
 *
 * finished/games/{gameKey}            FinishedHeader: one per game, created once
 * finished/players/{gameKey}_{uid}    FinishedEntry: one per finishing guest, written by that guest
 * users/{uid}/firstTouch              FirstTouch: the guest's first source, written once
 *
 * gameKey: `{room}_{id}` for a room game, `{uid}_{id}` for a solo or daily
 * one. Room codes, uids and ids never contain "_", so a key reads one way.
 */

export const FINISHED_GAMES = "finished/games";
export const FINISHED_PLAYERS = "finished/players";
export const FINISHED_ROOT = "finished";
export const firstTouchPath = (uid: string) => `users/${uid}/firstTouch`;

export type RecordedMode = "room" | "match" | "solo" | "daily" | "challenge" | "survival";
export const MODES: readonly RecordedMode[] = ["room", "match", "solo", "daily", "challenge", "survival"];

/** `at` is the server's time: a server-timestamp placeholder when written, a number when read. */
export interface FinishedHeader<T = number> {
  slug: string;
  mode: RecordedMode;
  players: number;
  lang: Lang;
  at: T;
  room?: string;
  matchmade?: true;
}

export interface FinishedEntry<T = number> {
  game: string;
  uid: string;
  src: string;
  cmp?: string;
  at: T;
}

export interface FirstTouch<T = number> extends SourceTags {
  at: T;
}

const ID = /^[A-Za-z0-9-]+$/;
const SLUG = /^[a-z0-9]+$/;
const ROOM = /^[a-hjkmnp-z1-9]{6}$/;
export const MAX_ID_LENGTH = 40;
export const MAX_PLAYERS = 8;

export const isGameId = (id: unknown): id is string => typeof id === "string" && id.length >= 1 && id.length <= MAX_ID_LENGTH && ID.test(id);
export const isRoomCode = (code: unknown): code is string => typeof code === "string" && ROOM.test(code);
const isTag = (tag: unknown): tag is string => typeof tag === "string" && tag.length <= MAX_TAG_LENGTH && TAG_PATTERN.test(tag);

/** The game's key: `{room}_{id}` for a room game, `{uid}_{id}` otherwise. */
export const gameKey = (owner: string, id: string) => `${owner}_${id}`;
/** A participation's key. */
export const entryKey = (game: string, uid: string) => `${game}_${uid}`;

/** What a finished game reports (lib/tracking/finished.ts's FinishedGame, plus the daily's own). */
export interface FinishedInput {
  slug: string;
  mode: RecordedMode;
  id: string;
  room?: string;
  players: number;
  lang: Lang;
  matchmade?: boolean;
}

/**
 * The header for a finished game, or null when the report is malformed (the
 * rules would refuse it): a room game needs a room code, a solo or daily
 * one must have none.
 */
export function finishedHeader<T>(game: FinishedInput, at: T): FinishedHeader<T> | null {
  const solo = game.mode === "solo" || game.mode === "daily";
  if (!SLUG.test(game.slug) || game.slug.length > 24 || !MODES.includes(game.mode) || !isGameId(game.id) || !isLang(game.lang)) return null;
  if (!Number.isInteger(game.players) || game.players < 1 || game.players > MAX_PLAYERS) return null;
  if (solo ? game.room != null : !isRoomCode(game.room)) return null;
  return {
    slug: game.slug,
    mode: game.mode,
    players: game.players,
    lang: game.lang,
    at,
    ...(solo ? {} : { room: game.room }),
    ...(game.matchmade ? { matchmade: true as const } : {}),
  };
}

/** A guest's participation, carrying their first-touch source (direct when unknown). */
export function finishedEntry<T>(game: string, uid: string, touch: SourceTags | null, at: T): FinishedEntry<T> {
  const src = touch && isTag(touch.src) ? touch.src : DIRECT;
  const cmp = touch && isTag(touch.cmp) ? touch.cmp : undefined;
  return { game, uid, src, ...(cmp ? { cmp } : {}), at };
}

/** A stored first touch, or null when malformed. */
export function readFirstTouch(raw: unknown): FirstTouch | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (!isTag(value.src) || typeof value.at !== "number" || !Number.isFinite(value.at)) return null;
  return { src: value.src, ...(isTag(value.med) ? { med: value.med } : {}), ...(isTag(value.cmp) ? { cmp: value.cmp } : {}), at: value.at };
}
