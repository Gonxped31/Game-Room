import type { Metadata } from "next";
import type { ReactNode } from "react";
import { pageMetadata } from "@/lib/seo/metadata";

/**
 * Every /fr page's defaults: the French hub's tab title and link preview
 * (lib/seo, docs/link-previews.md); each French page then sets its own.
 * Children only: the root layout holds <html> for both languages.
 */
export const metadata: Metadata = pageMetadata("/", "fr");

export default function FrenchLayout({ children }: { children: ReactNode }) {
  return children;
}
