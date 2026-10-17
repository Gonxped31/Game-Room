"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Role } from "@/lib/session/types";
import { createPathStore, watchServerTimeOffset } from "@/lib/store";
import { GhostTrack, type LiveCar } from "./live";

/**
 * The server's clock, as a function: `Date.now()` corrected by Firebase's
 * measured offset. Both racers time the race off it, so their countdowns
 * start together however far apart their own clocks are. Only call it from
 * effects, timers and event handlers - never during render.
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

/**
 * The live-car channel (`games/{room}/nighthighwayCars/{seat}`, see ./live.ts):
 * `send` writes this player's car; `track` collects the other's samples for
 * their ghost.
 */
export function useLiveCars(room: string | null, me: Role | null, other: Role | null): { send: (car: LiveCar) => void; track: GhostTrack } {
  const [track] = useState(() => new GhostTrack());
  const mine = useMemo(() => (room && me ? createPathStore<LiveCar>(`games/${room}/nighthighwayCars/${me}`) : null), [room, me]);

  useEffect(() => {
    track.clear();
    if (!room || !other) return;
    const theirs = createPathStore<LiveCar>(`games/${room}/nighthighwayCars/${other}`);
    return theirs.subscribe(() => {
      const car = theirs.getSnapshot();
      if (car) track.push(car);
    });
  }, [room, other, track]);

  const send = useCallback((car: LiveCar) => mine?.set(car), [mine]);
  return { send, track };
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
