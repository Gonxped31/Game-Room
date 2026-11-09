"use client";

import LangSwitch from "@/components/LangSwitch";
import LocalLink from "@/components/LocalLink";
import { useText } from "@/lib/i18n/useLang";
import { TEXT } from "./text";

/**
 * The header pieces only the site has (the offline export has no hub and no
 * other language to go to, so Stage takes them as slots): the back arrow to
 * the hub, in the page's language, and the EN/FR switch, in the place of the
 * old country-names switch. Country names follow the page's language, so
 * this one switch changes both.
 */
export function BackLink() {
  const t = useText(TEXT);
  return (
    <LocalLink href="/" className="br-back" aria-label={t.back}>
      ←
    </LocalLink>
  );
}

export function LangButton() {
  return <LangSwitch className="br-back br-lang" />;
}
