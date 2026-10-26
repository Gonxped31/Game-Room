import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { GAME_TITLE } from "@/lib/games/borderrun/constants";
import { PAPER } from "@/lib/games/borderrun/theme";

export const metadata: Metadata = { title: GAME_TITLE };

// The browser chrome matches the paper page.
export const viewport: Viewport = { themeColor: PAPER };

export default function BorderRunLayout({ children }: { children: ReactNode }) {
  return children;
}
