import { describe, expect, it } from "vitest";
import { setMultiplayerIdentityName } from "./identity";
import type { WithMultiplayerIdentity } from "./types";

function fresh(): WithMultiplayerIdentity {
  return { names: {} };
}

describe("setMultiplayerIdentityName", () => {
  it("sets a player's name, trimmed", () => {
    const state = setMultiplayerIdentityName(fresh(), "p1", "  Sam  ");
    expect(state.names.p1).toBe("Sam");
  });

  it("does not touch other seats' names", () => {
    let state = setMultiplayerIdentityName(fresh(), "p1", "Sam");
    state = setMultiplayerIdentityName(state, "p2", "Alex");
    state = setMultiplayerIdentityName(state, "p3", "Jordan");
    state = setMultiplayerIdentityName(state, "p4", "Riley");
    expect(state.names).toEqual({ p1: "Sam", p2: "Alex", p3: "Jordan", p4: "Riley" });
  });

  it("rejects an empty (or whitespace-only) name", () => {
    expect(() => setMultiplayerIdentityName(fresh(), "p1", "   ")).toThrow();
  });

  it("truncates a name longer than the max length", () => {
    const state = setMultiplayerIdentityName(fresh(), "p1", "x".repeat(50));
    expect(state.names.p1).toHaveLength(24);
  });

  it("works generically on any state that has a names field", () => {
    interface MyGame extends WithMultiplayerIdentity {
      round: number;
    }
    const game: MyGame = { round: 3, names: {} };
    const next = setMultiplayerIdentityName(game, "p5", "Taylor");
    expect(next.round).toBe(3); // untouched
    expect(next.names.p5).toBe("Taylor");
  });
});
