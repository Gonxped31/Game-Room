import { hasFirebaseConfig } from "./config";
import {
  createFirebaseStore,
  firebaseServerTimestamp,
  firebaseSetOnDisconnect,
  firebaseUpdateRoot,
  firebaseWatchConnection,
} from "./firebaseStore";
import { localSetOnDisconnect, localStore, localUpdateRoot } from "./localDb";
import type { Store } from "./types";

/**
 * Backend-agnostic access to the shared database: Firebase when all
 * NEXT_PUBLIC_FIREBASE_* env vars are set, otherwise the localStorage
 * fallback (lib/store/localDb.ts). Both are addressed by the same
 * slash-separated paths, so nothing above this layer knows which is active.
 *
 * Paths follow database.rules.json - e.g. `games/{room}/meta`,
 * `games/{room}/{gameSlug}`, `roomsByName/{nameKey}`,
 * `users/{uid}/rooms/{room}`. The rules only allow writes at the specific
 * child paths they name, never a whole room, so a write spanning several of
 * them goes through `updateRoot`.
 */
export function createPathStore<T>(path: string): Store<T> {
  return hasFirebaseConfig ? createFirebaseStore<T>(path) : localStore<T>(path);
}

/** A game's own state in a room: `games/{room}/{gameSlug}`. */
export function createGameStore<T>(room: string, gameSlug: string): Store<T> {
  return createPathStore<T>(`games/${room}/${gameSlug}`);
}

/**
 * One multi-path update from the database root (`{ "games/abc234/seats/p1":
 * uid, ... }`): every path lands, or none do. Rejects when Firebase's rules
 * deny it - e.g. a seat someone else claimed first.
 */
export function updateRoot(values: Record<string, unknown>): Promise<void> {
  return hasFirebaseConfig ? firebaseUpdateRoot(values) : localUpdateRoot(values);
}

/** The server's clock on Firebase (required by the rules' `<= now` checks); the local clock in local mode. */
export function serverTimestamp(): unknown {
  return hasFirebaseConfig ? firebaseServerTimestamp() : Date.now();
}

/** Calls back each time the database connection comes up (true) or drops (false). Local mode is always connected. */
export function watchConnection(onChange: (connected: boolean) => void): () => void {
  if (hasFirebaseConfig) return firebaseWatchConnection(onChange);
  const id = setTimeout(() => onChange(true), 0);
  return () => clearTimeout(id);
}

/** Registers a write to happen when this client disconnects; resolves to a function that cancels it. */
export function setOnDisconnect(path: string, value: unknown): Promise<() => Promise<void>> {
  return hasFirebaseConfig ? firebaseSetOnDisconnect(path, value) : localSetOnDisconnect(path, value);
}

/** A store for "no room yet" (still signing in, or no #code) - always empty, never touches a backend. */
export function emptyStore<T>(): Store<T> {
  return {
    subscribe: () => () => {},
    getSnapshot: () => null,
    readOnce: async () => null,
    set: () => {},
    transaction: async () => undefined,
  };
}

export { isLocalMode, hasFirebaseConfig } from "./config";
export type { Store } from "./types";
