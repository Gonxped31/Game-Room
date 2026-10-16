import type { MetadataRoute } from "next";
import { APP_TITLE } from "@/lib/games/registry";

/**
 * Minimal web app manifest, so "Add to Home Screen" installs Game Room as a
 * standalone app - on iOS that's what keeps Safari from wiping its storage
 * (and with it the guest ID and "Your rooms") after a week without a visit.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_TITLE,
    short_name: APP_TITLE,
    description: "Private 1v1 games you play through a shared link.",
    start_url: "/",
    display: "standalone",
    background_color: "#0F7983",
    theme_color: "#0F7983",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
