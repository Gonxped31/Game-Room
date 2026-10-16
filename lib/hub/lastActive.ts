const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * How long ago a room was last active, as shown in the hub's "Your rooms" list:
 * "Just now", "12 min ago", "3 hours ago", "Yesterday", "3 days ago". Pure -
 * `now` is passed in (the hub reads the clock once, when it loads the list,
 * never during render).
 */
export function formatLastActive(activeAt: number, now: number): string {
  const elapsed = Math.max(0, now - activeAt);
  if (elapsed < MINUTE) return "Just now";
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min ago`;
  if (elapsed < DAY) {
    const hours = Math.floor(elapsed / HOUR);
    return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  }
  if (elapsed < 2 * DAY) return "Yesterday";
  return `${Math.floor(elapsed / DAY)} days ago`;
}
