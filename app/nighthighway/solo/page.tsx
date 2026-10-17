"use client";

import Link from "next/link";
import { useEffect } from "react";
import Stage from "@/components/nighthighway/Stage";
import { GAME_TITLE } from "@/lib/games/nighthighway/constants";

/**
 * The original single-player game: no room, no second player, a best score
 * remembered on this device. The engine draws its own title and results
 * screens in solo mode.
 */
export default function NightHighwaySoloPage() {
  useEffect(() => {
    document.title = `${GAME_TITLE} · Solo`;
  }, []);

  return (
    <Stage mode="solo">
      <nav className="nh-solo-nav" aria-label="Night Highway">
        <Link href="/" className="nh-back" aria-label="Back to all games">
          ←
        </Link>
        {/* A hard navigation: the race page creates a room on its first render (see CLAUDE.md, "Navigating into a room"). */}
        <a href="/nighthighway" className="nh-race-link">
          Race a friend
        </a>
      </nav>
    </Stage>
  );
}
