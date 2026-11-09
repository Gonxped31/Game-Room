import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/seo/metadata";
import { PAPER } from "@/lib/games/regions/theme";

// Its tab title and link preview, in English (lib/seo, docs/link-previews.md).
export const metadata: Metadata = pageMetadata("/regions", "en");

// The browser chrome matches the cream page.
export const viewport: Viewport = { themeColor: PAPER };

export default function RegionsLayout({ children }: { children: ReactNode }) {
  return children;
}
