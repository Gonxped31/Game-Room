"use client";

import { useEffect, useState, type ReactNode } from "react";
import { GAME_TITLE } from "@/lib/games/regions/constants";
import { useText } from "@/lib/i18n/useLang";
import { Segmented } from "./Controls";
import DailyGame from "./DailyGame";
import EndlessGame from "./EndlessGame";
import { MODE_KEY, readJson, writeJson } from "./storage";
import { TEXT } from "./text";
import "./regions.css";

type Mode = "daily" | "endless";
const MODES: readonly Mode[] = ["daily", "endless"];

/**
 * The whole game, as the site shows it and as the offline download
 * (exports/regions/) does: plain CSS in regions.css rather than Tailwind
 * utilities, since the export compiles only Tailwind's base. `nav` is the
 * site's back link and `rules` its How to play (the site only: its Tailwind
 * classes aren't in the export). `online` adds the daily puzzle (the site
 * only: it needs the server); offline is endless puzzles alone, and reports no
 * finished games. The tab is remembered on this device, so a reload reopens it.
 * The words follow useLang(): the URL on the site, the browser's language in
 * the export (exports/regions/main.tsx).
 */
export default function Stage({ nav, rules, online = false }: { nav?: ReactNode; rules?: ReactNode; online?: boolean }) {
  const t = useText(TEXT);
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
          {rules}
        </header>
        {online && mode ? (
          <Segmented
            label={t.modeLabel}
            options={MODES}
            value={mode}
            onChange={(next) => {
              setMode(next);
              writeJson(MODE_KEY, next);
            }}
            render={(m) => (m === "daily" ? t.daily : t.endless)}
          />
        ) : null}
        {mode === "daily" ? <DailyGame /> : mode === "endless" ? <EndlessGame online={online} /> : <p className="cg-status">{t.loading}</p>}
      </main>
    </div>
  );
}
