import type { Lang } from "@/lib/games/shared/language";
import data from "./countries.json";

/**
 * Every country on the map (scripts/borderrun-data.mjs builds countries.json
 * from Natural Earth and the ISO tables): its EN and FR names, the other
 * names people type, its land borders, and its capital (every country with a
 * border has one), by ISO 3166 alpha-2 code (French Guiana is GF, Kosovo XK).
 */
export interface Country {
  en: string;
  fr: string;
  aliases: string[];
  borders: string[];
  /** [lon, lat] */
  capital?: { en: string; fr: string; at: number[] };
}

export const COUNTRIES: Readonly<Record<string, Country>> = data;
export const CODES: readonly string[] = Object.keys(COUNTRIES);

export const isCountry = (code: unknown): code is string => typeof code === "string" && Object.hasOwn(COUNTRIES, code);

export const nameOf = (code: string, lang: Lang) => COUNTRIES[code][lang];

const EARTH_RADIUS_KM = 6371;

/** Capital to capital, as the crow flies (great circle), in km rounded to 10; null if either has no capital. */
export function capitalDistanceKm(a: string, b: string): number | null {
  const from = COUNTRIES[a].capital?.at;
  const to = COUNTRIES[b].capital?.at;
  if (!from || !to) return null;
  const rad = Math.PI / 180;
  const [lon1, lat1] = [from[0] * rad, from[1] * rad];
  const [lon2, lat2] = [to[0] * rad, to[1] * rad];
  const h = Math.sin((lat2 - lat1) / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2;
  return Math.round((2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))) / 10) * 10;
}

/** A name as compared: no accents, no case, words split on anything but letters and digits. */
export function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const ARTICLES = /^(the|le|la|les|l) /;

/** Every folded name, alias and article-less form → its country. */
const BY_NAME = new Map<string, string>();
for (const code of CODES) {
  const { en, fr, aliases } = COUNTRIES[code];
  for (const name of [en, fr, ...aliases]) {
    const key = fold(name);
    BY_NAME.set(key, code);
    BY_NAME.set(key.replace(ARTICLES, ""), code);
  }
}

/** The country a typed name means, in English or French, or null. */
export function findCountry(text: string): string | null {
  const key = fold(text);
  if (!key) return null;
  return BY_NAME.get(key) ?? BY_NAME.get(key.replace(ARTICLES, "")) ?? null;
}

/**
 * Autocomplete: the countries among `codes` whose name (in either language,
 * or an alias) starts with what's typed, or has a word that does. An exact
 * name comes first, then names starting with it, then alphabetical in `lang`.
 */
export function suggest(text: string, codes: Iterable<string>, lang: Lang, limit = 6): string[] {
  const key = fold(text);
  if (!key) return [];
  const scored: [string, number][] = [];
  for (const code of codes) {
    const { en, fr, aliases } = COUNTRIES[code];
    const names = [lang === "en" ? en : fr, lang === "en" ? fr : en, ...aliases].map(fold);
    let best = Infinity;
    names.forEach((name, i) => {
      const score = name === key ? -1 : name.startsWith(key) ? (i === 0 ? 0 : 1) : name.split(" ").some((word) => word.startsWith(key)) ? 2 : Infinity;
      best = Math.min(best, score);
    });
    if (best < Infinity) scored.push([code, best]);
  }
  return scored
    .sort(([a, sa], [b, sb]) => sa - sb || COUNTRIES[a][lang].localeCompare(COUNTRIES[b][lang], lang))
    .slice(0, limit)
    .map(([code]) => code);
}
