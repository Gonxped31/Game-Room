import type { Metadata, Viewport } from "next";
import { Fredoka } from "next/font/google";
import type { ReactNode } from "react";
// TODO(stage 2): replace with a true app-level brand once the game picker lands.
import { GAME_TITLE } from "@/lib/games/ftw/constants";
import "./globals.css";

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: GAME_TITLE,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={fredoka.variable}>
      <body className="min-h-screen pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] font-[family-name:var(--font-fredoka)] font-medium">
        {children}
      </body>
    </html>
  );
}
