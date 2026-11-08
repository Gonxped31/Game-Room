"use client";

import { createContext, type ReactNode, useContext } from "react";
import { DEFAULT_LANG, type Lang, localizePath } from "./lang";

/**
 * The interface language. In the app it comes from the URL (LangFromPath in
 * the root layout); the offline solo exports (exports/) set it themselves.
 * Deliberately free of next/* imports, so game components that the exports
 * bundle with Vite can use it.
 */
const LangContext = createContext<Lang>(DEFAULT_LANG);

export function LangProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

/** The interface language of the page being shown. */
export function useLang(): Lang {
  return useContext(LangContext);
}

/** This language's half of a `texts({ en, fr })` dictionary (lib/i18n/text.ts). */
export function useText<T>(text: Record<Lang, T>): T {
  return text[useLang()];
}

/** A site path in the page's language: "/regions" on a French page is "/fr/regions". */
export function useLocalHref(href: string): string {
  return localizePath(href, useLang());
}

/** `localizePath` bound to the page's language, for building several links. */
export function useLocalize(): (href: string) => string {
  const lang = useLang();
  return (href) => localizePath(href, lang);
}
