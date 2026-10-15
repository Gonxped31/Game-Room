/**
 * Backend-agnostic store so the UI never knows whether it's talking to
 * localStorage or Firebase. Shaped to drop straight into React's
 * useSyncExternalStore: subscribe(onChange) + getSnapshot().
 */
export interface Store<T> {
  /** Registers a listener for external changes; returns an unsubscribe function. */
  subscribe(onChange: () => void): () => void;
  /** Synchronously returns the current cached value, or null if nothing is stored yet. */
  getSnapshot(): T | null;
  /**
   * Reads the current value directly from the backend, independent of
   * subscribe()/getSnapshot()'s cache - for a one-off lookup of a room this
   * component isn't otherwise subscribed to (e.g. "join a room by code" on
   * the picker page), where there's no live subscription to read a cache
   * from in the first place.
   */
  readOnce(): Promise<T | null>;
  /** Unconditionally overwrites the stored value. */
  set(value: T): void;
  /**
   * Reads the current value, computes the next value, and writes it
   * atomically (per-backend guarantee). Return `undefined` from `updater`
   * to abort without writing - this is how invalid/duplicate state
   * transitions become no-ops instead of corrupting shared state.
   *
   * Resolves to the value that was actually written, or `undefined` if the
   * transaction aborted - most callers fire-and-forget this (ignoring the
   * returned promise is fine), but it matters whenever a caller needs to
   * know whether ITS specific attempt won a race against a concurrent one
   * (e.g. two devices claiming the same seat at nearly the same moment -
   * see useGameSession's `pickIdentity`), rather than just trusting the
   * store's own snapshot to eventually reflect whatever won.
   */
  transaction(updater: (current: T | null) => T | undefined): Promise<T | undefined>;
}
