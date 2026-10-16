"use client";

import { useSyncExternalStore } from "react";

/** The hub's own breakpoint (references/game-room/game-room-ui-spec.md) - not Tailwind's md: (768px). */
const QUERY = "(min-width: 760px)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/**
 * Whether the hub is in its desktop layout (popover) or mobile layout (bottom
 * sheet). Server-renders as mobile; it only drives overlays, which open after
 * hydration anyway. Static layout differences stay in CSS (`min-[760px]:`).
 */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
}
