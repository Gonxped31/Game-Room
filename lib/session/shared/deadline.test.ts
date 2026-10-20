import { describe, expect, it } from "vitest";
import { assertDue, hasPassed, msLeft, secondsLeft } from "./deadline";

describe("msLeft / secondsLeft", () => {
  it("counts down to the deadline and never goes negative", () => {
    expect(msLeft(10_000, 7_500)).toBe(2_500);
    expect(msLeft(10_000, 12_000)).toBe(0);
  });

  it("rounds seconds up, so a label reads 0 only once the deadline has passed", () => {
    expect(secondsLeft(10_000, 7_900)).toBe(3);
    expect(secondsLeft(10_000, 9_999)).toBe(1);
    expect(secondsLeft(10_000, 10_000)).toBe(0);
  });
});

describe("hasPassed", () => {
  it("is true from the deadline itself on", () => {
    expect(hasPassed(10_000, 9_999)).toBe(false);
    expect(hasPassed(10_000, 10_000)).toBe(true);
  });
});

describe("assertDue", () => {
  const state = { phase: "countdown" };

  it("lets a due step through", () => {
    expect(() => assertDue(state, "countdown", 1_000, 1_000)).not.toThrow();
  });

  it("refuses a step that isn't due yet", () => {
    expect(() => assertDue(state, "countdown", 1_000, 999)).toThrow();
  });

  it("refuses a step whose phase has already moved on (a second device's late attempt)", () => {
    expect(() => assertDue({ phase: "question" }, "countdown", 1_000, 5_000)).toThrow();
  });

  it("refuses a step with no deadline", () => {
    expect(() => assertDue(state, "countdown", undefined, 5_000)).toThrow();
  });
});
