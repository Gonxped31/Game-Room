import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/seo/metadata";

// Its tab title and link preview, in English (lib/seo, docs/link-previews.md).
export const metadata: Metadata = pageMetadata("/wordscramble", "en");

// A warm cream table: the browser chrome should match it.
export const viewport: Viewport = { themeColor: "#FFF3DF" };

export default function WordScrambleLayout({ children }: { children: ReactNode }) {
  return children;
}
