"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Role } from "@/lib/session/types";
import { createPathStore } from "@/lib/store";
import { GhostTrack, type LiveCar } from "./live";

// The server clock and the ticker are shared session tools now (Buzzer Quiz uses them too).
export { useServerClock, useTicker } from "@/lib/session/shared/serverClock";

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
