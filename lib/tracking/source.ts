/**
 * Where a visitor came from (docs/tracking.md): the standard tags on an
 * incoming link, `utm_source`, `utm_medium`, `utm_campaign`, plus `ref`, a
 * short alias of utm_source. Pure: the browser side is lib/tracking/firstTouch.ts.
 */

/** A visit's source tags, sanitized. */
export interface SourceTags {
  src: string;
  med?: string;
  cmp?: string;
}

/** A link with no tag. */
export const DIRECT = "direct";

/** The query parameters read, then removed from the address bar. */
export const TAG_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "ref"] as const;

/** The longest tag kept (the rules refuse longer). */
export const MAX_TAG_LENGTH = 40;

/** Same pattern as the rules' (database.rules.json, users/$uid/firstTouch and finished/players). */
export const TAG_PATTERN = /^[a-z0-9._-]+$/;

/**
 * A tag as recorded: lowercase, runs of anything outside [a-z0-9._-] become
 * one "-", trimmed of "-" at the ends, at most 40 chars. Null when nothing is
 * left. Unknown sources are kept as they are, so a new channel needs no code.
 */
export function sanitizeTag(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const tag = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_TAG_LENGTH)
    .replace(/-+$/, "");
  return tag || null;
}

/** The tags in a query string ("?utm_source=tiktok&..."), or null when it has no source tag. */
export function parseSource(search: string): SourceTags | null {
  const params = new URLSearchParams(search);
  const src = sanitizeTag(params.get("utm_source")) ?? sanitizeTag(params.get("ref"));
  if (!src) return null;
  const med = sanitizeTag(params.get("utm_medium"));
  const cmp = sanitizeTag(params.get("utm_campaign"));
  return { src, ...(med ? { med } : {}), ...(cmp ? { cmp } : {}) };
}

/**
 * The address without its tags, keeping the path, any other parameters and
 * the #hash ("/same-page?utm_source=x&a=1#abc234" -> "/same-page?a=1#abc234"),
 * or null when it has none to remove.
 */
export function withoutTags(pathname: string, search: string, hash: string): string | null {
  const params = new URLSearchParams(search);
  if (!TAG_PARAMS.some((name) => params.has(name))) return null;
  TAG_PARAMS.forEach((name) => params.delete(name));
  const rest = params.toString();
  return `${pathname}${rest ? `?${rest}` : ""}${hash}`;
}
