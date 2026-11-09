"use client";

import { useEffect, useState, type ReactNode } from "react";
import { GAME_TITLE } from "@/lib/games/borderrun/constants";
import { useLang } from "@/lib/i18n/useLang";
import { Segmented } from "./Controls";
import DailyGame from "./DailyGame";
import EndlessGame from "./EndlessGame";
import { MODE_KEY, readJson, writeJson } from "./storage";
import { TEXT } from "./text";
import "./borderrun.css";

type Mode = "daily" | "endless";
const MODES: readonly Mode[] = ["daily", "endless"];

/**
 * The whole game, as the site shows it and as the offline download
 * (exports/borderrun/) does: plain CSS in borderrun.css rather than Tailwind
 * utilities, since the export compiles only Tailwind's base. `nav` is the
 * site's back link, `langSwitch` its EN/FR switch and `rules` its How to
 * play (the site only: they use next/link, the site's other pages or
 * Tailwind classes, none of which the export has). `online` adds the daily
 * route (the site only: it needs the server); offline is Endless alone.
 * Words and country names follow the page's language (`useLang()`: the URL
 * on the site, the browser's in the export). The tab is remembered on this
 * device.
 */
export default function Stage({ nav, langSwitch, rules, online = false }: { nav?: ReactNode; langSwitch?: ReactNode; rules?: ReactNode; online?: boolean }) {
  const lang = useLang();
  const t = TEXT[lang];
  // Nothing mounts until the remembered tab is read: mounting Daily first would start its requests for nothing.
  const [mode, setMode] = useState<Mode | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setMode(online && readJson(MODE_KEY) !== "endless" ? "daily" : "endless"), 0);
    return () => clearTimeout(timer);
  }, [online]);

  return (
    <div className="br-page">
      <main className="br-main">
        <header className="br-header">
          {nav}
          <h1 className="br-title">{GAME_TITLE}</h1>
          {langSwitch}
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
            render={(m) => (m === "daily" ? t.modeDaily : t.modeEndless)}
          />
        ) : null}
        {mode === "daily" ? <DailyGame lang={lang} /> : mode === "endless" ? <EndlessGame lang={lang} /> : <p className="br-status">{t.loading}</p>}
      </main>
    </div>
  );
}
