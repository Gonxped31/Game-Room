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
  /** Unconditionally overwrites the stored value. */
  set(value: T): void;
  /**
   * Reads the current value, computes the next value, and writes it
   * atomically (per-backend guarantee). Return `undefined` from `updater`
   * to abort without writing - this is how invalid/duplicate state
   * transitions become no-ops instead of corrupting shared state.
   */
  transaction(updater: (current: T | null) => T | undefined): void;
}
