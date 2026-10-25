"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { watchConnection } from "@/lib/store";

/** How long the connection must be down before saying so: a blip shouldn't flash a banner. */
const AFTER_DROP_MS = 2000;
/** On first load the database starts disconnected, so give it longer to connect at all. */
const AT_START_MS = 8000;

/**
 * "Reconnecting…" at the top of the screen while this device has lost the
 * database. Moves made meanwhile are kept and sent on reconnect (the store
 * queues them), so the message says that rather than "you're offline".
 * Skipped on solo pages and /admin, which never touch the database from the
 * browser.
 */
export default function ConnectionBanner() {
  const pathname = usePathname();
  const solo = pathname.endsWith("/solo") || pathname.startsWith("/admin");
  const [down, setDown] = useState(false);

  useEffect(() => {
    if (solo) return;
    let everConnected = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = watchConnection((connected) => {
      clearTimeout(timer);
      if (connected) {
        everConnected = true;
        setDown(false);
      } else {
        timer = setTimeout(() => setDown(true), everConnected ? AFTER_DROP_MS : AT_START_MS);
      }
    });
    return () => {
      clearTimeout(timer);
      stop();
    };
  }, [solo]);

  if (solo || !down) return null;
  return (
    <div
      role="status"
      className="pointer-events-none fixed left-1/2 top-2 z-[60] w-max max-w-[calc(100%-32px)] -translate-x-1/2 rounded-full bg-black/85 px-3.5 py-1.5 text-center text-[13px] font-semibold text-white shadow-[0_2px_6px_rgba(0,0,0,.3)]"
    >
      Reconnecting… your moves will sync when you&apos;re back online.
    </div>
  );
}
