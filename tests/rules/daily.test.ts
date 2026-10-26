/**
 * The daily puzzles (lib/daily/service.ts): everything under /daily is
 * written and read by the server routes through firebase-admin, which
 * bypasses these rules. No client may read or write any of it - not the
 * puzzle before its start, not a time, not the board. The rules only add the
 * board's index on `ms` for the server's top-50 query.
 */
import { assertFails, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { dbAs, seed, setupEnv } from "./helpers";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await setupEnv("demo-rules-daily");
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearDatabase();
});

const DAY = "daily/regions/2026-11-04";

describe("/daily", () => {
  it("is out of reach for every client", async () => {
    await seed(env, {
      [`${DAY}/puzzle`]: "{}",
      [`${DAY}/board/bob`]: { name: "Bob", ms: 60000 },
      [`${DAY}/attempts/alice`]: { startedAt: 1, ranked: true },
      "daily/names/alice": "Alice",
    });
    const alice = dbAs(env, "alice");
    await assertFails(alice.ref(`${DAY}/puzzle`).get());
    await assertFails(alice.ref(`${DAY}/board`).get());
    await assertFails(alice.ref(`${DAY}/attempts/alice`).get());
    await assertFails(alice.ref("daily").get());
    await assertFails(alice.ref(`${DAY}/board/alice`).set({ name: "Alice", ms: 1 }));
    await assertFails(alice.ref(`${DAY}/attempts/alice`).update({ finishedAt: 2, ms: 1 }));
    await assertFails(alice.ref("daily/names/alice").set("Someone else"));
    await assertFails(alice.ref(`${DAY}/board/bob`).remove());
  });
});
