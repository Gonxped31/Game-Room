"use client";

import type { CSSProperties } from "react";
import { LANG_CHOICE_KEY, localizePath, otherLang } from "@/lib/i18n/lang";
import { useLang } from "@/lib/i18n/useLang";

const NAMES = { en: "English", fr: "Français" } as const;

/**
 * The EN/FR switch: shows the other language's code ("FR" on an English page)
 * and opens this same page in it (a hard navigation, keeping the #room code),
 * remembering the choice for every later visit (lib/i18n/headScript.ts).
 * Unstyled beyond `className`/`style`: each screen gives it its own look.
 * Page-level only (hub, pages, shared footers): never inside components the
 * offline exports bundle (exports/), which have no site to switch to.
 */
export default function LangSwitch({ className, style }: { className?: string; style?: CSSProperties }) {
  const lang = useLang();
  const to = otherLang(lang);
  const go = () => {
    try {
      localStorage.setItem(LANG_CHOICE_KEY, to);
    } catch {
      // Storage blocked (private mode): the switch still works for this page.
    }
    const { pathname, search, hash } = window.location;
    window.location.assign(localizePath(`${pathname}${search}${hash}`, to));
  };
  return (
    <button type="button" onClick={go} lang={to} aria-label={NAMES[to]} title={NAMES[to]} className={className} style={style}>
      {to.toUpperCase()}
    </button>
  );
}
