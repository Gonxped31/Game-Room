import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/seo/metadata";

// Its tab title and link preview, in English (lib/seo, docs/link-previews.md).
export const metadata: Metadata = pageMetadata("/nighthighway", "en");

// The game is one dark world: the browser chrome should match the night sky.
export const viewport: Viewport = { themeColor: "#04070f" };

export default function NightHighwayLayout({ children }: { children: ReactNode }) {
  return children;
}
