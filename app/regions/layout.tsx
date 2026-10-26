import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { GAME_TITLE } from "@/lib/games/regions/constants";
import { PAPER } from "@/lib/games/regions/theme";

export const metadata: Metadata = { title: GAME_TITLE };

// The browser chrome matches the cream page.
export const viewport: Viewport = { themeColor: PAPER };

export default function RegionsLayout({ children }: { children: ReactNode }) {
  return children;
}
