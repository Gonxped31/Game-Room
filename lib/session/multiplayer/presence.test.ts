import { describe, expect, it } from "vitest";
import { isSeatOnline, STALE_AFTER_MS } from "./presence";

describe("isSeatOnline", () => {
  it("is online when the seat's last heartbeat is recent", () => {
    const now = 1_000_000;
    const presence = { p1: now - 1000 };
    expect(isSeatOnline(presence, "p1", now)).toBe(true);
  });

  it("is offline when the seat's last heartbeat is stale", () => {
    const now = 1_000_000;
    const presence = { p1: now - STALE_AFTER_MS - 1 };
    expect(isSeatOnline(presence, "p1", now)).toBe(false);
  });

  it("is offline right at the staleness boundary", () => {
    const now = 1_000_000;
    const presence = { p1: now - STALE_AFTER_MS };
    expect(isSeatOnline(presence, "p1", now)).toBe(false);
  });

  it("is offline for a seat with no heartbeat at all", () => {
    const now = 1_000_000;
    expect(isSeatOnline({ p1: now }, "p2", now)).toBe(false);
    expect(isSeatOnline({}, "p1", now)).toBe(false);
    expect(isSeatOnline(null, "p1", now)).toBe(false);
  });

  it("is offline when seat is null", () => {
    expect(isSeatOnline({ p1: 1_000_000 }, null, 1_000_000)).toBe(false);
  });

  it("is offline when now hasn't been read yet (null)", () => {
    expect(isSeatOnline({ p1: 1_000_000 }, "p1", null)).toBe(false);
  });

  it("tracks many seats independently", () => {
    const now = 1_000_000;
    const presence = { p1: now, p2: now - STALE_AFTER_MS - 1, p3: now - 500 };
    expect(isSeatOnline(presence, "p1", now)).toBe(true);
    expect(isSeatOnline(presence, "p2", now)).toBe(false);
    expect(isSeatOnline(presence, "p3", now)).toBe(true);
  });
});
