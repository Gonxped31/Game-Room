"use client";

import { useEffect, useState, type ReactNode } from "react";
import { GAME_TITLE } from "@/lib/games/regions/constants";
import { Segmented } from "./Controls";
import DailyGame from "./DailyGame";
import EndlessGame from "./EndlessGame";
import { MODE_KEY, readJson, writeJson } from "./storage";
import "./regions.css";

type Mode = "daily" | "endless";
const MODES: readonly Mode[] = ["daily", "endless"];

/**
 * The whole game, as the site shows it and as the offline download
 * (exports/regions/) does: plain CSS in regions.css rather than Tailwind
 * utilities, since the export compiles only Tailwind's base. `nav` is the
 * site's back link. `online` adds the daily puzzle (the site only: it needs
 * the server); offline is endless puzzles alone. The tab is remembered on
 * this device, so a reload reopens it.
 */
export default function Stage({ nav, online = false }: { nav?: ReactNode; online?: boolean }) {
  // Online, nothing mounts until the remembered tab is read: mounting Daily first would start its requests for nothing.
  const [mode, setMode] = useState<Mode | null>(online ? null : "endless");
  useEffect(() => {
    if (!online) return;
    const timer = setTimeout(() => setMode(readJson(MODE_KEY) === "endless" ? "endless" : "daily"), 0);
    return () => clearTimeout(timer);
  }, [online]);

  return (
    <div className="cg-page">
      <main className="cg-main">
        <header className="cg-header">
          {nav}
          <h1 className="cg-title">{GAME_TITLE}</h1>
        </header>
        {online && mode ? (
          <Segmented
            label="Mode"
            options={MODES}
            value={mode}
            onChange={(next) => {
              setMode(next);
              writeJson(MODE_KEY, next);
            }}
            render={(m) => (m === "daily" ? "Daily puzzle" : "Endless")}
          />
        ) : null}
        {mode === "daily" ? <DailyGame /> : mode === "endless" ? <EndlessGame /> : <p className="cg-status">Loading…</p>}
      </main>
    </div>
  );
}
