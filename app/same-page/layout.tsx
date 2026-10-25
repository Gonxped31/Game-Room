import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { GAME_TITLE } from "@/lib/games/ftw/constants";

export const metadata: Metadata = { title: GAME_TITLE };

// A notebook on a lilac desk: the browser chrome should match it.
export const viewport: Viewport = { themeColor: "#B9A7FF" };

export default function SamePageLayout({ children }: { children: ReactNode }) {
  return children;
}
