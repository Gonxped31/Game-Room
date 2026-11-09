"use client";

import LocalLink from "@/components/LocalLink";
import { texts } from "@/lib/i18n/text";
import { useText } from "@/lib/i18n/useLang";

const TEXT = texts({ en: { back: "Back to all games" }, fr: { back: "Retour à tous les jeux" } });

/** The solo page's ← to the hub, in the page's language (the site only: the offline export has no hub). */
export default function BackLink() {
  const t = useText(TEXT);
  return (
    <LocalLink href="/" className="cg-back" aria-label={t.back}>
      ←
    </LocalLink>
  );
}
