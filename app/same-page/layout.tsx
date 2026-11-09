import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/seo/metadata";

// Its tab title and link preview, in English (lib/seo, docs/link-previews.md).
export const metadata: Metadata = pageMetadata("/same-page", "en");

// A notebook on a lilac desk: the browser chrome should match it.
export const viewport: Viewport = { themeColor: "#B9A7FF" };

export default function SamePageLayout({ children }: { children: ReactNode }) {
  return children;
}
