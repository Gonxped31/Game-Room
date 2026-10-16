import type { Store } from "./types";

/**
 * The localStorage fallback (no Firebase config): the whole "database" is one
 * JSON tree under a single localStorage key, addressed by the same
 * slash-separated paths as Firebase (`games/{room}/seats/p1`, ...), so the
 * session layer builds identical multi-path updates for both backends.
 *
 * Mirrors the Realtime Database's data shape on write - `null`, empty
 * objects and empty arrays are dropped - so local mode surfaces the same
 * "missing key" cases Firebase does. There are no rules here: anything the
 * rules would deny (a taken seat, a taken room name) is pre-checked by the
 * session helpers instead.
 *
 * Syncs across tabs of one browser profile via the `storage` event - never
 * across browsers, profiles or devices.
 */
const KEY = "localdb";

type Tree = Record<string, unknown>;

let tree: Tree | undefined;
const listeners = new Set<() => void>();

function load(): Tree {
  if (tree) return tree;
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    tree = raw ? (JSON.parse(raw) as Tree) : {};
  } catch {
    tree = {};
  }
  return tree;
}

let listeningAcrossTabs = false;
function listenAcrossTabs() {
  if (listeningAcrossTabs || typeof window === "undefined") return;
  listeningAcrossTabs = true;
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    tree = undefined;
    listeners.forEach((l) => l());
  });
}

function segments(path: string): string[] {
  return path.split("/").filter(Boolean);
}

function getAt(root: unknown, path: string): unknown {
  let node = root;
  for (const s of segments(path)) {
    if (node == null || typeof node !== "object") return null;
    node = (node as Tree)[s];
  }
  return node ?? null;
}

/** Drops null/undefined, empty objects and empty arrays, like the Realtime Database does on write. */
function prune(value: unknown): unknown {
  if (value == null) return null;
  if (Array.isArray(value)) {
    const items = value.map(prune);
    return items.some((v) => v != null) ? items : null;
  }
  if (typeof value === "object") {
    const out: Tree = {};
    for (const [k, v] of Object.entries(value)) {
      const p = prune(v);
      if (p != null) out[k] = p;
    }
    return Object.keys(out).length ? out : null;
  }
  return value;
}

function setAt(root: Tree, path: string, value: unknown): Tree {
  const parts = segments(path);
  if (!parts.length) return (prune(value) as Tree) ?? {};
  const next: Tree = { ...root };
  let node: Tree = next;
  for (const s of parts.slice(0, -1)) {
    const child = node[s];
    node[s] = child && typeof child === "object" ? { ...(child as Tree) } : {};
    node = node[s] as Tree;
  }
  const leaf = parts[parts.length - 1];
  const pruned = prune(value);
  if (pruned == null) delete node[leaf];
  else node[leaf] = pruned;
  return (prune(next) as Tree) ?? {};
}

function commit(next: Tree) {
  tree = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // storage unavailable (private mode, quota) - this tab still sees the change
    }
  }
  listeners.forEach((l) => l());
}

export function localStore<T>(path: string): Store<T> {
  // A stable reference per distinct value, as useSyncExternalStore requires.
  let lastJson: string | undefined;
  let lastValue: T | null = null;
  function snapshot(): T | null {
    const value = getAt(load(), path);
    const json = JSON.stringify(value);
    if (json !== lastJson) {
      lastJson = json;
      lastValue = value == null ? null : (JSON.parse(json) as T);
    }
    return lastValue;
  }

  return {
    subscribe(onChange) {
      listenAcrossTabs();
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    getSnapshot: snapshot,
    async readOnce() {
      tree = undefined; // re-read, in case another tab wrote since
      return snapshot();
    },
    set(value) {
      commit(setAt(load(), path, value));
    },
    async transaction(updater) {
      const next = updater(snapshot());
      if (next === undefined) return undefined;
      commit(setAt(load(), path, next));
      return (getAt(load(), path) as T | null) ?? undefined;
    },
  };
}

export async function localUpdateRoot(values: Record<string, unknown>): Promise<void> {
  let next = load();
  for (const [path, value] of Object.entries(values)) next = setAt(next, path, value);
  commit(next);
}

/**
 * Local mode's stand-in for `onDisconnect`: the write happens when this tab
 * is closed or navigated away (`pagehide`), best-effort - a crashed tab never
 * gets there, which is fine for a dev-only fallback.
 */
export async function localSetOnDisconnect(path: string, value: unknown): Promise<() => Promise<void>> {
  const handler = () => {
    void localUpdateRoot({ [path]: value });
  };
  window.addEventListener("pagehide", handler);
  return async () => window.removeEventListener("pagehide", handler);
}
