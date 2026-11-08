"use client";

/**
 * Reads a visit's source tags (utm_source, utm_medium, utm_campaign, ref) once,
 * remembers the guest's first touch, and removes the tags from the address
 * bar (docs/tracking.md). Rendered once, by the root layout. Renders nothing.
 */
export default function SourceCapture() {
  // Stub: filled in by the tracking layer (lib/tracking/).
  return null;
}
