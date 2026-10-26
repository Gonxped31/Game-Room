import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";

/** A server timestamp placeholder, same as `serverTimestamp()` in the modular SDK. */
export const TS = { ".sv": "timestamp" } as const;

/**
 * `database.rules.json`, optionally with an extra game slug allowed in
 * `meta/gameSlug`. The deployed rules only know 'ftw', 'cocounsel' and 'nighthighway', which
 * both require maxPlayers == 2 - a test-only slug is the only way to cover
 * 3+ seat rooms (rules test 5, the multiplayer module) without shipping a
 * slug nobody plays to production.
 */
export function loadRules(extraSlug?: string): string {
  const raw = readFileSync(resolve(__dirname, "../../database.rules.json"), "utf8");
  if (!extraSlug) return raw;
  const rules = JSON.parse(raw);
  const gameSlug = rules.rules.games.$room.meta.gameSlug;
  gameSlug[".validate"] = `(${gameSlug[".validate"]}) || newData.val() == '${extraSlug}'`;
  return JSON.stringify(rules);
}

/** Each test file gets its own namespace (via projectId), so files never share data. */
export async function setupEnv(projectId: string, extraSlug?: string): Promise<RulesTestEnvironment> {
  const [host, port] = (process.env.FIREBASE_DATABASE_EMULATOR_HOST ?? "127.0.0.1:9000").split(":");
  return initializeTestEnvironment({
    projectId,
    database: { host, port: Number(port), rules: loadRules(extraSlug) },
  });
}

export function dbAs(env: RulesTestEnvironment, uid: string | null) {
  return (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).database();
}

/** Writes test fixtures directly, bypassing the rules. */
export async function seed(env: RulesTestEnvironment, data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.database().ref().update(data);
  });
}

export const ROOM = "abc234";

export function ftwState(overrides: Record<string, unknown> = {}) {
  const items = ["Pizza", "Tacos", "Sushi", "Ramen", "Curry"].map((label, i) => ({ id: `i${i}_${label.toLowerCase()}`, label }));
  return {
    round: 1,
    totals: { p1: 0, p2: 0 },
    current: { prompt: "Best foods", items, status: "RANKING" },
    usedPrompts: ["Best foods"],
    ...overrides,
  };
}

export function nighthighwayState(overrides: Record<string, unknown> = {}) {
  return { phase: "LOBBY", race: 0, wins: { p1: 0, p2: 0 }, ...overrides };
}

export function buzzerquizState(overrides: Record<string, unknown> = {}) {
  return { phase: "setup", settings: { lang: "en", length: 10 }, seed: 0, index: 0, round: 0, ...overrides };
}

export function wordscrambleState(overrides: Record<string, unknown> = {}) {
  return {
    phase: "lobby",
    settings: { lang: "en", mode: "turns", turnsPerTeam: 5, target: 30 },
    turn: 0,
    seed: 0,
    hints: 0,
    scores: { A: 0, B: 0 },
    ...overrides,
  };
}

export function borderrunState(overrides: Record<string, unknown> = {}) {
  return { phase: "lobby", mode: "challenge", map: "mixed", rounds: 3, round: 0, startsAt: 0, endsAt: 0, nextAt: 0, ...overrides };
}

export function regionsState(overrides: Record<string, unknown> = {}) {
  return { phase: "lobby", mode: "challenge", pieces: "mixed", rounds: 3, round: 0, seed: "", startsAt: 0, endsAt: 0, nextAt: 0, ...overrides };
}

export function cocounselState(overrides: Record<string, unknown> = {}) {
  return { caseId: "ruined-birthday", partIndex: 0, attempts: 0, phase: "SELECTING", ...overrides };
}

export function metaFor(uid: string, gameSlug = "ftw", maxPlayers = 2, extra: Record<string, unknown> = {}) {
  return { gameSlug, maxPlayers, createdAt: TS, createdBy: uid, ...extra };
}

/** A room created by `creator` with `seated` uids already in p1, p2, ... - the starting fixture most tests need. */
export async function seedRoom(
  env: RulesTestEnvironment,
  opts: { creator: string; seated?: string[]; gameSlug?: string; maxPlayers?: number; room?: string; presence?: Record<string, unknown> },
) {
  const { creator, seated = [], gameSlug = "ftw", maxPlayers = 2, room = ROOM, presence = {} } = opts;
  const data: Record<string, unknown> = {
    [`games/${room}/meta`]: { ...metaFor(creator, gameSlug, maxPlayers), createdAt: Date.now() - 1000 },
    [`games/${room}/${gameSlug}`]: gameSlug === "cocounsel" ? cocounselState() : gameSlug === "nighthighway" ? nighthighwayState() : gameSlug === "buzzerquiz" ? buzzerquizState() : gameSlug === "wordscramble" ? wordscrambleState() : gameSlug === "borderrun" ? borderrunState() : gameSlug === "regions" ? regionsState() : ftwState(),
  };
  seated.forEach((uid, i) => {
    data[`games/${room}/seats/p${i + 1}`] = uid;
    data[`games/${room}/members/${uid}`] = `p${i + 1}`;
    data[`games/${room}/presence/${uid}`] = { online: true, lastSeen: Date.now() - 1000 };
  });
  for (const [uid, value] of Object.entries(presence)) data[`games/${room}/presence/${uid}`] = value;
  await seed(env, data);
}
