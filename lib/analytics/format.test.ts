import { describe, expect, it } from "vitest";
import { formatCount, formatDuration, formatRate } from "./format";

describe("formatDuration", () => {
  it("picks minutes, hours or days", () => {
    expect(formatDuration(0)).toBe("0 min");
    expect(formatDuration(42 * 60_000)).toBe("42 min");
    expect(formatDuration((3 * 60 + 5) * 60_000)).toBe("3 h 05 min");
    expect(formatDuration((2 * 24 + 4) * 3_600_000)).toBe("2 d 4 h");
  });
});

describe("formatRate", () => {
  it("rounds to a percent, or a dash with nobody to count", () => {
    expect(formatRate({ count: 1, of: 3, rate: 1 / 3 })).toBe("33%");
    expect(formatRate({ count: 0, of: 0, rate: null })).toBe("—");
  });
});

describe("formatCount", () => {
  it("compacts big numbers", () => {
    expect(formatCount(1284)).toBe("1,284");
    expect(formatCount(12_900)).toBe("12.9K");
    expect(formatCount(240_000)).toBe("240K");
    expect(formatCount(4_200_000)).toBe("4.2M");
  });
});
