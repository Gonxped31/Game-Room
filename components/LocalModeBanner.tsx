import { isLocalMode } from "@/lib/store/config";

/**
 * Shown on every page while the app runs on the localStorage fallback (no
 * Firebase config): that mode only syncs tabs within one browser, so two
 * devices that can't see each other's moves would otherwise look like a sync
 * bug. Never reached on Vercel - a build there without the Firebase vars
 * fails instead (next.config.ts).
 */
export default function LocalModeBanner() {
  if (!isLocalMode) return null;
  return (
    <div
      role="status"
      className="pointer-events-none fixed left-1/2 top-0 z-50 -translate-x-1/2 rounded-b-md bg-[#FFE45C] px-2.5 py-0.5 text-[11px] font-semibold text-black shadow-[0_2px_4px_rgba(0,0,0,.25)]"
    >
      Local mode: not synced between devices
    </div>
  );
}
