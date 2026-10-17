"use client";

import Link from "next/link";
import { useEffect } from "react";
import Stage from "@/components/iai/Stage";
import { GAME_TITLE } from "@/lib/games/iai/rules";

/** Iaï on your own: the engine draws its own title and results screens; the best score stays on this device. */
export default function IaiSoloPage() {
  useEffect(() => {
    document.title = GAME_TITLE;
  }, []);

  return (
    <Stage>
      <Link href="/" className="iai-back" aria-label="Back to all games">
        ←
      </Link>
      {/* A hard navigation: the co-op page creates a room on its first render (see CLAUDE.md, "Navigating into a room"). */}
      <a href="/iai" className="iai-together">
        共 <span>Fight together</span>
      </a>
    </Stage>
  );
}
