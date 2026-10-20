import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { GAME_TITLE } from "@/lib/games/wordscramble/constants";

export const metadata: Metadata = { title: GAME_TITLE };

// A warm cream table: the browser chrome should match it.
export const viewport: Viewport = { themeColor: "#FFF3DF" };

export default function WordScrambleLayout({ children }: { children: ReactNode }) {
  return children;
}
