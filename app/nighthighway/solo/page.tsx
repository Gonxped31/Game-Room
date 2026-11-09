"use client";

import { useEffect, useState } from "react";
import LocalLink from "@/components/LocalLink";
import Stage from "@/components/nighthighway/Stage";
import { STAGE_TEXT } from "@/components/nighthighway/text";
import { useLang, useLocalHref } from "@/lib/i18n/useLang";
import { useReportFinished } from "@/lib/tracking/useReportFinished";
import { GAME_TITLE } from "@/lib/games/nighthighway/constants";
import RulesButton from "@/components/nighthighway/Rules";

/**
 * The original single-player game: no room, no second player, a best score
 * remembered on this device. The engine draws its own title and results
 * screens in solo mode.
 */
export default function NightHighwaySoloPage() {
  const lang = useLang();
  const t = STAGE_TEXT[lang];
  const raceHref = useLocalHref("/nighthighway");
  // Games finished (lib/tracking/finished.ts): each run whose 60 seconds run out, named once on this device.
  const [runId, setRunId] = useState<string | null>(null);
  useReportFinished(runId ? { slug: "nighthighway", mode: "solo", id: runId, players: 1, lang } : null);

  useEffect(() => {
    document.title = `${GAME_TITLE} · ${t.solo}`;
  }, [t]);

  return (
    <Stage mode="solo" onSoloFinish={() => setRunId(`${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`)}>
      <nav className="nh-solo-nav" aria-label="Night Highway">
        <LocalLink href="/" className="nh-back" aria-label={t.back}>
          ←
        </LocalLink>
        {/* A hard navigation: the race page creates a room on its first render (see CLAUDE.md, "Navigating into a room"). */}
        <span className="nh-solo-right">
          <span className="nh-rules">
            <RulesButton />
          </span>
          <a href={raceHref} className="nh-race-link">
            {t.raceAFriend}
          </a>
        </span>
      </nav>
    </Stage>
  );
}
