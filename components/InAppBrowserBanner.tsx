"use client";

import { useState, useSyncExternalStore } from "react";
import { texts } from "@/lib/i18n/text";
import { useText } from "@/lib/i18n/useLang";
import { detectInAppBrowser } from "@/lib/inAppBrowsers";

const TEXT = texts({
  en: {
    hint: (app: string) => `You're in ${app}'s browser. Open this link in Safari or Chrome to keep your rooms.`,
    copied: "Copied!",
    copy: "Copy link",
    dismiss: "Dismiss",
  },
  fr: {
    hint: (app) => `Tu es dans le navigateur de ${app}. Ouvre ce lien dans Safari ou Chrome pour garder tes salons.`,
    copied: "Copié !",
    copy: "Copier le lien",
    dismiss: "Fermer",
  },
});

const DISMISSED_KEY = "inAppBrowserHintDismissed";
const noopSubscribe = () => () => {};

function readDismissed(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * A slim hint on room pages opened inside an app's built-in browser
 * (Messenger, Instagram, WhatsApp, ...), whose separate storage means this
 * guest ID - and the rooms it remembers - won't carry over to the player's
 * real browser. Only a hint: it never blocks play or tries to force-open
 * another browser.
 */
export default function InAppBrowserBanner() {
  const t = useText(TEXT);
  // Server-renders (and hydrates) as null; the user agent is read client-side only.
  const app = useSyncExternalStore(noopSubscribe, () => detectInAppBrowser(navigator.userAgent), () => null);
  const [dismissed, setDismissed] = useState(readDismissed);
  const [copied, setCopied] = useState(false);

  if (!app || dismissed) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable - the link is still in the address bar / share menu
    }
  };
  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // storage unavailable - it stays dismissed for this visit
    }
  };

  return (
    <div role="note" className="flex items-center gap-2 bg-black/85 px-3 py-2 text-[13px] leading-snug text-white">
      <p className="m-0 flex-1">
        {t.hint(app)}
      </p>
      <button type="button" onClick={copy} className="shrink-0 cursor-pointer rounded-md border-0 bg-white px-2.5 py-1 text-[13px] font-semibold text-black">
        {copied ? t.copied : t.copy}
      </button>
      <button type="button" onClick={dismiss} aria-label={t.dismiss} className="shrink-0 cursor-pointer border-0 bg-transparent px-1 text-lg leading-none text-white">
        ×
      </button>
    </div>
  );
}
