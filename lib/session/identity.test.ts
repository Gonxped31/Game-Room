import { describe, expect, it } from "vitest";
import { setIdentityName } from "./identity";
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
});
