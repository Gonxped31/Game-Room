import { describe, expect, it } from "vitest";
import { canTakeOver, isSeatOnline, TAKEOVER_AFTER_MS } from "./presence";

// Presence is keyed by guest ID; a seat is online when its holder is.
const seats = { p1: "uidA", p2: "uidB", p3: "uidC" };

describe("isSeatOnline", () => {
  it("is online when the seat's holder is online", () => {
    expect(isSeatOnline({ uidA: { online: true, lastSeen: 1 } }, seats, "p1")).toBe(true);
  });

  it("is offline when the seat's holder is marked offline", () => {
    expect(isSeatOnline({ uidA: { online: false, lastSeen: 1 } }, seats, "p1")).toBe(false);
  });

  it("is offline for a holder with no presence entry at all", () => {
    expect(isSeatOnline({ uidA: { online: true, lastSeen: 1 } }, seats, "p2")).toBe(false);
    expect(isSeatOnline({}, seats, "p1")).toBe(false);
    expect(isSeatOnline(null, seats, "p1")).toBe(false);
  });

  it("is offline for an empty seat, even if someone else is online", () => {
    expect(isSeatOnline({ uidA: { online: true, lastSeen: 1 } }, {}, "p1")).toBe(false);
    expect(isSeatOnline({ uidA: { online: true, lastSeen: 1 } }, null, "p1")).toBe(false);
  });

  it("is offline when seat is null", () => {
    expect(isSeatOnline({ uidA: { online: true, lastSeen: 1 } }, seats, null)).toBe(false);
  });

  it("follows the seat's CURRENT holder - a former holder that is still online doesn't count", () => {
    const presence = { uidA: { online: true, lastSeen: 1 }, uidD: { online: false, lastSeen: 1 } };
    expect(isSeatOnline(presence, { p1: "uidD" }, "p1")).toBe(false);
  });

  it("tracks many seats independently", () => {
    const presence = { uidA: { online: true, lastSeen: 1 }, uidB: { online: false, lastSeen: 1 }, uidC: { online: true, lastSeen: 1 } };
    expect(isSeatOnline(presence, seats, "p1")).toBe(true);
    expect(isSeatOnline(presence, seats, "p2")).toBe(false);
    expect(isSeatOnline(presence, seats, "p3")).toBe(true);
  });
});

describe("canTakeOver", () => {
  const now = 10_000_000;

  it("is allowed once the holder has been offline for over 2 minutes", () => {
    expect(canTakeOver({ uidA: { online: false, lastSeen: now - TAKEOVER_AFTER_MS - 1 } }, "uidA", now)).toBe(true);
  });

  it("is refused while the holder is online, however old lastSeen is", () => {
    expect(canTakeOver({ uidA: { online: true, lastSeen: 0 } }, "uidA", now)).toBe(false);
  });

  it("is refused before 2 minutes are up, including exactly at the boundary", () => {
    expect(canTakeOver({ uidA: { online: false, lastSeen: now - 30_000 } }, "uidA", now)).toBe(false);
    expect(canTakeOver({ uidA: { online: false, lastSeen: now - TAKEOVER_AFTER_MS } }, "uidA", now)).toBe(false);
  });

  it("is refused with no presence entry, no holder, or no clock yet", () => {
    expect(canTakeOver({}, "uidA", now)).toBe(false);
    expect(canTakeOver({ uidA: { online: false, lastSeen: 0 } }, undefined, now)).toBe(false);
    expect(canTakeOver({ uidA: { online: false, lastSeen: 0 } }, "uidA", null)).toBe(false);
  });
});
