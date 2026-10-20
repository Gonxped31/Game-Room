"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { watchServerTimeOffset } from "@/lib/store";

/**
 * The server's clock, as a function: `Date.now()` corrected by Firebase's
 * measured offset. Two devices that start something at a server time (a
 * race, a co-op run) start together however far apart their own clocks are.
 * Only call it from effects, timers and event handlers - never during render.
 */
export function useServerClock(): () => number {
  const [clock] = useState(() => ({ offset: 0 }));
  useEffect(
    () =>
      watchServerTimeOffset((offset) => {
        clock.offset = offset;
      }),
    [clock],
  );
  return useCallback(() => Date.now() + clock.offset, [clock]);
}

/** How often `useDeadline` retries a due step that hasn't moved the game on. */
const RETRY_MS = 2000;

/**
 * Calls `onDue` when the server clock reaches `deadline` (right away if it
 * has already passed), retrying while that deadline stays current. `onDue` should
 * transact an idempotent step (see lib/session/shared/deadline.ts): every
 * device runs this, and only the first commit changes anything.
 */
export function useDeadline(deadline: number | undefined, now: () => number, onDue: () => void): void {
  const latest = useRef(onDue);
  useEffect(() => {
    latest.current = onDue;
  });
  useEffect(() => {
    if (deadline == null) return;
    // Waits in steps of at most 1 s, since the clock's offset can move while
    // waiting. Once due, it retries every 2 s until the game moves on (a new
    // deadline, or none, re-runs this effect), in case a commit didn't land.
    let id: ReturnType<typeof setTimeout>;
    const wait = () => {
      const left = deadline - now();
      if (left > 0) {
        id = setTimeout(wait, Math.min(left, 1000));
        return;
      }
      latest.current();
      id = setTimeout(wait, RETRY_MS);
    };
    id = setTimeout(wait, 0);
    return () => clearTimeout(id);
  }, [deadline, now]);
}

/** A clock that re-renders every `intervalMs` while `active`, for countdown text. Null until the first tick (never read the clock in render). */
export function useTicker(active: boolean, now: () => number, intervalMs = 250): number | null {
  const [tick, setTick] = useState<number | null>(null);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick(now()), intervalMs);
    const first = setTimeout(() => setTick(now()), 0);
    return () => {
      clearInterval(id);
      clearTimeout(first);
    };
  }, [active, now, intervalMs]);
  return tick;
}
