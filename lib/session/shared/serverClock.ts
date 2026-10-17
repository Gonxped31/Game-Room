"use client";

import { useCallback, useEffect, useState } from "react";
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
