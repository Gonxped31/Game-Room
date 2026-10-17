import { describe, expect, it } from "vitest";
import {
  bossHp,
  damage,
  enemyTopSpeed,
  FIRST_BOSS_AT,
  formatSurvived,
  HEAL_AMOUNT,
  HEAL_EVERY_COMBO,
  healOnCombo,
  HEAVY_DAMAGE,
  HIT_DAMAGE,
  MAX_HP,
  nextBossAt,
  postBossGap,
  rankFor,
} from "./rules";

describe("health", () => {
  it("loses more to the oni's fist than to a blade, and never goes below 0", () => {
    expect(damage(MAX_HP)).toBe(MAX_HP - HIT_DAMAGE);
    expect(damage(MAX_HP, true)).toBe(MAX_HP - HEAVY_DAMAGE);
    expect(damage(5)).toBe(0);
  });

  it("heals on every tenth hit in a row, up to full, and never revives the fallen", () => {
    expect(healOnCombo(50, HEAL_EVERY_COMBO)).toBe(50 + HEAL_AMOUNT);
    expect(healOnCombo(50, HEAL_EVERY_COMBO * 3)).toBe(50 + HEAL_AMOUNT);
    expect(healOnCombo(50, HEAL_EVERY_COMBO + 1)).toBe(50);
    expect(healOnCombo(MAX_HP - 2, HEAL_EVERY_COMBO)).toBe(MAX_HP);
    expect(healOnCombo(0, HEAL_EVERY_COMBO)).toBe(0);
  });
});

describe("the oni", () => {
  it("first wakes at the original's moment, then returns after each defeat", () => {
    expect(nextBossAt(0, 0)).toBe(FIRST_BOSS_AT);
    expect(nextBossAt(1, 70)).toBeGreaterThan(70);
  });

  it("starts at the original's health and grows each time", () => {
    expect(bossHp(0)).toBe(8);
    expect(bossHp(1)).toBeGreaterThan(bossHp(0));
    expect(bossHp(3)).toBeGreaterThan(bossHp(2));
  });
});

describe("difficulty", () => {
  it("ramps like the original, then keeps climbing per oni beaten, to a ceiling", () => {
    expect(enemyTopSpeed(0, 0)).toBe(370);
    expect(enemyTopSpeed(44, 0)).toBe(580);
    expect(enemyTopSpeed(200, 1)).toBeGreaterThan(enemyTopSpeed(44, 0));
    expect(enemyTopSpeed(999, 50)).toBe(780);
    expect(postBossGap(5, 0.5)).toBeLessThan(postBossGap(1, 0.5));
    expect(postBossGap(99, 0)).toBeGreaterThan(0.2);
  });
});

describe("results", () => {
  it("ranks by score and formats the time survived", () => {
    expect(rankFor(0)[2]).toBe("Novice");
    expect(rankFor(15000)[2]).toBe("Swordsman");
    expect(rankFor(1e9)[2]).toBe("Demon god");
    expect(formatSurvived(67.9)).toBe("1:07");
    expect(formatSurvived(5)).toBe("0:05");
  });
});
