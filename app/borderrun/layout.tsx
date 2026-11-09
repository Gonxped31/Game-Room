import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/seo/metadata";
import { PAPER } from "@/lib/games/borderrun/theme";

// Its tab title and link preview, in English (lib/seo, docs/link-previews.md).
export const metadata: Metadata = pageMetadata("/borderrun", "en");

// The browser chrome matches the paper page.
export const viewport: Viewport = { themeColor: PAPER };

export default function BorderRunLayout({ children }: { children: ReactNode }) {
  return children;
}
