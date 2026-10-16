"use client";

import { useState, useSyncExternalStore } from "react";
import { detectInAppBrowser } from "@/lib/inAppBrowsers";

const DISMISSED_KEY = "homeScreenTipDismissed";
const noopSubscribe = () => () => {};

/**
 * Safari on iOS (not another iOS browser, not an app's in-app browser),
 * running as a regular tab rather than from the Home Screen. iPadOS reports
 * itself as a Mac, so a touch-capable "Mac" counts too.
 */
function isIosSafariTab(): boolean {
  const ua = navigator.userAgent;
  const isIos = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isSafari = /Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua) && !detectInAppBrowser(ua);
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia("(display-mode: standalone)").matches;
  return isIos && isSafari && !standalone;
}

function readDismissed(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Safari on iOS wipes a site's storage - this guest's ID, and with it the
 * room list - after about 7 days without a visit; apps added to the Home
 * Screen are exempt. Shown at the bottom of the hub's "Your rooms" (so only
 * once there's something to lose), dismissible, remembered per browser.
 */
export default function HomeScreenTip() {
  const show = useSyncExternalStore(noopSubscribe, isIosSafariTab, () => false);
  const [dismissed, setDismissed] = useState(readDismissed);
  if (!show || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // storage unavailable - it stays dismissed for this visit
    }
  };

  return (
    <div
      role="note"
      className="flex items-start gap-2 rounded-[12px] bg-[#F1F4F4] px-3 py-2.5 text-sm text-black"
    >
      <p className="m-0 flex-1">Tip: add Game Room to your Home Screen so your rooms stay saved.</p>
      <button type="button" onClick={dismiss} aria-label="Dismiss tip" className="cursor-pointer border-0 bg-transparent px-1 text-lg leading-none text-black">
        ×
      </button>
    </div>
  );
}
