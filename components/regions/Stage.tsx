"use client";

import type { ReactNode } from "react";
import { GAME_TITLE } from "@/lib/games/regions/constants";
import EndlessGame from "./EndlessGame";
import "./regions.css";

/**
 * The whole game, as the site shows it and as the offline download
 * (exports/regions/) does: plain CSS in regions.css rather than Tailwind
 * utilities, since the export compiles only Tailwind's base. `nav` is the
 * site's back link (none offline).
 */
export default function Stage({ nav }: { nav?: ReactNode }) {
  return (
    <div className="cg-page">
      <main className="cg-main">
        <header className="cg-header">
          {nav}
          <h1 className="cg-title">{GAME_TITLE}</h1>
        </header>
        <EndlessGame />
      </main>
    </div>
  );
}
