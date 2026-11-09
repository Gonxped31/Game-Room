import type { Metadata } from "next";
import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/seo/metadata";

// Its tab title and link preview, in English (lib/seo, docs/link-previews.md).
export const metadata: Metadata = pageMetadata("/cocounsel", "en");

export default function CoCounselLayout({ children }: { children: ReactNode }) {
  return children;
}
