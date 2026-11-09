import { ServerValue } from "firebase-admin/database";
import { describe, expect, it } from "vitest";
import { clearStatsUpdate, STATS_SINCE_PATH } from "./clearStats";

describe("clearStatsUpdate", () => {
  it("erases the archive, every guest's visits and the finished games, and records when", () => {
    const users = {
      a: { rooms: { abc234: { gameSlug: "ftw", addedAt: 1 } }, visits: { "20261025": { abc234: { gameSlug: "ftw", at: 1 } } } },
      b: { rooms: { abc234: { gameSlug: "ftw", addedAt: 2 } } },
      c: { visits: { "20261024": {} } },
    };
    expect(clearStatsUpdate(users)).toEqual({
      "analytics/archive": null,
      finished: null,
      [STATS_SINCE_PATH]: ServerValue.TIMESTAMP,
      "users/a/visits": null,
      "users/c/visits": null,
    });
  });

  it("never touches rooms, guests' room lists or first touches", () => {
    const paths = Object.keys(clearStatsUpdate({ a: { rooms: { abc234: {} }, visits: {}, firstTouch: { src: "tiktok", at: 1 } } }));
    expect(paths.some((path) => path.startsWith("games") || path.includes("/rooms") || path.startsWith("roomsByName") || path.includes("firstTouch"))).toBe(false);
  });

  it("works on an empty database", () => {
    expect(Object.keys(clearStatsUpdate(null))).toEqual(["analytics/archive", "finished", STATS_SINCE_PATH]);
  });
});
