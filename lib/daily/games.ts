import { regionsDaily } from "@/lib/games/regions/daily";
import type { DailyGame } from "./types";

/** Every game with a daily puzzle, by slug. Adding one: write its DailyGame and list it here. */
export const DAILY_GAMES: Partial<Record<string, DailyGame>> = {
  regions: regionsDaily,
};
