"use client";

import type { ReactNode } from "react";
import { MODE_NAME } from "@/components/race/Screens";
import { AREA_NAME } from "@/lib/games/borderrun/areas";
import { GAME_TITLE } from "@/lib/games/borderrun/constants";
import { MAP_CHOICES, MODES, PLAYERS, ROUND_COUNTS, type MapChoice, type Mode, type RoundCount } from "@/lib/games/borderrun/race";
import { LANGS, type Lang } from "@/lib/games/shared/language";
import { Segmented } from "../Controls";
import "../borderrun.css";

/** Border Run's parts of a race room; the rest is components/race/Screens.tsx. */

export const MODE_LINE: Record<Mode, string> = {
  challenge: `${PLAYERS.challenge.min}–${PLAYERS.challenge.max} players. The lowest total time wins.`,
  survival: `${PLAYERS.survival.min}–${PLAYERS.survival.max} players. The slowest are out after each route.`,
};
const mapName = (map: MapChoice) => (map === "mixed" ? "Mixed" : AREA_NAME[map].en);

/** The room's page: the title sign and the names' EN/FR switch, as on the solo page, but no back link (a room's way out is Leave room). */
export function RaceShell({ lang, onLang, children }: { lang: Lang; onLang: (lang: Lang) => void; children: ReactNode }) {
  return (
    <div className="br-page br-race">
      <main className="br-main">
        <header className="br-header">
          <h1 className="br-title">{GAME_TITLE}</h1>
          <Segmented label="Country names" options={LANGS} value={lang} onChange={onLang} render={(l) => l.toUpperCase()} small />
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
  if (!canEdit) {
    return (
      <>
        <p className="race-note">{MODE_LINE[mode]}</p>
        <p className="race-note">
          Map: {mapName(map)}
          {mode === "challenge" ? `, ${rounds} routes` : ""}
        </p>
      </>
    );
  }
  return (
    <>
      <Segmented label="Mode" options={MODES} value={mode} onChange={onMode} render={(m) => MODE_NAME[m]} />
      <p className="race-note">{MODE_LINE[mode]}</p>
      <p className="race-field-label">Map</p>
      <Segmented label="Map" options={MAP_CHOICES} value={map} onChange={onMap} render={mapName} wrap />
      {mode === "challenge" ? (
        <>
          <p className="race-field-label">Routes</p>
          <Segmented label="Routes" options={ROUND_COUNTS.map(String)} value={String(rounds)} onChange={(n) => onRounds(Number(n) as RoundCount)} render={(n) => `${n} routes`} />
        </>
      ) : null}
    </>
  );
}
