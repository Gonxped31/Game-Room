import { type FirebaseApp, type FirebaseOptions, getApp, getApps, initializeApp } from "firebase/app";
import { type Database, getDatabase, onValue, ref, runTransaction, set as firebaseSet } from "firebase/database";
import type { Store } from "./types";

// A room's game lives under this one path for the whole session, so reuse a
// single app/database instance across stores instead of re-initializing.
let cachedApp: FirebaseApp | undefined;
let cachedDb: Database | undefined;

function getSharedDatabase(config: FirebaseOptions): Database {
  cachedApp ??= getApps().length ? getApp() : initializeApp(config);
  cachedDb ??= getDatabase(cachedApp);
  return cachedDb;
}

/**
 * Firebase Realtime Database-backed Store (modular SDK). Construction does
 * no I/O (safe to call during SSR) - the app/database connection is only
 * opened lazily, client-side, the first time subscribe()/set()/transaction()
 * actually runs.
 */
export function createFirebaseStore<T>(path: string, config: FirebaseOptions): Store<T> {
  let cache: T | null = null;

  function getRef() {
    return ref(getSharedDatabase(config), path);
  }

  return {
    subscribe(onChange) {
      if (typeof window === "undefined") return () => {};
      const unsubscribe = onValue(getRef(), (snapshot) => {
        cache = (snapshot.val() as T | null) ?? null;
        onChange();
      });
      return unsubscribe;
    },
    getSnapshot() {
      return cache;
    },
    set(value) {
      // Firebase echoes writes back through the subscribed onValue listener
      // (optimistically, before the server ack), which updates `cache` and
      // notifies - no need to touch `cache` here directly.
      void firebaseSet(getRef(), value);
    },
    transaction(updater) {
      void runTransaction(getRef(), (current: T | null) => updater(current ?? null));
    },
  };
}
