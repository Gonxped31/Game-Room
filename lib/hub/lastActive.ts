import type { Lang } from "@/lib/i18n/lang";
import { LOCALES } from "@/lib/i18n/text";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

let frenchFormats: { short: Intl.RelativeTimeFormat; long: Intl.RelativeTimeFormat } | null = null;

/** "à l'instant", "il y a 12 min", "il y a 3 heures", "hier", "il y a 3 jours". */
function frenchLastActive(elapsed: number): string {
  if (elapsed < MINUTE) return "à l'instant";
  frenchFormats ??= {
    short: new Intl.RelativeTimeFormat(LOCALES.fr, { numeric: "always", style: "short" }),
    long: new Intl.RelativeTimeFormat(LOCALES.fr, { numeric: "always" }),
  };
  if (elapsed < HOUR) return frenchFormats.short.format(-Math.floor(elapsed / MINUTE), "minute");
  if (elapsed < DAY) return frenchFormats.long.format(-Math.floor(elapsed / HOUR), "hour");
  if (elapsed < 2 * DAY) return "hier";
  return frenchFormats.long.format(-Math.floor(elapsed / DAY), "day");
}

/**
 * How long ago a room was last active, as shown in the hub's "Your rooms" list:
 * "Just now", "12 min ago", "3 hours ago", "Yesterday", "3 days ago" (French:
 * "à l'instant", "il y a 12 min"..., through Intl.RelativeTimeFormat). Pure -
 * `now` is passed in (the hub reads the clock once, when it loads the list,
 * never during render).
 */
export function formatLastActive(activeAt: number, now: number, lang: Lang = "en"): string {
  const elapsed = Math.max(0, now - activeAt);
  if (lang === "fr") return frenchLastActive(elapsed);
  if (elapsed < MINUTE) return "Just now";
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min ago`;
  if (elapsed < DAY) {
    const hours = Math.floor(elapsed / HOUR);
    return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  }
  if (elapsed < 2 * DAY) return "Yesterday";
  return `${Math.floor(elapsed / DAY)} days ago`;
}
