import { ServerValue } from "firebase-admin/database";
import { describe, expect, it } from "vitest";
import { clearStatsUpdate, STATS_SINCE_PATH } from "./clearStats";

describe("clearStatsUpdate", () => {
  it("erases the archive and every guest's visits, and records when", () => {
    const users = {
      a: { rooms: { abc234: { gameSlug: "ftw", addedAt: 1 } }, visits: { "20261025": { abc234: { gameSlug: "ftw", at: 1 } } } },
      b: { rooms: { abc234: { gameSlug: "ftw", addedAt: 2 } } },
      c: { visits: { "20261024": {} } },
    };
    expect(clearStatsUpdate(users)).toEqual({
      "analytics/archive": null,
      [STATS_SINCE_PATH]: ServerValue.TIMESTAMP,
      "users/a/visits": null,
      "users/c/visits": null,
    });
  });

  it("never touches rooms or guests' room lists", () => {
    const paths = Object.keys(clearStatsUpdate({ a: { rooms: { abc234: {} }, visits: {} } }));
    expect(paths.some((path) => path.startsWith("games") || path.includes("/rooms") || path.startsWith("roomsByName"))).toBe(false);
  });

  it("works on an empty database", () => {
    expect(Object.keys(clearStatsUpdate(null))).toEqual(["analytics/archive", STATS_SINCE_PATH]);
  });
});
