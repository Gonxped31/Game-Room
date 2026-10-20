import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { GAME_TITLE } from "@/lib/games/buzzerquiz/constants";

export const metadata: Metadata = { title: GAME_TITLE };

// The game is a dark stage: the browser chrome should match it.
export const viewport: Viewport = { themeColor: "#16113A" };

export default function BuzzerQuizLayout({ children }: { children: ReactNode }) {
  return children;
}
