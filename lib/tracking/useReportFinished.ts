"use client";

import { useEffect } from "react";
import { type FinishedGame, reportFinished } from "./finished";

/**
 * Reports `game` once it's non-null: pass null until the game reaches its real
 * end, then the finished game (lib/tracking/finished.ts). Re-renders with the
 * same game (same slug, room and id) don't report again.
 */
export function useReportFinished(game: FinishedGame | null): void {
  const key = game ? `${game.slug}:${game.room ?? ""}:${game.id}` : null;
  useEffect(() => {
    if (game) reportFinished(game);
    // One report per game: the key says which game it is.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
