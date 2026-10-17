import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { GAME_TITLE } from "@/lib/games/iai/rules";

export const metadata: Metadata = { title: GAME_TITLE };

// Ink on rice paper: the browser chrome matches the paper.
export const viewport: Viewport = { themeColor: "#ebe3cf" };

export default function IaiLayout({ children }: { children: ReactNode }) {
  return children;
}
