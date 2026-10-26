/**
 * The daily puzzle's calendar: one day for everyone, changing at midnight in
 * one fixed time zone, so a player in Paris and one in Montreal play the same
 * puzzle at the same moment. Days are `YYYY-MM-DD` strings.
 */
export const DAILY_TIME_ZONE = "America/Toronto";

/** Daily #1: the day the daily puzzle first went live (move it to the launch day if that changes). */
export const DAILY_EPOCH = "2026-10-25";

const DAY_MS = 86_400_000;
const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: DAILY_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });

/** The daily day at time `ms`. */
export function dayKey(ms: number): string {
  return formatter.format(new Date(ms));
}

const utcNoon = (day: string) => Date.parse(`${day}T12:00:00Z`);

export const isDay = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(utcNoon(value));

/** The puzzle's number: #1 on DAILY_EPOCH. */
export function dayNumber(day: string): number {
  return Math.round((utcNoon(day) - utcNoon(DAILY_EPOCH)) / DAY_MS) + 1;
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayOf(day: string): number {
  return (new Date(utcNoon(day)).getUTCDay() + 6) % 7;
}

export function previousDay(day: string): string {
  return new Date(utcNoon(day) - DAY_MS).toISOString().slice(0, 10);
}

/** Milliseconds from `ms` until the next day begins (a binary search, so daylight saving needs no special case). */
export function msUntilNextDay(ms: number): number {
  const today = dayKey(ms);
  let low = ms;
  let high = ms + 26 * 3_600_000;
  while (high - low > 1000) {
    const mid = Math.floor((low + high) / 2);
    if (dayKey(mid) === today) low = mid;
    else high = mid;
  }
  return high - ms;
}
