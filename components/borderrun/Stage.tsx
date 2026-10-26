"use client";

import { useEffect, useState, type ReactNode } from "react";
import { GAME_TITLE } from "@/lib/games/borderrun/constants";
import { LANGS, type Lang } from "@/lib/games/shared/language";
import { Segmented } from "./Controls";
import DailyGame from "./DailyGame";
import EndlessGame from "./EndlessGame";
import { LANG_KEY, loadLang, MODE_KEY, readJson, writeJson } from "./storage";
import "./borderrun.css";

type Mode = "daily" | "endless";
const MODES: readonly Mode[] = ["daily", "endless"];

/**
 * The whole game, as the site shows it and as the offline download
 * (exports/borderrun/) does: plain CSS in borderrun.css rather than Tailwind
 * utilities, since the export compiles only Tailwind's base. `nav` is the
 * site's back link. `online` adds the daily route (the site only: it needs
 * the server); offline is Endless alone. The tab and the names' language
 * are remembered on this device.
 */
export default function Stage({ nav, online = false }: { nav?: ReactNode; online?: boolean }) {
  // Nothing mounts until the remembered tab and language are read: mounting Daily first would start its requests for nothing.
  const [mode, setMode] = useState<Mode | null>(null);
  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => {
    const timer = setTimeout(() => {
      setLang(loadLang());
      setMode(online && readJson(MODE_KEY) !== "endless" ? "daily" : "endless");
    }, 0);
    return () => clearTimeout(timer);
  }, [online]);

  return (
    <div className="br-page">
      <main className="br-main">
        <header className="br-header">
          {nav}
          <h1 className="br-title">{GAME_TITLE}</h1>
          <Segmented
            label="Country names"
            options={LANGS}
            value={lang}
            onChange={(next) => {
              setLang(next);
              writeJson(LANG_KEY, next);
            }}
            render={(l) => l.toUpperCase()}
            small
          />
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
            render={(m) => (m === "daily" ? "Daily route" : "Endless")}
          />
        ) : null}
        {mode === "daily" ? <DailyGame lang={lang} /> : mode === "endless" ? <EndlessGame lang={lang} /> : <p className="br-status">Loading…</p>}
      </main>
    </div>
  );
}
