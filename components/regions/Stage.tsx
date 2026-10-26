"use client";

import { useState, type ReactNode } from "react";
import { GAME_TITLE } from "@/lib/games/regions/constants";
import { Segmented } from "./Controls";
import DailyGame from "./DailyGame";
import EndlessGame from "./EndlessGame";
import "./regions.css";

type Mode = "daily" | "endless";
const MODES: readonly Mode[] = ["daily", "endless"];

/**
 * The whole game, as the site shows it and as the offline download
 * (exports/regions/) does: plain CSS in regions.css rather than Tailwind
 * utilities, since the export compiles only Tailwind's base. `nav` is the
 * site's back link. `online` adds the daily puzzle (the site only: it needs
 * the server); offline is endless puzzles alone.
 */
export default function Stage({ nav, online = false }: { nav?: ReactNode; online?: boolean }) {
  const [mode, setMode] = useState<Mode>(online ? "daily" : "endless");
  return (
    <div className="cg-page">
      <main className="cg-main">
        <header className="cg-header">
          {nav}
          <h1 className="cg-title">{GAME_TITLE}</h1>
        </header>
        {online ? (
          <Segmented label="Mode" options={MODES} value={mode} onChange={setMode} render={(m) => (m === "daily" ? "Daily puzzle" : "Endless")} />
        ) : null}
        {mode === "daily" ? <DailyGame /> : <EndlessGame />}
      </main>
    </div>
  );
}
