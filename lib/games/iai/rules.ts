/**
 * Iaï's balance rules - the parts of the game that aren't drawing. The
 * original (references/iai/iai.html) was a 60-second run; Game Room's version
 * has no timer: each samurai has health, and the run lasts until they fall
 * (in co-op, until both have). The engine (components/iai/engine/engine.js)
 * uses these, so they're tested here rather than only in a browser.
 */

export const GAME_TITLE = "Iaï";

/** Health. */
export const MAX_HP = 100;
/** A sword strike or an arrow. */
export const HIT_DAMAGE = 20;
/** The oni's fist. */
export const HEAVY_DAMAGE = 34;
/** Every this many hits in a row heals every living samurai a little. */
export const HEAL_EVERY_COMBO = 10;
export const HEAL_AMOUNT = 10;

/** The oni first wakes this many seconds in (as in the original), then returns this long after each defeat. */
export const FIRST_BOSS_AT = 42.5;
export const BOSS_INTERVAL = 55;

/** Movement. World units per second; the samurai is about 230 units tall. */
export const MOVE_SPEED = 420;
export const JUMP_SPEED = 1100;
export const GRAVITY = 2900;
/** Feet this high (y is negative upward) and the samurai is off the ground: strikes and fists miss. */
export const AIRBORNE_Y = -90;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Health after a hit. */
export function damage(hp: number, heavy = false): number {
  return Math.max(0, hp - (heavy ? HEAVY_DAMAGE : HIT_DAMAGE));
}

/** Health after the combo reached `combo`: a heal on every HEAL_EVERY_COMBO-th hit. */
export function healOnCombo(hp: number, combo: number): number {
  if (hp <= 0 || combo <= 0 || combo % HEAL_EVERY_COMBO !== 0) return hp;
  return Math.min(MAX_HP, hp + HEAL_AMOUNT);
}

/** The oni's health: 8 the first time (as in the original), a third more each time it returns. */
export function bossHp(bossesBeaten: number): number {
  return Math.round(8 * (1 + 0.35 * bossesBeaten));
}

/** When the next oni wakes, given how many have been beaten and when the last one fell. */
export function nextBossAt(bossesBeaten: number, lastDefeatAt: number): number {
  return bossesBeaten === 0 ? FIRST_BOSS_AT : lastDefeatAt + BOSS_INTERVAL;
}

/**
 * How fast enemies run in (units/s). The original ramped from 370 to 580 over
 * its first 44 seconds and ran at 620 after the oni; with no timer, each oni
 * beaten adds a little more, up to a ceiling.
 */
export function enemyTopSpeed(t: number, bossesBeaten: number): number {
  const base = bossesBeaten > 0 ? 620 : lerp(370, 580, clamp01(t / 44));
  return Math.min(780, base + bossesBeaten * 30);
}

/** Seconds between arrivals after an oni has been beaten: the original's 0.34-0.48 s, tightening per oni beaten. */
export function postBossGap(bossesBeaten: number, roll: number): number {
  return lerp(0.34, 0.48, roll) * Math.max(0.72, 1 - 0.06 * (bossesBeaten - 1));
}

/** The rank stamped on the results screen. */
export const RANKS: [number, string, string][] = [
  [0, "凡", "Novice"],
  [6000, "侍", "Samurai"],
  [15000, "剣士", "Swordsman"],
  [27000, "剣豪", "Sword master"],
  [40000, "剣聖", "Sword saint"],
  [55000, "鬼神", "Demon god"],
];

export function rankFor(score: number): [number, string, string] {
  return RANKS.filter((r) => score >= r[0]).pop()!;
}

/** "1:07" for 67 seconds. */
export function formatSurvived(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
