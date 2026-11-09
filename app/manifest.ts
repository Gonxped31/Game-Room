import type { MetadataRoute } from "next";
import { APP_TITLE } from "@/lib/games/registry";
import { previewFor } from "@/lib/seo/previews";

/**
 * Minimal web app manifest, so "Add to Home Screen" installs Partyfox as a
 * standalone app - on iOS that's what keeps Safari from wiping its storage
 * (and with it the guest ID and "Your rooms") after a week without a visit.
 * One manifest for both languages, so its description is the English hub's.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_TITLE,
    short_name: APP_TITLE,
    description: previewFor("/", "en").tagline,
    start_url: "/",
    display: "standalone",
    background_color: "#0F7983",
    theme_color: "#0F7983",
    // The fox-bubble app icon (public/brand/README.md); the maskable one keeps the fox in Android's safe zone.
    icons: [
      { src: "/brand/favicon/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/favicon/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/favicon/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
