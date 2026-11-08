import type { Lang } from "./lang";

/**
 * A component's or a module's words in both languages, checked by TypeScript:
 * the English object sets the shape and French must match it key for key
 * (a missing or extra key is a type error). Values are strings, or functions
 * for anything with a number or a name in it.
 *
 *   const TEXT = texts({
 *     en: { start: "Start", round: (n: number) => `Round ${n}` },
 *     fr: { start: "Commencer", round: (n) => `Manche ${n}` },
 *   });
 *   const t = useText(TEXT);   // in a client component (lib/i18n/useLang.tsx)
 *   TEXT[lang].start;          // anywhere else, with the language at hand
 */
export function texts<T>(text: { en: T; fr: NoInfer<T> }): Record<Lang, T> {
  return text;
}

const pluralRules = new Map<Lang, Intl.PluralRules>();

/**
 * `one` or `other` for `n`, by each language's own rule: English says
 * "0 points", French "0 point". The forms are whole phrases, so word order
 * stays the translator's: plural(lang, n, `${n} point`, `${n} points`).
 */
export function plural(lang: Lang, n: number, one: string, other: string): string {
  let rules = pluralRules.get(lang);
  if (!rules) {
    rules = new Intl.PluralRules(lang === "fr" ? "fr-CA" : "en-CA");
    pluralRules.set(lang, rules);
  }
  return rules.select(n) === "one" ? one : other;
}

/** The BCP 47 locale behind each language, for Intl and for link previews' og:locale. */
export const LOCALES: Record<Lang, string> = { en: "en-CA", fr: "fr-CA" };

/** A number the way the language writes it ("12,500" / "12 500"). */
export function formatNumber(lang: Lang, n: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(LOCALES[lang], options).format(n);
}

/** "A, B and C" / "A, B et C". */
export function formatList(lang: Lang, items: string[]): string {
  return new Intl.ListFormat(LOCALES[lang], { style: "long", type: "conjunction" }).format(items);
}
