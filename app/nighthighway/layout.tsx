import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { GAME_TITLE } from "@/lib/games/nighthighway/constants";

export const metadata: Metadata = { title: GAME_TITLE };

// The game is one dark world: the browser chrome should match the night sky.
export const viewport: Viewport = { themeColor: "#04070f" };

export default function NightHighwayLayout({ children }: { children: ReactNode }) {
  return children;
}
