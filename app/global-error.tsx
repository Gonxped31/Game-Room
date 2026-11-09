"use client";

import { useSyncExternalStore } from "react";
import RecoveryScreen from "@/components/RecoveryScreen";
import { APP_TITLE } from "@/lib/games/registry";
import { type Lang, langOfPath } from "@/lib/i18n/lang";

const noSubscribe = () => () => {};

/**
 * The root layout itself crashed: this replaces the whole document, so it brings its own html and body.
 * Without the layout there's no language context: the language comes from the address (English on the
 * server and the first render, then the page's).
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const lang = useSyncExternalStore<Lang>(noSubscribe, () => langOfPath(window.location.pathname), () => "en");
  return (
    <html lang={lang}>
      <body style={{ margin: 0 }}>
        <title>{APP_TITLE}</title>
        <RecoveryScreen error={error} retry={retry} lang={lang} />
      </body>
    </html>
  );
}
