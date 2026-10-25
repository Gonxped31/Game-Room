import type { Rate } from "./types";

const MIN_MS = 60 * 1000;
const HOUR_MS = 60 * MIN_MS;
const DAY_MS = 24 * HOUR_MS;

/** "0 min", "42 min", "3 h 05 min", "2 d 4 h". */
export function formatDuration(ms: number): string {
  if (ms < HOUR_MS) return `${Math.round(ms / MIN_MS)} min`;
  if (ms < DAY_MS) {
    const totalMin = Math.round(ms / MIN_MS);
    return `${Math.floor(totalMin / 60)} h ${String(totalMin % 60).padStart(2, "0")} min`;
  }
  const totalHours = Math.round(ms / HOUR_MS);
  return `${Math.floor(totalHours / 24)} d ${totalHours % 24} h`;
}

/** "33%", or an em dash while nobody qualifies. */
export function formatRate(rate: Rate): string {
  return rate.rate == null ? "—" : `${Math.round(rate.rate * 100)}%`;
}

/** 1,284 / 12.9K / 4.2M - auto-compact for stat tiles. */
export function formatCount(n: number): string {
  if (n < 10_000) return n.toLocaleString("en-US");
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 100_000 ? 1 : 0)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}
