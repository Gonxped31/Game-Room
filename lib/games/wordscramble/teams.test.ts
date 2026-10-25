import { describe, expect, it } from "vitest";
import { balanceTeams, members, onlySeated, otherTeam, setTeam, shuffleTeams, startProblem, suggestTeam } from "./teams";

const seated = ["p1", "p2", "p3", "p4"];

describe("members", () => {
  it("lists a team's seated players in seat order", () => {
    expect(members({ p3: "A", p1: "A", p2: "B", p9: "A" }, seated, "A")).toEqual(["p1", "p3"]);
  });
});

describe("suggestTeam", () => {
  it("sends a newcomer to the smaller team, Team A on a tie", () => {
    expect(suggestTeam({}, seated)).toBe("A");
    expect(suggestTeam({ p1: "A" }, seated)).toBe("B");
    expect(suggestTeam({ p1: "A", p2: "B" }, seated)).toBe("A");
  });
});

describe("setTeam", () => {
  it("moves a player without touching the others", () => {
    const teams = { p1: "A" as const, p2: "B" as const };
    expect(setTeam(teams, "p1", "B")).toEqual({ p1: "B", p2: "B" });
    expect(teams.p1).toBe("A");
  });
});

describe("startProblem", () => {
  it("allows even teams from 1v1 to 4v4", () => {
    expect(startProblem({ p1: "A", p2: "B" }, ["p1", "p2"])).toBeNull();
    expect(startProblem({ p1: "A", p2: "B", p3: "B", p4: "A" }, seated)).toBeNull();
  });

  it("refuses uneven teams and says which is short", () => {
    expect(startProblem({ p1: "A", p2: "A", p3: "B" }, ["p1", "p2", "p3"])).toEqual({ a: 2, b: 1, short: "B" });
  });

  it("refuses an empty team, or a seated player without one", () => {
    expect(startProblem({ p1: "A" }, ["p1"])).toEqual({ a: 1, b: 0, short: "B" });
    expect(startProblem({ p1: "A", p2: "B" }, ["p1", "p2", "p3"])).toEqual({ a: 1, b: 1, short: undefined });
    expect(startProblem({}, [])).not.toBeNull();
  });
});

describe("shuffleTeams", () => {
  it("deals everyone into two teams as evenly as possible", () => {
    let n = 0;
    const random = () => [0.7, 0.1, 0.5, 0.9, 0.3][n++ % 5];
    const teams = shuffleTeams(seated, random);
    expect(Object.keys(teams).sort()).toEqual(seated);
    expect(members(teams, seated, "A")).toHaveLength(2);
    expect(members(teams, seated, "B")).toHaveLength(2);
    expect(Object.values(shuffleTeams(["p1", "p2", "p3"], Math.random)).filter((t) => t === "A")).toHaveLength(2);
  });
});

describe("onlySeated / otherTeam", () => {
  it("drops seats nobody holds", () => {
    expect(onlySeated({ p1: "A", p2: "B", p5: "A" }, ["p1", "p2"])).toEqual({ p1: "A", p2: "B" });
  });

  it("flips the team", () => {
    expect(otherTeam("A")).toBe("B");
    expect(otherTeam("B")).toBe("A");
  });
});

describe("balanceTeams", () => {
  it("keeps picks that fit and moves the latest joiners off the bigger team", () => {
    expect(balanceTeams({ p1: "A", p2: "A", p3: "A", p4: "B" }, ["p1", "p2", "p3", "p4"])).toEqual({ p1: "A", p2: "A", p3: "B", p4: "B" });
  });

  it("gives a team to anyone without one, and drops seats that aren't playing", () => {
    expect(balanceTeams({ p1: "B", p5: "A" }, ["p1", "p2"])).toEqual({ p1: "B", p2: "A" });
  });

  it("always ends even", () => {
    const seated = ["p1", "p2", "p3", "p4", "p5", "p6"];
    const teams = balanceTeams({ p1: "B", p2: "B", p3: "B", p4: "B", p5: "B" }, seated);
    expect(startProblem(teams, seated)).toBeNull();
  });
});
