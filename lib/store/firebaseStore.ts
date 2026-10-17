import { get, onDisconnect, onValue, ref, runTransaction, serverTimestamp, set as firebaseSet, update } from "firebase/database";
import { getFirebaseDatabase } from "./firebaseApp";
import type { Store } from "./types";

/**
 * Firebase Realtime Database-backed Store (modular SDK) for one path.
 * Construction does no I/O (safe to call during SSR) - the connection is only
 * opened lazily, client-side, the first time subscribe()/set()/transaction()
 * actually runs. Callers must only subscribe once the guest is signed in:
 * a listener the rules deny is cancelled for good, not retried.
 */
export function createFirebaseStore<T>(path: string): Store<T> {
  let cache: T | null = null;

  function getRef() {
    return ref(getFirebaseDatabase(), path);
  }

  return {
    subscribe(onChange) {
      if (typeof window === "undefined") return () => {};
      return onValue(
        getRef(),
        (snapshot) => {
          cache = (snapshot.val() as T | null) ?? null;
          onChange();
        },
        () => {
          // Denied by the rules (e.g. a malformed room code) - read as "nothing here".
          cache = null;
          onChange();
        },
      );
    },
    getSnapshot() {
      return cache;
    },
    set(value) {
      // Firebase echoes writes back through the subscribed onValue listener
      // (optimistically, before the server ack), which updates `cache` and
      // notifies - no need to touch `cache` here directly. A denied write is
      // rolled back the same way, so there's nothing to do on failure.
      firebaseSet(getRef(), value).catch(() => {});
    },
    async readOnce() {
      try {
        const snapshot = await get(getRef());
        return (snapshot.val() as T | null) ?? null;
      } catch (error) {
        // A read the rules deny looks like missing data to callers; anything
        // else (offline, a network error) is NOT "missing" and is rethrown, so
        // callers never act on a room's absence they didn't actually observe.
        if (/permission/i.test(String((error as Error)?.message ?? error))) return null;
        throw error;
      }
    },
    async transaction(updater) {
      // Firebase may invoke this speculatively with `null` even when real
      // data exists on the server, if this ref's own internal transaction
      // cache hasn't warmed up yet - a separate thing from the `onValue`
      // subscription above, which can already have delivered real data to
      // `cache` (and to the UI) by this point. Falling back to our own
      // already-warm `cache` avoids treating that as "no data, abort": if
      // the fallback turns out to be stale, Firebase's normal optimistic-
      // concurrency retry re-invokes this with the real server value anyway.
      try {
        const result = await runTransaction(getRef(), (current: T | null) => updater(current ?? cache));
        if (!result.committed) return undefined;
        return (result.snapshot.val() as T | null) ?? undefined;
      } catch {
        return undefined; // denied by the rules - same as an aborted transition
      }
    },
  };
}

/** One multi-path update from the database root - all paths land together or none do. Rejects when the rules deny it. */
export function firebaseUpdateRoot(values: Record<string, unknown>): Promise<void> {
  return update(ref(getFirebaseDatabase()), values);
}

export function firebaseServerTimestamp(): object {
  return serverTimestamp();
}

/** Calls back with true/false every time the connection to the database comes up or drops. */
export function firebaseWatchConnection(onChange: (connected: boolean) => void): () => void {
  return onValue(ref(getFirebaseDatabase(), ".info/connected"), (snapshot) => onChange(snapshot.val() === true));
}

/** Calls back with this client's estimated offset (ms) from the server's clock, whenever Firebase refines it. */
export function firebaseWatchServerTimeOffset(onChange: (offsetMs: number) => void): () => void {
  return onValue(ref(getFirebaseDatabase(), ".info/serverTimeOffset"), (snapshot) => onChange(Number(snapshot.val()) || 0));
}

/** Has the server write `value` at `path` if this client disconnects. Returns a function that cancels it. */
export async function firebaseSetOnDisconnect(path: string, value: unknown): Promise<() => Promise<void>> {
  const handle = onDisconnect(ref(getFirebaseDatabase(), path));
  await handle.set(value);
  return () => handle.cancel();
}
