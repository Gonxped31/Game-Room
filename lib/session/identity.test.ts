import { describe, expect, it } from "vitest";
import { releaseAllIdentityNames, setIdentityName } from "./identity";
import type { WithIdentity } from "./types";

function fresh(): WithIdentity {
  return { names: {} };
}

describe("setIdentityName", () => {
  it("sets a player's name, trimmed", () => {
    const state = setIdentityName(fresh(), "p1", "  Sam  ");
    expect(state.names.p1).toBe("Sam");
  });

  it("does not touch the other player's name", () => {
    const state = setIdentityName(setIdentityName(fresh(), "p1", "Sam"), "p2", "Alex");
    expect(state.names).toEqual({ p1: "Sam", p2: "Alex" });
  });

  it("rejects an empty (or whitespace-only) name", () => {
    expect(() => setIdentityName(fresh(), "p1", "   ")).toThrow();
  });

  it("truncates a name longer than the max length", () => {
    const state = setIdentityName(fresh(), "p1", "x".repeat(50));
    expect(state.names.p1).toHaveLength(24);
  });

  it("works generically on any state that has a names field", () => {
    interface MyGame extends WithIdentity {
      round: number;
    }
    const game: MyGame = { round: 3, names: {} };
    const next = setIdentityName(game, "p2", "Jordan");
    expect(next.round).toBe(3); // untouched
    expect(next.names.p2).toBe("Jordan");
  });

  it("rejects claiming a seat someone else already holds while the other seat is still open - the race two devices tapping at nearly the same moment can hit", () => {
    const taken = setIdentityName(fresh(), "p1", "Sam");
    expect(() => setIdentityName(taken, "p1", "Jamie")).toThrow();
    expect(taken.names.p1).toBe("Sam"); // unchanged by the rejected attempt
  });

  it("still allows claiming the OTHER, still-open seat while one is already taken", () => {
    const taken = setIdentityName(fresh(), "p1", "Sam");
    const both = setIdentityName(taken, "p2", "Alex");
    expect(both.names).toEqual({ p1: "Sam", p2: "Alex" });
  });

  it("claims the first seat in a fresh room whose state has no `names` key at all - Firebase drops an empty object on write, so this is the real shape of a never-before-joined room, not just `{names: {}}`", () => {
    const state = { names: undefined } as unknown as WithIdentity;
    const next = setIdentityName(state, "p1", "Sam");
    expect(next.names).toEqual({ p1: "Sam" });
  });

  it("allows re-writing a seat once BOTH are already claimed (the 'Welcome back, which one are you?' re-confirmation) - not a race once settled", () => {
    const both = setIdentityName(setIdentityName(fresh(), "p1", "Sam"), "p2", "Alex");
    const reconfirmed = setIdentityName(both, "p1", "Sam");
    expect(reconfirmed.names).toEqual({ p1: "Sam", p2: "Alex" });
    // Also allows actually changing a settled seat's name, not just an exact echo.
    const renamed = setIdentityName(both, "p1", "Samuel");
    expect(renamed.names).toEqual({ p1: "Samuel", p2: "Alex" });
  });
});

describe("releaseAllIdentityNames", () => {
  it("clears every claimed seat at once", () => {
    const both = setIdentityName(setIdentityName(fresh(), "p1", "Sam"), "p2", "Alex");
    expect(releaseAllIdentityNames(both).names).toEqual({});
  });

  it("is a harmless no-op on an already-empty room", () => {
    expect(releaseAllIdentityNames(fresh()).names).toEqual({});
  });

  it("is a harmless no-op on a state with no `names` key at all", () => {
    const state = { names: undefined } as unknown as WithIdentity;
    expect(releaseAllIdentityNames(state).names).toEqual({});
  });

  it("does not touch the rest of the state", () => {
    interface MyGame extends WithIdentity {
      round: number;
    }
    const game: MyGame = { round: 3, names: { p1: "Sam", p2: "Alex" } };
    expect(releaseAllIdentityNames(game).round).toBe(3);
  });

  it("both seats can immediately be re-claimed by either role, same as a fresh room", () => {
    const both = setIdentityName(setIdentityName(fresh(), "p1", "Sam"), "p2", "Alex");
    const released = releaseAllIdentityNames(both);
    const reclaimed = setIdentityName(setIdentityName(released, "p2", "Jordan"), "p1", "Taylor");
    expect(reclaimed.names).toEqual({ p1: "Taylor", p2: "Jordan" });
  });
});
