import type { SeatId } from "@/lib/session/types";

/**
 * Word Scramble's two teams (references/scramble/word-scramble-game-design.md,
 * "Players and teams"): who's on which side, and whether a game can start.
 * Pure helpers over a seat -> team map; the game state stores that map, so a
 * Rematch keeps the teams.
 */

export type Team = "A" | "B";
export const TEAMS: readonly Team[] = ["A", "B"];
export type Teams = Partial<Record<SeatId, Team>>;

export const otherTeam = (team: Team): Team => (team === "A" ? "B" : "A");

const seatNumber = (seat: SeatId) => Number(seat.slice(1));
const bySeat = (a: SeatId, b: SeatId) => seatNumber(a) - seatNumber(b);

/** The seated players on `team`, in seat (join) order. */
export function members(teams: Teams, seated: readonly SeatId[], team: Team): SeatId[] {
  return seated.filter((seat) => teams[seat] === team).sort(bySeat);
}

/** Where a newcomer goes: the smaller team, Team A on a tie. */
export function suggestTeam(teams: Teams, seated: readonly SeatId[]): Team {
  return members(teams, seated, "B").length < members(teams, seated, "A").length ? "B" : "A";
}

/** Puts `seat` on `team` (a fresh map; seats without a team are fine). */
export function setTeam(teams: Teams, seat: SeatId, team: Team): Teams {
  return { ...teams, [seat]: team };
}

/** Why the game can't start yet, or null when it can. Every seated player needs a team, and both teams the same size. */
export function startProblem(teams: Teams, seated: readonly SeatId[]): { a: number; b: number; short?: Team } | null {
  const a = members(teams, seated, "A").length;
  const b = members(teams, seated, "B").length;
  const unassigned = seated.some((seat) => !teams[seat]);
  if (!unassigned && a === b && a >= 1) return null;
  return { a, b, short: a < b ? "A" : b < a ? "B" : undefined };
}

/** Re-deals the seated players into two teams at random, as evenly as possible. */
export function shuffleTeams(seated: readonly SeatId[], random: () => number): Teams {
  const order = [...seated];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const teams: Teams = {};
  order.forEach((seat, i) => {
    teams[seat] = i % 2 === 0 ? "A" : "B";
  });
  return teams;
}

/** Drops the seats nobody holds any more. */
export function onlySeated(teams: Teams, seated: readonly SeatId[]): Teams {
  const out: Teams = {};
  for (const seat of seated) if (teams[seat]) out[seat] = teams[seat];
  return out;
}
