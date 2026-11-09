import type { Metadata } from "next";
import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/seo/metadata";

// Its tab title and link preview, in English (lib/seo, docs/link-previews.md).
export const metadata: Metadata = pageMetadata("/borderrun/solo", "en");

export default function BorderRunSoloLayout({ children }: { children: ReactNode }) {
  return children;
}
