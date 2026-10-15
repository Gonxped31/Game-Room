import type { Store } from "./types";

interface LocalStoreOptions {
  /**
   * Whether writes from OTHER tabs (the `storage` event) update this store.
   * Defaults to true - that's what makes local mode a usable multiplayer
   * stand-in for the shared game state. Set to false for values that are
   * meant to be per-tab, like which role this browser tab is playing: two
   * tabs in the same browser share localStorage, so without this a role
   * pick in one tab would silently reassign the other tab's role too.
   */
  crossTab?: boolean;
}

/**
 * localStorage-backed Store. Construction does no I/O (safe to call during
 * SSR) - reads only happen lazily, from getSnapshot()/transaction(), which
 * only ever run client-side via useSyncExternalStore after hydration.
 */
export function createLocalStore<T>(key: string, options: LocalStoreOptions = {}): Store<T> {
  const { crossTab = true } = options;
  let cache: T | null | undefined; // undefined = not read yet

  function readRaw(): T | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  function snapshot(): T | null {
    if (cache === undefined) cache = readRaw();
    return cache;
  }

  const listeners = new Set<() => void>();

  function write(value: T) {
    cache = value;
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // storage unavailable (private mode, quota) - cache still updates for this tab
      }
    }
    listeners.forEach((l) => l());
  }

  return {
    subscribe(onChange) {
      listeners.add(onChange);
      if (typeof window === "undefined" || !crossTab) return () => listeners.delete(onChange);
      const handler = (e: StorageEvent) => {
        if (e.key !== key) return;
        cache = readRaw();
        onChange();
      };
      window.addEventListener("storage", handler);
      return () => {
        listeners.delete(onChange);
        window.removeEventListener("storage", handler);
      };
    },
    getSnapshot: snapshot,
    async readOnce() {
      return readRaw();
    },
    set: write,
    async transaction(updater) {
      const next = updater(snapshot());
      if (next !== undefined) write(next);
      return next;
    },
  };
}
