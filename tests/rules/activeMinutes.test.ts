/**
 * Play time (T-059): `games/{room}/activeMinutes` counts the minutes a game
 * was in progress. Every seated device tries once a minute; the rules let
 * one count through per minute, so the total doesn't grow with the number
 * of players, and nobody can set it to an arbitrary value.
 */
import { assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { nextActiveMinutes } from "@/lib/session/shared/updates";
import { dbAs, ROOM, seed, seedRoom, setupEnv, TS } from "./helpers";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await setupEnv("demo-rules-active-minutes");
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearDatabase();
});

const PATH = `games/${ROOM}/activeMinutes`;
/** An earlier count, `agoMs` before now. */
const counted = (n: number, agoMs: number) => seed(env, { [PATH]: { n, at: Date.now() - agoMs } });

describe("activeMinutes", () => {
  it("lets a seated member count the first minute, with the app's own builder", async () => {
    await seedRoom(env, { creator: "alice", seated: ["alice", "bob"] });
    await assertSucceeds(dbAs(env, "alice").ref(PATH).set(nextActiveMinutes(null, Date.now(), TS)));
    const snap = await dbAs(env, "alice").ref(PATH).get();
    expect(snap.val().n).toBe(1);
  });

  it("lets the next minute through once the last count is 50 s old, as a transaction", async () => {
    await seedRoom(env, { creator: "alice", seated: ["alice", "bob"] });
    await counted(4, 61_000);
    const result = await dbAs(env, "bob")
      .ref(PATH)
      .transaction((current) => nextActiveMinutes(current, Date.now(), TS));
    expect(result.committed).toBe(true);
    expect(result.snapshot.val().n).toBe(5);
  });

  it("refuses a second count within 50 s (another device already counted this minute)", async () => {
    await seedRoom(env, { creator: "alice", seated: ["alice", "bob"] });
    await counted(4, 20_000);
    await assertFails(dbAs(env, "bob").ref(PATH).set({ n: 5, at: TS }));
  });

  it("refuses anything but +1", async () => {
    await seedRoom(env, { creator: "alice", seated: ["alice"] });
    await assertFails(dbAs(env, "alice").ref(PATH).set({ n: 2, at: TS }));
    await counted(4, 61_000);
    await assertFails(dbAs(env, "alice").ref(PATH).set({ n: 6, at: TS }));
    await assertFails(dbAs(env, "alice").ref(PATH).set({ n: 4, at: TS }));
  });

  it("refuses a client clock time (it must be the server's)", async () => {
    await seedRoom(env, { creator: "alice", seated: ["alice"] });
    await assertFails(dbAs(env, "alice").ref(PATH).set({ n: 1, at: Date.now() - 1000 }));
  });

  it("refuses non-members, removal and extra fields", async () => {
    await seedRoom(env, { creator: "alice", seated: ["alice"] });
    await assertFails(dbAs(env, "stranger").ref(PATH).set({ n: 1, at: TS }));
    await assertFails(dbAs(env, "alice").ref(PATH).set({ n: 1, at: TS, bonus: 1 }));
    await counted(4, 61_000);
    await assertFails(dbAs(env, "alice").ref(PATH).remove());
  });

  it("refuses counting in a closed room", async () => {
    await seedRoom(env, { creator: "alice", seated: ["alice"] });
    await seed(env, { [`games/${ROOM}/closedAt`]: Date.now() - 1000 });
    await assertFails(dbAs(env, "alice").ref(PATH).set({ n: 1, at: TS }));
  });
});
