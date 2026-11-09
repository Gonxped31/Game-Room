"use client";

import type { ReactNode } from "react";
import { modeName } from "@/components/race/Screens";
import { AREA_NAME } from "@/lib/games/borderrun/areas";
import { GAME_TITLE } from "@/lib/games/borderrun/constants";
import { MAP_CHOICES, MODES, PLAYERS, ROUND_COUNTS, type MapChoice, type Mode, type RoundCount } from "@/lib/games/borderrun/race";
import type { Lang } from "@/lib/i18n/lang";
import { useLang } from "@/lib/i18n/useLang";
import { Segmented } from "../Controls";
import "../borderrun.css";
import RulesButton from "../Rules";
import { LangButton } from "../SiteHeader";
import { RACE_TEXT } from "../text";

/** Detour's parts of a race room; the rest is components/race/Screens.tsx. */

/** "2–4 players. The lowest total time wins." */
export const modeLine = (mode: Mode, lang: Lang) => RACE_TEXT[lang].modeLine[mode](PLAYERS[mode].min, PLAYERS[mode].max);
const mapName = (map: MapChoice, lang: Lang) => (map === "mixed" ? RACE_TEXT[lang].mixed : AREA_NAME[map][lang]);

/**
 * The room's page: the title sign, the EN/FR switch (the page's language,
 * which the country names follow) and How to play, as on the solo page, but
 * no back link (a room's way out is Leave room).
 */
export function RaceShell({ children }: { children: ReactNode }) {
  return (
    <div className="br-page br-race">
      <main className="br-main">
        <header className="br-header">
          <h1 className="br-title">{GAME_TITLE}</h1>
          <LangButton />
          <RulesButton />
        </header>
        {children}
      </main>
    </div>
  );
}

/** The lobby's settings: the host's switches, or what was picked. */
export function Settings({
  mode,
  map,
  rounds,
  canEdit,
  onMode,
  onMap,
  onRounds,
}: {
  mode: Mode;
  map: MapChoice;
  rounds: RoundCount;
  canEdit: boolean;
  onMode: (mode: Mode) => void;
  onMap: (map: MapChoice) => void;
  onRounds: (rounds: RoundCount) => void;
}) {
  const lang = useLang();
  const t = RACE_TEXT[lang];
  if (!canEdit) {
    return (
      <>
        <p className="race-note">{modeLine(mode, lang)}</p>
        <p className="race-note">
          {t.mapLine(mapName(map, lang))}
          {mode === "challenge" ? t.routesSuffix(rounds) : ""}
        </p>
        <RulesButton variant="link" />
      </>
    );
  }
  return (
    <>
      <Segmented label={t.modeLabel} options={MODES} value={mode} onChange={onMode} render={(m) => modeName(m, lang)} />
      <p className="race-note">{modeLine(mode, lang)}</p>
      <p className="race-field-label">{t.map}</p>
      <Segmented label={t.map} options={MAP_CHOICES} value={map} onChange={onMap} render={(m) => mapName(m, lang)} wrap />
      {mode === "challenge" ? (
        <>
          <p className="race-field-label">{t.routes}</p>
          <Segmented label={t.routes} options={ROUND_COUNTS.map(String)} value={String(rounds)} onChange={(n) => onRounds(Number(n) as RoundCount)} render={(n) => t.routeCount(n)} />
        </>
      ) : null}
      <RulesButton variant="link" />
    </>
  );
}
