"use client";

import { useEffect } from "react";
import { captureSource } from "@/lib/tracking/firstTouch";

/**
 * Reads a visit's source tags (utm_source, utm_medium, utm_campaign, ref) once,
 * remembers the guest's first touch, and removes the tags from the address
 * bar (docs/tracking.md). Rendered once, by the root layout. Renders nothing;
 * the work happens after paint, and the database write later still.
 */
export default function SourceCapture() {
  useEffect(() => {
    captureSource();
  }, []);
  return null;
}
