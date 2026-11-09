import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/seo/metadata";

// Its tab title and link preview, in English (lib/seo, docs/link-previews.md).
export const metadata: Metadata = pageMetadata("/lasthop", "en");

// The game is a dark stage: the browser chrome should match it.
export const viewport: Viewport = { themeColor: "#1E1733" };

export default function LastHopLayout({ children }: { children: ReactNode }) {
  return children;
}
